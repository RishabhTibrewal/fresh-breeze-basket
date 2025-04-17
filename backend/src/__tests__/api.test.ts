import request from 'supertest';
import { app } from '../index';
import { supabase } from '../config';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Ensure we're in test environment
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Tests must be run with NODE_ENV=test');
}

describe('API Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testProductId: string;
  let testOrderId: string;

  // Authentication Tests
  describe('Authentication', () => {
    const testUser = {
      email: 'test@gmail.com',
      password: 'test123',
      first_name: 'Test',
      last_name: 'User'
    };

    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should login user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      
      authToken = response.body.data.token;
      testUserId = response.body.data.user.id;
    });

    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
    });
  });

  // Products Tests
  describe('Products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create a new product', async () => {
      const newProduct = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        category_id: 'some-category-id',
        stock_count: 100
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newProduct);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      testProductId = response.body.data.id;
    });

    it('should get a single product', async () => {
      const response = await request(app)
        .get(`/api/products/${testProductId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testProductId);
    });
  });

  // Orders Tests
  describe('Orders', () => {
    it('should create a new order', async () => {
      const newOrder = {
        items: [
          {
            product_id: testProductId,
            quantity: 2
          }
        ],
        shipping_address: {
          address_line1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postal_code: '12345',
          country: 'Test Country'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newOrder);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      testOrderId = response.body.data.id;
    });

    it('should get user orders', async () => {
      const response = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get a single order', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testOrderId);
    });
  });

  // Cleanup
  afterAll(async () => {
    try {
      // Clean up test data
      if (testOrderId) {
        await supabase
          .from('orders')
          .delete()
          .eq('id', testOrderId);
      }

      if (testProductId) {
        await supabase
          .from('products')
          .delete()
          .eq('id', testProductId);
      }

      if (testUserId) {
        await supabase
          .from('profiles')
          .delete()
          .eq('id', testUserId);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
}); 