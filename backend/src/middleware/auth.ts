import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, ApiError } from './error';
import { supabase, supabaseAdmin } from '../config/supabase';
import { SupabaseJwtVerificationError, verifySupabaseJwt } from '../utils/supabaseJwt';

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

const rateLimitedAuthPaths = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password'
]);

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

export const rateLimitAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!rateLimitedAuthPaths.has(req.path)) {
    return next();
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests. Please try again later.',
        code: 429
      }
    });
  }
  next();
};

const getTokenFromRequest = (req: Request) => req.headers.authorization?.split(' ')[1];

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = getTokenFromRequest(req);
    
    if (!token) {
      throw new AuthenticationError('Authentication token is required');
    }

    try {
      console.log('Verifying JWT token (first 20 chars):', token.substring(0, 20) + '...');
      const payload = await verifySupabaseJwt(token);
      console.log('JWT verified successfully for user:', payload.sub);

      if (!req.companyId) {
        throw new AuthenticationError('Company context is required');
      }

      const membership = await getUserMembership(payload.sub, req.companyId);

      if (!membership) {
        throw new AuthenticationError('User does not belong to this company');
      }

      if (membership.company_id !== req.companyId) {
        throw new AuthorizationError('User does not belong to this company');
      }

      const userRole = await getUserRole(payload.sub, req.companyId);

      // Add user info to request
      req.user = {
        id: payload.sub,
        email: payload.email || '',
        role: userRole, // Use the fetched/cached role
        company_id: req.companyId
      };

      next();
    } catch (authError) {
      if (authError instanceof SupabaseJwtVerificationError) {
        if (authError.kind === 'unavailable') {
          console.error('JWKS verification unavailable:', authError);
          throw new ApiError(503, 'Auth verification unavailable');
        }
        console.error('JWT verification failed:', authError.message, authError);
        throw new AuthenticationError('Invalid authentication token');
      }
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
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const payload = await verifySupabaseJwt(token);
      req.user = {
        id: payload.sub,
        email: payload.email || '',
        role: 'user',
        company_id: req.companyId
      };
      next();
    } catch (authError) {
      if (authError instanceof SupabaseJwtVerificationError && authError.kind === 'unavailable') {
        return res.status(503).json({ error: 'Auth verification unavailable' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
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
      userRole = await getUserRole(req.user.id, req.companyId);
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