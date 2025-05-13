import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { Database } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface OrderItemInput {
  product_id: string;
  quantity: number;
  price: number;
  unit_price?: number; // Add unit_price as an optional field
  product_name?: string; // Optional field for frontend
}

export const orderController = {
  // Create order for a customer
  async createOrder(req: Request, res: Response) {
    try {
      console.log('Creating order with data:', JSON.stringify(req.body, null, 2));
      const {
        customer_id,
        items,
        shipping_address_id,
        billing_address_id,
        payment_method,
        payment_status,
        notes,
        credit_details,
        partial_payment_amount,
        total_amount
      } = req.body;

      const sales_executive_id = req.user?.id;
      console.log('Sales executive ID:', sales_executive_id);
      console.log('Customer ID:', customer_id);

      // Verify the customer belongs to this sales executive
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, user_id, current_credit, credit_limit, sales_executive_id')
        .eq('id', customer_id)
        .single();

      if (customerError) {
        console.error('Customer lookup error:', customerError);
        return res.status(404).json({ error: `Customer not found: ${customerError.message}` });
      }

      console.log('Customer found:', customer);
      
      // Check if the customer belongs to this sales executive
      if (customer.sales_executive_id !== sales_executive_id) {
        console.error(`Customer ${customer_id} does not belong to sales executive ${sales_executive_id}`);
        return res.status(403).json({ 
          error: 'Access denied. This customer is not assigned to your account.',
          customer_sales_executive: customer.sales_executive_id,
          current_user: sales_executive_id
        });
      }

      // Calculate order total amount
      console.log('Calculating order total for items:', items);
      let subtotal = 0;
      for (const item of items as OrderItemInput[]) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('price, sale_price')
          .eq('id', item.product_id)
          .single();

        if (productError) {
          console.error('Product lookup error:', productError);
          return res.status(404).json({ error: `Product ${item.product_id} not found: ${productError.message}` });
        }

        if (!product) {
          return res.status(404).json({ error: `Product ${item.product_id} not found` });
        }
        
        // Use sale_price if available, otherwise use regular price
        const priceToUse = product.sale_price || product.price;
        subtotal += priceToUse * item.quantity;
      }

      // Apply shipping fee and tax to get total amount
      const shipping_fee = 0; // For future implementation
      const tax = subtotal * 0.05; // 5% tax
      const calculatedTotalAmount = total_amount || (subtotal + shipping_fee + tax);
      console.log('Calculated total_amount:', calculatedTotalAmount);

      // Check if customer has enough credit for credit-based payment methods
      if ((payment_method === 'full_credit' || payment_method === 'partial_payment') && 
          (customer.current_credit + (payment_method === 'full_credit' ? calculatedTotalAmount : (calculatedTotalAmount - (partial_payment_amount || 0)))) > customer.credit_limit) {
        console.error('Credit limit exceeded. Current credit:', customer.current_credit, 'Credit limit:', customer.credit_limit);
        return res.status(400).json({ error: 'Credit limit exceeded' });
      }

      // Determine payment status based on payment method
      let orderPaymentStatus = 'pending';
      if (payment_method === 'full_payment') {
        orderPaymentStatus = 'paid';
      } else if (payment_method === 'partial_payment') {
        orderPaymentStatus = 'partial';
      } else if (payment_method === 'full_credit') {
        orderPaymentStatus = 'credit';
      }

      console.log('Creating order with payment status:', orderPaymentStatus);

      // Create order - use customer.user_id instead of customer_id for user_id field
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: customer.user_id, // Use the customer's user_id, not the customer's id
          status: 'pending',
          shipping_address_id,
          billing_address_id,
          payment_method,
          total_amount: calculatedTotalAmount, // Use total_amount field instead of subtotal/shipping_fee/tax
          notes,
          payment_status: orderPaymentStatus
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        return res.status(500).json({ error: `Failed to create order: ${orderError.message}` });
      }

      console.log('Order created successfully:', order);
      console.log('Creating order items for items:', JSON.stringify(items, null, 2));

      // First get all product prices in one query for better performance
      const productIds = (items as OrderItemInput[]).map(item => item.product_id);
      const { data: products, error: productsQueryError } = await supabase
        .from('products')
        .select('id, price, sale_price')
        .in('id', productIds);

      if (productsQueryError) {
        console.error('Error fetching product prices:', productsQueryError);
        // Rollback by deleting the order if products query fails
        await supabase.from('orders').delete().eq('id', order.id);
        return res.status(500).json({ error: `Failed to fetch product prices: ${productsQueryError.message}` });
      }

      // Map products to a dictionary for quick lookup
      const productPrices: Record<string, number> = {};
      products.forEach(product => {
        productPrices[product.id] = product.sale_price || product.price;
      });

      console.log('Product prices for order items:', productPrices);

      // Check validity of items before trying to insert
      for (const item of items as OrderItemInput[]) {
        if (!item.product_id) {
          console.error('Item missing product_id:', item);
          return res.status(400).json({ error: 'Item missing product_id' });
        }
        if (!item.quantity || item.quantity <= 0) {
          console.error('Item has invalid quantity:', item);
          return res.status(400).json({ error: `Invalid quantity for product ${item.product_id}` });
        }
      }

      // Create order items with prices from products
      const orderItems = (items as OrderItemInput[]).map(item => {
        // Use the price sent from frontend if available, otherwise fallback to product prices
        const unitPrice = item.price || item.unit_price || productPrices[item.product_id];
        
        if (!unitPrice || isNaN(Number(unitPrice))) {
          console.error(`Missing or invalid price for product ${item.product_id}`, { 
            item_price: item.price,
            item_unit_price: item.unit_price,
            product_price: productPrices[item.product_id],
            item: item
          });
          throw new Error(`Missing price for product ${item.product_id}`);
        }
        
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice
        };
      });

      console.log('Final order items to insert:', JSON.stringify(orderItems, null, 2));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Rollback by deleting the order if items creation fails
        await supabase.from('orders').delete().eq('id', order.id);
        return res.status(500).json({ error: `Failed to create order items: ${itemsError.message}` });
      }

      console.log('Order items created successfully');

      // Handle credit period creation if required
      if (payment_method === 'full_credit' || payment_method === 'partial_payment') {
        // Calculate credit amount
        const creditAmount = payment_method === 'full_credit' 
          ? calculatedTotalAmount 
          : (calculatedTotalAmount - (partial_payment_amount || 0));
        
        if (creditAmount > 0 && credit_details) {
          console.log('Creating credit period for amount:', creditAmount);
          
          // Create credit period record
          const { error: creditError } = await supabase
            .from('credit_periods')
            .insert({
              customer_id,
              amount: creditAmount,
              period: credit_details.period,
              start_date: credit_details.start_date,
              end_date: credit_details.end_date,
              type: 'credit',
              description: credit_details.description || `Credit for order ${order.id}`
            });

          if (creditError) {
            console.error('Error creating credit period:', creditError);
            return res.status(500).json({ error: `Failed to create credit period: ${creditError.message}` });
          }

          // Update customer's current credit
          const { error: updateCreditError } = await supabase
            .from('customers')
            .update({ current_credit: customer.current_credit + creditAmount })
            .eq('id', customer_id);

          if (updateCreditError) {
            console.error('Error updating customer credit:', updateCreditError);
            return res.status(500).json({ error: `Failed to update customer credit: ${updateCreditError.message}` });
          }
          
          console.log('Credit period created and customer credit updated');
        }
      }

      // Update product stock
      for (const item of items as OrderItemInput[]) {
        // Call update_stock function
        const { error: stockError } = await supabase.rpc('update_stock', {
          p_id: item.product_id,
          quantity: -item.quantity
        });

        if (stockError) {
          console.error('Error updating stock for product', item.product_id, ':', stockError);
          // Continue processing - don't fail the order if stock update fails
        }
      }

      res.status(201).json(order);
    } catch (error: any) {
      console.error('Error in createOrder:', error);
      res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
  },

  // Get all orders for a customer
  async getCustomerOrders(req: Request, res: Response) {
    try {
      const { id: customer_id } = req.params;
      const sales_executive_id = req.user?.id;

      // First get the customer details to get the user_id
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, user_id')
        .eq('id', customer_id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Use the customer's user_id to query orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('user_id', customer.user_id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }

      // Process orders to ensure they have all required fields for frontend
      const processedOrders = orders.map(order => {
        return {
          ...order,
          // Add order_number if not present (using a part of the ID as fallback)
          order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
          // Ensure status is never null
          status: order.status || 'pending',
          // Ensure payment_status is never null
          payment_status: order.payment_status || 'pending'
        };
      });

      res.json(processedOrders);
    } catch (error: any) {
      console.error('Error in getCustomerOrders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customer orders' });
    }
  },

  // Get order details
  async getOrder(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      const sales_executive_id = req.user?.id;

      // Find the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('id', order_id)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
        return res.status(404).json({ error: 'Order not found' });
      }

      // Verify the order belongs to a customer of this sales executive
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, sales_executive_id')
        .eq('user_id', order.user_id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        return res.status(404).json({ error: 'Customer for this order not found' });
      }

      if (customer.sales_executive_id !== sales_executive_id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Add customer info to the order
      const orderWithCustomer = {
        ...order,
        customer
      };

      res.json(orderWithCustomer);
    } catch (error: any) {
      console.error('Error in getOrder:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch order details' });
    }
  },

  // Update order status
  async updateOrderStatus(req: Request, res: Response) {
    try {
      const { order_id } = req.params;
      const { status } = req.body;
      const sales_executive_id = req.user?.id;

      // Verify the order belongs to a customer of this sales executive
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          customer:customers!orders_user_id_fkey (
            sales_executive_id
          )
        `)
        .eq('id', order_id)
        .single();

      if (orderError) throw orderError;

      const customer = (order as unknown as { customer: { sales_executive_id: string } }).customer;
      if (customer.sales_executive_id !== sales_executive_id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', order_id)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}; 