/**
 * TypeScript interfaces for database models
 */

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  company_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'sales'; // Deprecated: kept for backward compatibility
  roles?: string[]; // New: array of role names
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  address_type: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  company_id: string;
  name: string;
  slug: string | null;
  legal_name: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tax {
  id: string;
  company_id: string;
  name: string;
  code: string;
  rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  /** @deprecated Use product_variants.image_url instead */
  image_url: string | null;
  category_id: string | null;
  slug: string;
  /** @deprecated Use product_variants.is_featured instead */
  is_featured: boolean;
  /** Product-level activation control. If false, all variants are automatically inactive. Variants can only be active if product is active. */
  is_active: boolean;
  stock_count: number;
  /** @deprecated Use product_variants.unit_type instead */
  unit_type: string;
  nutritional_info: string | null;
  origin: string | null;
  /** @deprecated Use product_variants.best_before instead */
  best_before: string | null;
  brand_id: string | null;
  created_at: string;
  updated_at: string;
  /** @deprecated Use product_variants.unit instead */
  unit: number | null;
  /** @deprecated Use product_variants.badge instead */
  badge: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_id: string;
  is_default: boolean;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  unit: number | null;
  unit_type: string;
  best_before: string | null;
  tax_id: string | null;
  hsn: string | null;
  badge: string | null;
  brand_id: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  outlet_id: string | null;
  price_type: string;
  mrp_price: number;
  sale_price: number;
  brand_id: string | null;
  valid_from: string;
  valid_until: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  company_id: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  company_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  // Business semantics
  order_type: 'sales' | 'purchase' | 'return';
  order_source: 'ecommerce' | 'pos' | 'sales' | 'internal';
  fulfillment_type: 'delivery' | 'pickup' | 'cash_counter';
  original_order_id: string | null;
  // Monetary fields
  total_amount: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_intent_id: string | null;
  // Addresses
  shipping_address_id: string | null;
  billing_address_id: string | null;
  // Logistics
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  outlet_id?: string | null;
  // Meta
  notes: string | null;
  created_at: string;
  updated_at: string;
  inventory_updated?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_intent_id: string | null;
  amount: number;
  status: 'completed' | 'failed' | 'refunded';
  payment_method: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  sales_executive_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trn_number: string | null;
  credit_period_days: number;
  credit_limit: number;
  current_credit: number;
  created_at: string;
  updated_at: string;
}

export interface creditPeriods {
  id: string;
  customer_id: string;
  amount: number;
  period: number;
  start_date: string;
  end_date: string;
  type: 'credit' | 'payment';
  description: string | null;
  created_at: string;
}

// Database type definition for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id'>>;
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Address, 'id'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderItem, 'id'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at'>;
        Update: Partial<Omit<Payment, 'id'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id'>>;
      };
      credit_periods: {
        Row: creditPeriods;
        Insert: Omit<creditPeriods, 'id' | 'created_at'>;
        Update: Partial<Omit<creditPeriods, 'id'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Role, 'id'>>;
      };
      user_roles: {
        Row: UserRole;
        Insert: Omit<UserRole, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserRole, 'id'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: { user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: { p_user_id: string; p_role_name: string; p_company_id?: string | null };
        Returns: boolean;
      };
      has_any_role: {
        Args: { p_user_id: string; p_role_names: string[]; p_company_id?: string | null };
        Returns: boolean;
      };
      has_all_roles: {
        Args: { p_user_id: string; p_role_names: string[]; p_company_id?: string | null };
        Returns: boolean;
      };
      get_user_roles: {
        Args: { p_user_id: string; p_company_id?: string | null };
        Returns: string[];
      };
      update_stock: {
        Args: { p_id: string; quantity: number };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 