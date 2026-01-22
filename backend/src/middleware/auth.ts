import { Request, Response, NextFunction } from 'express';
import { verifyUserToken } from '../config/supabase';
import { AuthenticationError, AuthorizationError } from './error';
import { supabase } from '../config/supabase';

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

// In-memory role cache to avoid fetching role on every request
const roleCache = new Map<string, { role: string; expiresAt: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Helper function to get role from cache or database
const getUserRole = async (userId: string): Promise<string> => {
  // Check cache first
  const cached = roleCache.get(userId);
  const now = Date.now();
  
  if (cached && now < cached.expiresAt) {
    return cached.role;
  }
  
  // Cache miss or expired - fetch from database
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.role) {
      // Default role if profile not found (matches database default)
      return 'user';
    }
    
    const role = profile.role;
    
    // Cache the role
    roleCache.set(userId, {
      role,
      expiresAt: now + ROLE_CACHE_TTL
    });
    
    return role;
  } catch (error) {
    console.error(`Error fetching role for user ${userId}:`, error);
    return 'user'; // Default role on error (matches database default)
  }
};

const getUserCompanyId = async (userId: string): Promise<string | null> => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.company_id) {
      return null;
    }

    return profile.company_id;
  } catch (error) {
    console.error(`Error fetching company_id for user ${userId}:`, error);
    return null;
  }
};

// Export function to invalidate role cache (useful when role is updated)
export const invalidateRoleCache = (userId: string): void => {
  roleCache.delete(userId);
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

      // Get user's role and company (uses cache to minimize role queries)
      const userRole = await getUserRole(user.id);
      let userCompanyId = await getUserCompanyId(user.id);

      // If user's profile doesn't have company_id but req.companyId is set (from tenant resolution),
      // update the profile to fix the data issue
      if (!userCompanyId && req.companyId) {
        console.warn(`User ${user.id} profile missing company_id, updating with tenant company_id: ${req.companyId}`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ company_id: req.companyId })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`Failed to update user profile company_id:`, updateError);
          throw new AuthenticationError('User company is not set and could not be updated');
        }
        
        userCompanyId = req.companyId;
      }

      if (!userCompanyId) {
        throw new AuthenticationError('User company is not set');
      }

      if (req.companyId && req.companyId !== userCompanyId) {
        throw new AuthorizationError('User does not belong to this company');
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email || '',
        role: userRole, // Use the fetched/cached role
        company_id: userCompanyId
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
      userRole = await getUserRole(req.user.id);
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
      userRole = await getUserRole(req.user.id);
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