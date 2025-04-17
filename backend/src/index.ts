import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { errorHandler } from './middleware/error';

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
  categoryRoutes
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

// JWT middleware
const authenticateToken = (req: Request, res: express.Response, next: express.NextFunction) => {
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
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/product-images', productImagesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/cart', cartRouter);

// Error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`
🚀 Server is running!
📡 Port: ${port}
🌍 Environment: ${env}
⏰ Time: ${new Date().toISOString()}
    `);
  });
}
