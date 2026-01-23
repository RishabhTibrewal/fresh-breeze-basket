import { Request, Response, NextFunction } from 'express';
import { createAuthClient, verifyUserToken } from '../config/supabase';
import { AuthenticationError, AuthorizationError } from './error';
import { supabase, supabaseAdmin } from '../config/supabase';

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

// In-memory role cache to avoid fetching role on every request
const roleCache = new Map<string, { role: string; expiresAt: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

const getRoleCacheKey = (userId: string, companyId?: string) =>
  `${userId}:${companyId || 'default'}`;

const getUserMembership = async (userId: string, companyId?: string) => {
  const client = supabaseAdmin || supabase;
  let query = client
    .from('company_memberships')
    .select('company_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    query = query.order('created_at', { ascending: true }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error(`Error fetching membership for user ${userId}:`, error);
    return null;
  }

  return data || null;
};

// Helper function to get role from cache or database
const getUserRole = async (userId: string, companyId?: string): Promise<string> => {
  const cacheKey = getRoleCacheKey(userId, companyId);
  // Check cache first
  const cached = roleCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && now < cached.expiresAt) {
    return cached.role;
  }
  
  // Cache miss or expired - fetch from database
  try {
    const membership = await getUserMembership(userId, companyId);
    const role = membership?.role || 'user';
    
    // Cache the role
    roleCache.set(cacheKey, {
      role,
      expiresAt: now + ROLE_CACHE_TTL
    });
    
    return role;
  } catch (error) {
    console.error(`Error fetching role for user ${userId}:`, error);
    return 'user'; // Default role on error (matches database default)
  }
};

// Export function to invalidate role cache (useful when role is updated)
export const invalidateRoleCache = (userId: string): void => {
  roleCache.forEach((_value, key) => {
    if (key.startsWith(`${userId}:`)) {
      roleCache.delete(key);
    }
  });
  console.log(`Role cache invalidated for user ${userId}`);
};

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimit.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check rate limit
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      throw new AuthenticationError('Too many requests. Please try again later.');
    }

    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AuthenticationError('Authentication token is required');
    }

    console.log('Attempting to verify token:', token.substring(0, 20) + '...');
    
    try {
      // Verify the token with Supabase
      const user = await verifyUserToken(token);
      
      if (!user) {
        console.error('No user returned from token verification');
        throw new AuthenticationError('Invalid authentication token');
      }

      if (!req.companyId) {
        throw new AuthenticationError('Company context is required');
      }

      const membership = await getUserMembership(user.id, req.companyId);

      if (!membership) {
        throw new AuthenticationError('User does not belong to this company');
      }

      if (membership.company_id !== req.companyId) {
        throw new AuthorizationError('User does not belong to this company');
      }

      // Keep profile company_id in sync with active company for legacy access paths
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.company_id !== req.companyId) {
        const profileClient = supabaseAdmin || createAuthClient(token);
        const { error: profileUpdateError } = await profileClient
          .from('profiles')
          .update({ company_id: req.companyId })
          .eq('id', user.id);

        if (profileUpdateError) {
          console.warn('Failed to sync profile company_id:', profileUpdateError);
        }
      }

      const userRole = await getUserRole(user.id, req.companyId);

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email || '',
        role: userRole, // Use the fetched/cached role
        company_id: req.companyId
      };

      console.log('User authenticated successfully:', { id: user.id, email: user.email, role: userRole });
      next();
    } catch (authError) {
      console.error('Auth error:', authError);
      throw new AuthenticationError('Invalid authentication token');
    }
  } catch (error) {
    next(error);
  }
};

export const adminOnly = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Use role from req.user (already set by protect middleware)
    // If role is not set, fetch it (in case adminOnly is used without protect)
    let userRole = req.user.role;
      
    if (!userRole) {
      userRole = await getUserRole(req.user.id, req.companyId);
      req.user.role = userRole;
    }
    
    if (userRole !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use role from req.user if available, otherwise fetch from cache/database
    let userRole = req.user.role;

    if (!userRole) {
      userRole = await getUserRole(req.user.id, req.companyId);
      req.user.role = userRole;
    }

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
};

export const isSalesExecutive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use role from req.user if available, otherwise fetch from cache/database
    let userRole = req.user.role;

    if (!userRole) {
      userRole = await getUserRole(req.user.id);
      req.user.role = userRole;
    }

    if (userRole !== 'sales') {
      return res.status(403).json({ error: 'Sales executive access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
}; 