// import { supabase } from '../config/supabase';

/**
 * Updates an order status to 'processing' after a specified delay
 * @param orderId The ID of the order to update
 * @param delayMinutes The number of minutes to wait before updating (default: 5)
 */
export const scheduleOrderProcessing = (orderId: string, delayMinutes: number = 5) => {
  console.log(`Order scheduling disabled: would have scheduled order ${orderId} to update to 'processing' after ${delayMinutes} minutes`);
  
  // setTimeout(async () => {
  //   try {
  //     // Calculate the estimated delivery date (3 days from now)
  //     const estimatedDelivery = new Date();
  //     estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
      
  //     // Update the order status and set estimated delivery date
  //     const { data, error } = await supabase
  //       .from('orders')
  //       .update({
  //         status: 'processing',
  //         estimated_delivery: estimatedDelivery.toISOString(),
  //         updated_at: new Date().toISOString()
  //       })
  //       .eq('id', orderId)
  //       .eq('status', 'pending') // Only update if still pending
  //       .select()
  //       .single();
      
  //     if (error) {
  //       console.error(`Error updating order ${orderId} to processing:`, error);
  //       return;
  //     }
      
  //     if (!data) {
  //       console.log(`Order ${orderId} was not updated (likely already processed or cancelled)`);
  //       return;
  //     }
      
  //     console.log(`Order ${orderId} successfully updated to 'processing' with estimated delivery on ${estimatedDelivery.toISOString()}`);
  //   } catch (error) {
  //     console.error(`Error in scheduled processing for order ${orderId}:`, error);
  //   }
  // }, delayMinutes * 60 * 1000); // Convert minutes to milliseconds
};

/**
 * Initialize order monitoring system
 * This would handle any pending orders that might have been missed during server restarts
 */
export const initOrderScheduler = async () => {
  console.log('Order scheduler initialization disabled');
  // try {
  //   console.log('Initializing order scheduler...');
    
  //   // Find recent pending orders (that might have been missed during restart)
  //   const thirtyMinutesAgo = new Date();
  //   thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
  //   const { data: pendingOrders, error } = await supabase
  //     .from('orders')
  //     .select('id, created_at')
  //     .eq('status', 'pending')
  //     .gte('created_at', thirtyMinutesAgo.toISOString());
    
  //   if (error) {
  //     console.error('Error fetching pending orders for scheduler initialization:', error);
  //     return;
  //   }
    
  //   console.log(`Found ${pendingOrders?.length || 0} pending orders to process`);
    
  //   // Schedule processing for each pending order
  //   pendingOrders?.forEach(order => {
  //     const createdAt = new Date(order.created_at);
  //     const now = new Date();
  //     const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (60 * 1000);
      
  //     if (elapsedMinutes >= 5) {
  //       // If 5+ minutes have passed, update immediately
  //       scheduleOrderProcessing(order.id, 0);
  //     } else {
  //       // Otherwise, schedule for the remaining time
  //       scheduleOrderProcessing(order.id, 5 - elapsedMinutes);
  //     }
  //   });
    
  //   console.log('Order scheduler initialized successfully');
  // } catch (error) {
  //   console.error('Error initializing order scheduler:', error);
  // }
}; 