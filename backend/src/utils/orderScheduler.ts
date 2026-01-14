import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Updates an order status to 'processing' after a specified delay
 * Reduces product stock count and sets estimated delivery to 3 days from order date
 * @param orderId The ID of the order to update
 * @param delayMinutes The number of minutes to wait before updating (default: 5)
 */
export const scheduleOrderProcessing = (orderId: string, delayMinutes: number = 5) => {
  console.log(`Scheduling order ${orderId} to update to 'processing' after ${delayMinutes} minutes`);
  
  setTimeout(async () => {
    try {
      // 1. Fetch the order to get the items and check current status
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(product_id, quantity)')
        .eq('id', orderId)
        .single();
      
      if (orderError) {
        console.log(`Error fetching order ${orderId}: ${orderError.message}`);
        return;
      }
      
      if (!order) {
        console.log(`Order ${orderId} not found`);
        return;
      }
      
      // Check if order is cancelled - abort processing if it is
      if (order.status === 'cancelled') {
        console.log(`Order ${orderId} is already cancelled. Skipping processing.`);
        return;
      }
      
      // Check if order is not in pending state
      if (order.status !== 'pending') {
        console.log(`Order ${orderId} is in ${order.status} state, not pending. Skipping processing.`);
        return;
      }
      
      // Calculate the estimated delivery date (3 days from now)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
      
      // 2. Update the order status and set estimated delivery date
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          estimated_delivery: estimatedDelivery.toISOString(),
          updated_at: new Date().toISOString(),
          inventory_updated: true // Mark that inventory will be updated
        })
        .eq('id', orderId)
        .eq('status', 'pending') // Only update if still pending
        .select()
        .single();
      
      if (error) {
        console.error(`Error updating order ${orderId} to processing:`, error);
        return;
      }
      
      if (!data) {
        console.log(`Order ${orderId} was not updated (likely already processed or cancelled)`);
        return;
      }
      
      // Double-check order status one more time before reducing stock
      const { data: latestOrder, error: latestOrderError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
        
      if (latestOrderError) {
        console.error(`Error verifying order status for ${orderId}:`, latestOrderError);
        return;
      }
      
      // Final verification that order wasn't cancelled during our operations
      if (latestOrder.status === 'cancelled') {
        console.log(`Order ${orderId} was cancelled during processing. Skipping stock reduction.`);
        return;
      }
      
      // 3. Check if this order was created through sales dashboard
      // Sales dashboard orders have a customer record associated with the user_id
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', order.user_id)
        .single();
      
      const isSalesDashboardOrder = !!customer;
      
      // 4. Update product stock counts
      const orderItems = order.order_items;
      if (orderItems && orderItems.length > 0) {
        console.log(`Reducing stock for ${orderItems.length} products from order ${orderId}`);
        console.log(`Is sales dashboard order: ${isSalesDashboardOrder}`);
        
        // Process each item and update stock
        for (const item of orderItems) {
          // First get the current stock
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_count')
            .eq('id', item.product_id)
            .single();
          
          if (productError) {
            console.error(`Error fetching product ${item.product_id}:`, productError);
            continue;
          }
          
          // Calculate new stock count
          // For sales dashboard orders, allow negative stock
          // For regular orders, prevent negative stock
          let newStockCount: number;
          if (isSalesDashboardOrder) {
            // Allow negative stock for sales dashboard orders
            newStockCount = product.stock_count - item.quantity;
            console.log(`Sales order: Allowing negative stock. ${product.stock_count} - ${item.quantity} = ${newStockCount}`);
          } else {
            // Regular orders: prevent negative stock
            newStockCount = Math.max(0, product.stock_count - item.quantity);
            if (product.stock_count - item.quantity < 0) {
              console.warn(`Regular order: Insufficient stock for product ${item.product_id}. Stock would go negative, setting to 0.`);
            }
          }
          
          // Update the product stock
          // This runs in a scheduled context without a user session, so we need admin client
          // to bypass RLS (no auth.uid() available in background jobs)
          if (!supabaseAdmin) {
            console.error(`Cannot update stock: supabaseAdmin is not available. Service role key may be missing.`);
            continue;
          }
          
          const { data: updatedProducts, error: updateError } = await supabaseAdmin
            .from('products')
            .update({ stock_count: newStockCount })
            .eq('id', item.product_id)
            .select('stock_count');
          
          if (updateError) {
            console.error(`Error updating stock for product ${item.product_id}:`, updateError);
            console.error(`Update error details:`, JSON.stringify(updateError, null, 2));
          } else if (!updatedProducts || updatedProducts.length === 0) {
            console.error(`No rows updated for product ${item.product_id}. Product may not exist.`);
          } else {
            const updatedProduct = updatedProducts[0];
            console.log(`Stock reduced for product ${item.product_id}: ${product.stock_count} -> ${newStockCount} (Sales order: ${isSalesDashboardOrder})`);
            // Verify the update actually persisted
            if (updatedProduct && updatedProduct.stock_count !== newStockCount) {
              console.warn(`WARNING: Stock update may have been blocked! Expected: ${newStockCount}, Actual: ${updatedProduct.stock_count}`);
            } else {
              console.log(`Stock update verified: ${updatedProduct?.stock_count}`);
            }
          }
        }
      }
      
      console.log(`Order ${orderId} successfully updated to 'processing' with estimated delivery on ${estimatedDelivery.toISOString()}`);
    } catch (error) {
      console.error(`Error in scheduled processing for order ${orderId}:`, error);
    }
  }, delayMinutes * 60 * 1000); // Convert minutes to milliseconds
};

/**
 * Initialize order monitoring system
 * This handles any pending orders that might have been missed during server restarts
 */
export const initOrderScheduler = async () => {
  try {
    console.log('Initializing order scheduler...');
    
    // Find recent pending orders (that might have been missed during restart)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    const { data: pendingOrders, error } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('status', 'pending')
      .gte('created_at', thirtyMinutesAgo.toISOString());
    
    if (error) {
      console.error('Error fetching pending orders for scheduler initialization:', error);
      return;
    }
    
    console.log(`Found ${pendingOrders?.length || 0} pending orders to process`);
    
    // Schedule processing for each pending order
    pendingOrders?.forEach(order => {
      const createdAt = new Date(order.created_at);
      const now = new Date();
      const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (60 * 1000);
      
      if (elapsedMinutes >= 5) {
        // If 5+ minutes have passed, update immediately
        scheduleOrderProcessing(order.id, 0);
      } else {
        // Otherwise, schedule for the remaining time
        scheduleOrderProcessing(order.id, 5 - elapsedMinutes);
      }
    });
    
    console.log('Order scheduler initialized successfully');
  } catch (error) {
    console.error('Error initializing order scheduler:', error);
  }
}; 