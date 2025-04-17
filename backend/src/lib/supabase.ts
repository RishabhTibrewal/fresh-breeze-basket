import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Admin client with service role key for server-side operations
const supabaseAdminUrl = process.env.SUPABASE_URL || '';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseAdminUrl || !supabaseAdminKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

export const supabaseAdmin = createClient<Database>(supabaseAdminUrl, supabaseAdminKey);

// Helper function to check if a user is an admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('is_admin', { user_id: userId });
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Helper function to update product stock
export async function updateProductStock(productId: string, quantity: number): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc('update_stock', { 
      p_id: productId, 
      quantity: quantity 
    });
    
    if (error) {
      console.error('Error updating stock:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating stock:', error);
    return false;
  }
}

// Helper function to update order status
export async function updateOrderStatus(orderId: string, status: string, notes?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      return false;
    }

    // Add status history entry
    const { error: historyError } = await supabaseAdmin
      .from('order_status_history')
      .insert({
        order_id: orderId,
        status,
        notes: notes || 'Status updated'
      });

    if (historyError) {
      console.error('Error creating status history:', historyError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    return false;
  }
}

// Helper function to update payment status
export async function updatePaymentStatus(orderId: string, paymentStatus: string, paymentIntentId?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ 
        payment_status: paymentStatus,
        payment_intent_id: paymentIntentId
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating payment status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}

// Helper function to get order with all related data
export async function getOrderWithDetails(orderId: string) {
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        ),
        order_status_history (*),
        shipping_address:addresses!shipping_address_id (*),
        billing_address:addresses!billing_address_id (*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return null;
    }

    return order;
  } catch (error) {
    console.error('Error fetching order details:', error);
    return null;
  }
}

// Helper function to create a new order
export async function createOrder(orderData: {
  user_id: string;
  total_amount: number;
  shipping_address_id: string;
  billing_address_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}) {
  try {
    // Start a transaction
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: orderData.user_id,
        total_amount: orderData.total_amount,
        shipping_address_id: orderData.shipping_address_id,
        billing_address_id: orderData.billing_address_id,
        status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return null;
    }

    // Insert order items
    const orderItems = orderData.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      return null;
    }

    return order;
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
} 