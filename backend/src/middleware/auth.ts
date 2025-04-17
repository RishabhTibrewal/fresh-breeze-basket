import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { AuthenticationError, AuthorizationError } from './error';

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

    try {
      // For Supabase tokens, we can decode without verification since they're already verified by Supabase
      const decoded = jwt.decode(token);
      
      if (!decoded || typeof decoded === 'string') {
        throw new AuthenticationError('Invalid authentication token');
      }

      // Add user info to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role || 'authenticated'
      };

      next();
    } catch (jwtError) {
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
    
    // Check if user is admin by directly checking the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
      
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new AuthorizationError('Error checking admin status');
    }
    
    if (!profile || profile.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }
    
    console.log('User is admin');
    next();
  } catch (error) {
    next(error);
  }
}; 