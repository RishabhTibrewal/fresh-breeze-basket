import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Function to handle inventory restoration when an order is cancelled
async function handleInventoryRestoration(supabase: any, order_id: string) {
  try {
    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order_id)
    
    if (itemsError) {
      throw new Error(`Error fetching order items: ${itemsError.message}`)
    }
    
    if (!orderItems || orderItems.length === 0) {
      throw new Error(`No order items found for order ${order_id}`)
    }
    
    // Restore inventory for each item
    for (const item of orderItems) {
      // Add back to inventory (positive quantity)
      const { error: restoreError } = await supabase
        .rpc('update_stock', { 
          p_id: item.product_id, 
          amount: item.quantity // Positive to add back to inventory
        })
      
      if (restoreError) {
        console.error(`Error restoring inventory for product ${item.product_id}: ${restoreError.message}`)
      }
    }
    
    return {
      success: true,
      message: `Inventory restored for order ${order_id}`,
      order_id
    }
  } catch (error) {
    console.error('Error in inventory restoration:', error.message)
    throw error
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get the request body
    const { order_id, restore_inventory } = await req.json()

    if (!order_id) {
      throw new Error('Missing order_id parameter')
    }
    
    // If this is a restore inventory request
    if (restore_inventory === true) {
      const restorationResult = await handleInventoryRestoration(supabase, order_id)
      return new Response(
        JSON.stringify(restorationResult),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Get order details with order items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          quantity
        )
      `)
      .eq('id', order_id)
      .single()

    if (orderError) {
      throw new Error(`Error fetching order: ${orderError.message}`)
    }

    if (!order) {
      throw new Error(`Order with ID ${order_id} not found`)
    }

    // Only update inventory if order is in a valid state
    if (order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped') {
      // Update inventory for each item in the order if not already updated
      if (!order.inventory_updated) {
        // Mark the order as updated and change status to processing (if currently pending)
        const updateData = { 
          inventory_updated: true,
          // Only update to processing if it's currently pending
          ...(order.status === 'pending' && { status: 'processing' })
        }
        
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id)

        if (updateOrderError) {
          throw new Error(`Error updating order status: ${updateOrderError.message}`)
        }

        // Update inventory for each order item
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            // Use the RPC function to safely decrement inventory
            const { error: decrementError } = await supabase
              .rpc('decrement_quantity', { 
                item_id: item.product_id, 
                amount: item.quantity 
              })

            if (decrementError) {
              console.error(`Error updating inventory for product ${item.product_id}: ${decrementError.message}`)
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Inventory updated successfully',
        order_id: order_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in update-inventory function:', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 