import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, ApiError } from './error';
import { supabase, supabaseAdmin } from '../config/supabase';
import { SupabaseJwtVerificationError, verifySupabaseJwt } from '../utils/supabaseJwt';
import { getUserRoles, hasAnyRole, invalidateRoleCache as invalidateRolesCache } from '../utils/roles';

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const getUserMembership = async (userId: string, companyId?: string) => {
  const client = supabaseAdmin || supabase;
  let query = client
    .from('company_memberships')
    .select('company_id, is_active')
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

// Export function to invalidate role cache (useful when role is updated)
export const invalidateRoleCache = (userId: string): void => {
  invalidateRolesCache(userId);
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

      const userRoles = await getUserRoles(payload.sub, req.companyId);
      // For backward compatibility, set role to first role or 'user'
      const primaryRole = userRoles.length > 0 ? userRoles[0] : 'user';

      // Add user info to request
      req.user = {
        id: payload.sub,
        email: payload.email || '',
        role: primaryRole, // Backward compatibility
        roles: userRoles, // New: array of roles
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

/**
 * Middleware to require one or more roles (admin override applies)
 * Usage: requireRole(['sales']), requireRole(['sales', 'accounts'])
 */
export const requireRole = (requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      if (!req.companyId) {
        throw new AuthenticationError('Company context is required');
      }

      // Check if user has any of the required roles (includes admin override)
      const hasAccess = await hasAnyRole(req.user.id, req.companyId, requiredRoles);

      if (!hasAccess) {
        throw new AuthorizationError(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const adminOnly = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!req.companyId) {
      throw new AuthenticationError('Company context is required');
    }

    // Check if user has admin or accounts role (admin override is built into hasAnyRole)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['admin', 'accounts']);
    
    if (!hasAccess) {
      throw new AuthorizationError('Admin or Accounts access required');
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
      const userRoles = await getUserRoles(payload.sub, req.companyId);
      req.user = {
        id: payload.sub,
        email: payload.email || '',
        role: userRoles.length > 0 ? userRoles[0] : 'user', // Backward compatibility
        roles: userRoles, // New: array of roles
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

    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }

    // Check if user has admin or accounts role (admin override is built into hasAnyRole)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['admin', 'accounts']);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin or Accounts access required' });
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

    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }

    // Check if user has sales role (admin override applies)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['sales']);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Sales executive access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
};

export const requireAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!req.companyId) {
      throw new AuthenticationError('Company context is required');
    }

    // Check if user has accounts role (admin override applies)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['accounts']);

    if (!hasAccess) {
      throw new AuthorizationError('Accounts access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require accounts or admin role (for approval actions)
 */
export const requireAccountsOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!req.companyId) {
      throw new AuthenticationError('Company context is required');
    }

    // Check if user has accounts or admin role (admin override applies)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['accounts', 'admin']);

    if (!hasAccess) {
      throw new AuthorizationError('Accounts or Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require warehouse manager or admin role
 */
export const requireWarehouseManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!req.companyId) {
      throw new AuthenticationError('Company context is required');
    }

    // Check if user has warehouse_manager or admin role (admin override applies)
    const hasAccess = await hasAnyRole(req.user.id, req.companyId, ['warehouse_manager', 'admin']);

    if (!hasAccess) {
      throw new AuthorizationError('Warehouse Manager or Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to check if user can manage a specific warehouse
 */
export const canManageWarehouse = async (
  userId: string,
  companyId: string,
  warehouseId: string
): Promise<boolean> => {
  try {
    const client = supabaseAdmin || supabase;
    
    // Check using database function
    const { data, error } = await client.rpc('has_warehouse_access', {
      p_user_id: userId,
      p_warehouse_id: warehouseId,
      p_company_id: companyId
    });

    if (error) {
      console.error(`Error checking warehouse access for user ${userId}:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Error checking warehouse access for user ${userId}:`, error);
    return false;
  }
}; 