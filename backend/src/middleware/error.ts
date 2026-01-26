import { Request, Response, NextFunction } from 'express';

// Helper to check if origin is allowed (simplified version)
const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) return true;
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:8080', 'http://localhost:3000'];
  
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes(origin)) return true;
  if (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('https://localhost:')) return true;
  return normalizedOrigin.includes('gofreshco.com');
};

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(401, message);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Not authorized') {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Prevent double response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  try {
    let statusCode = 500;
    let message = 'Server Error';
    let isOperational = false;
    
    if (err instanceof ApiError) {
      statusCode = err.statusCode;
      message = err.message;
      isOperational = err.isOperational;
    } else if (err instanceof Error && err.message) {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    }
    
    // Ensure CORS headers are present on error responses
    const origin = req.headers.origin;
    if (origin && !res.getHeader('Access-Control-Allow-Origin') && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Tenant-Subdomain');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    }
    
    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
      });
    }
    
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        code: statusCode,
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { stack: err.stack })
      }
    });
  } catch (handlerError) {
    // If error handler itself fails, send a basic error response
    console.error('Error handler failed:', handlerError);
    if (!res.headersSent) {
      // Ensure CORS headers even on handler failure
      const origin = req.headers.origin;
      if (origin && isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          code: 500
        }
      });
    }
  }
}; 