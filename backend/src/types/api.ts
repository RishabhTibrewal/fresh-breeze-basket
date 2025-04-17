/**
 * TypeScript interfaces for API requests and responses
 */

import { User, Address, Category, Product, Order, OrderItem, Payment } from './database';

// Common response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<PaginatedData<T>> {}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// User types
export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

// Address types
export interface CreateAddressRequest {
  address_type: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  is_default?: boolean;
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {}

// Product types
export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  sale_price?: number;
  unit: string;
  images: string[];
  badge?: string;
  category_id: string;
  origin?: string;
  nutritional_info?: string;
  stock_count: number;
  harvest_date?: string;
  best_before?: string;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface ProductFilter {
  category_id?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort_by?: 'price' | 'created_at' | 'name';
  sort_order?: 'asc' | 'desc';
}

// Order types
export interface CreateOrderRequest {
  shipping_address_id: string;
  billing_address_id: string;
  payment_method: string;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

export interface UpdateOrderStatusRequest {
  status: Order['status'];
}

// Payment types
export interface CreatePaymentRequest {
  order_id: string;
  payment_method: string;
  amount: number;
}

export interface RefundRequest {
  payment_id: string;
  amount: number;
  reason: string;
}

// Query parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
} 