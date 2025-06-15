import { Request, Response, NextFunction } from 'express';
import { verifyUserToken } from '../config/supabase';
import { AuthenticationError, AuthorizationError } from './error';
import { supabase } from '../config/supabase';

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

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

      // Fetch user's role from profiles table
      let userRole = 'authenticated'; // Default role
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.warn(`Could not fetch profile for user ${user.id}:`, profileError.message);
          // Stick with default role 'authenticated' or handle as error if profile is mandatory
        } else if (profile && profile.role) {
          userRole = profile.role; // Assign actual role from profile
        }
      } catch (profileFetchError) {
        console.error(`Exception fetching profile for user ${user.id}:`, profileFetchError);
        // Stick with default role or handle error
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email || '',
        role: userRole // Use the fetched role
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

    console.log('Checking admin status for user:', req.user.id);
    
    // Check if user is admin by checking the profile(s)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id);
      
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new AuthorizationError('Error checking admin status');
    }
    
    // Check if any of the returned profiles have admin role
    const isAdmin = profiles && profiles.length > 0 && profiles.some(profile => profile.role === 'admin');
    
    if (!isAdmin) {
      // If not admin, throw error
      throw new AuthorizationError('Admin access required');
    }
    
    // If we get here, user is admin
    console.log('User is admin');
    
    // Add admin role to req.user for controllers to use
    req.user.role = 'admin';
    
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
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user?.id)
      .single();

    if (error || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
};

export const isSalesExecutive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user?.id)
      .single();

    if (error || !profile || profile.role !== 'sales') {
      return res.status(403).json({ error: 'Sales executive access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
}; 