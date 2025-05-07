import dotenv from 'dotenv';
import path from 'path';
import 'express-async-errors';

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down gracefully...');
  console.error(error.name, error.message);
  console.error(error.stack);
  // Keep the server running despite the error
  // process.exit(1); // Uncomment this if you want to restart the server on uncaught exceptions
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error('Reason:', reason);
  // Keep the server running despite the error
  // process.exit(1); // Uncomment this if you want to restart the server on unhandled rejections
});

import express, { Request } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { errorHandler } from './middleware/error';
import { initOrderScheduler } from './utils/orderScheduler';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Routes
import { 
  authRoutes,
  productRoutes,
  orderRoutes,
  paymentRoutes,
  categoryRoutes,
  adminRoutes
} from './routes';
import productImagesRouter from './routes/productImages';
import inventoryRouter from './routes/inventory';
import cartRouter from './routes/cart';

// Initialize Express app
export const app = express();
const port = process.env.PORT || 5000;
const env = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Add a server-wide error catching middleware for all routes
app.use((req, res, next) => {
  try {
    next();
  } catch (error) {
    console.error('Route error caught by global handler:', error);
    next(error);
  }
});

// JWT middleware
const authenticateToken = (req: Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key', (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Error in authenticateToken middleware:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Basic test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Fresh Breeze Basket API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/product-images', productImagesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/cart', cartRouter);
app.use('/api/admin', adminRoutes);

// Final error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error handler caught:', err);
  
  // Don't expose the error details in production
  const statusCode = err.statusCode || 500;
  const message = env === 'production' && statusCode === 500 
    ? 'Something went wrong' 
    : err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      stack: env === 'development' ? err.stack : undefined
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, () => {
    console.log(`
🚀 Server is running!
📡 Port: ${port}
🌍 Environment: ${env}
⏰ Time: ${new Date().toISOString()}
    `);
    
    // Initialize the order scheduler
    initOrderScheduler().catch(err => {
      console.error('Failed to initialize order scheduler:', err);
    });
  });
  
  // Handle server exceptions
  server.on('error', (error) => {
    console.error('Server error:', error);
    // Keep the server running despite the error
  });
}
