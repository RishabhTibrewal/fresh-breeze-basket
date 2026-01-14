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

      // Log the received payment_status from frontend
      console.log('Payment status from frontend:', payment_status);

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

      console.log('Creating order with payment status:', payment_status);

      // Use the payment_status from the frontend directly if provided, otherwise determine based on payment_method
      // This ensures we respect what was explicitly set by the frontend
      let orderPaymentStatus = payment_status || 'pending';
      
      // Map frontend payment status to database values
      if (payment_status) {
        // Convert frontend values to database values
        if (payment_status === 'full_payment') {
          orderPaymentStatus = 'paid';
        } else if (payment_status === 'partial_payment') {
          orderPaymentStatus = 'partial';
        } else if (payment_status === 'full_credit') {
          orderPaymentStatus = 'credit';
        }
      } else {
        // Only use the conversion if payment_status was not provided from frontend
        if (payment_method === 'full_payment') {
          orderPaymentStatus = 'paid';
        } else if (payment_method === 'partial_payment') {
          orderPaymentStatus = 'partial';
        } else if (payment_method === 'full_credit') {
          orderPaymentStatus = 'credit';
        }
      }

      console.log('Creating order with final payment status:', orderPaymentStatus);

      // Check credit limit BEFORE creating the order (only if customer has a credit limit set)
      const isCreditOrder = orderPaymentStatus === 'credit' || orderPaymentStatus === 'partial';
      const isFullCreditForLimitCheck = orderPaymentStatus === 'credit';
      
      if (isCreditOrder && customer.credit_limit && customer.credit_limit > 0) {
        // Calculate the credit amount for this order
        const creditAmount = isFullCreditForLimitCheck
          ? calculatedTotalAmount
          : (calculatedTotalAmount - (partial_payment_amount || 0));
        
        // Calculate projected total credit after this order
        const currentCredit = parseFloat(customer.current_credit?.toString() || '0');
        const creditLimit = parseFloat(customer.credit_limit?.toString() || '0');
        const projectedCredit = currentCredit + creditAmount;
        
        console.log('Credit limit check:', {
          currentCredit,
          creditLimit,
          creditAmount,
          projectedCredit,
          isFullCredit: isFullCreditForLimitCheck
        });
        
        // Check if this order would exceed the credit limit
        if (projectedCredit > creditLimit) {
          console.error('Credit limit exceeded:', {
            currentCredit,
            creditLimit,
            creditAmount,
            projectedCredit
          });
          return res.status(400).json({ 
            error: 'Credit limit exceeded for this customer',
            details: {
              currentCredit: currentCredit.toFixed(2),
              creditLimit: creditLimit.toFixed(2),
              orderCreditAmount: creditAmount.toFixed(2),
              projectedTotal: projectedCredit.toFixed(2),
              availableCredit: Math.max(0, creditLimit - currentCredit).toFixed(2)
            }
          });
        }
      }

      // Create order record data object for better logging
      const orderData = {
        user_id: customer.user_id,
        status: 'pending',
        shipping_address_id,
        billing_address_id,
        payment_method,
        total_amount: calculatedTotalAmount,
        notes,
        payment_status: orderPaymentStatus
      };
      
      console.log('Order data being inserted:', JSON.stringify(orderData, null, 2));

      // Create order - use customer.user_id instead of customer_id for user_id field
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
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
      // Use payment_status first or fallback to payment_method
      const isCredit = payment_status === 'full_credit' || 
                      payment_status === 'partial_payment' || 
                      payment_method === 'full_credit' || 
                      payment_method === 'partial_payment';
                      
      const isFullCredit = payment_status === 'full_credit' || payment_method === 'full_credit';
      
      if (isCredit) {
        // Calculate credit amount
        const creditAmount = isFullCredit
          ? calculatedTotalAmount 
          : (calculatedTotalAmount - (partial_payment_amount || 0));
        
        if (creditAmount > 0 && credit_details) {
          console.log('Creating credit period for amount:', creditAmount);
          
          // Create credit period record
          const { error: creditError } = await supabase
            .from('credit_periods')
            .insert({
              customer_id,
              order_id: order.id,
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

      // Note: Inventory will be updated when order status changes from 'pending' to next stage
      // This allows negative stock for sales dashboard orders when status is updated
      // Inventory update is handled in updateOrderStatus function

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

      console.log(`Fetching orders for customer ID: ${customer_id}`);

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

      console.log(`Found customer user_id: ${customer.user_id}`);

      // Use the customer's user_id to query orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          ),
          credit_periods (*)
        `)
        .eq('user_id', customer.user_id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }

      console.log(`Found ${orders.length} orders for customer`);

      // Process orders to include credit details
      const processedOrders = orders.map(order => {
        // Get the first credit period if it exists
        const creditPeriod = order.credit_periods?.[0];
        
        console.log(`Order ${order.id} credit periods:`, order.credit_periods?.length || 0);
        
        // Remove the credit_periods array and add credit_details if exists
        const { credit_periods, ...orderWithoutCreditPeriods } = order;
        
        return {
          ...orderWithoutCreditPeriods,
          credit_details: creditPeriod || null,
          // Add order_number if not present (using a part of the ID as fallback)
          order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
          // Ensure status is never null
          status: order.status || 'pending',
          // Ensure payment_status is never null
          payment_status: order.payment_status || 'pending'
        };
      });

      console.log('Returning processed orders with credit details');
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

      // Get credit details if applicable
      if (order.payment_method === 'full_credit' || order.payment_method === 'partial_payment') {
        const { data: creditPeriod, error: creditError } = await supabase
          .from('credit_periods')
          .select('*')
          .eq('order_id', order_id)
          .single();
        
        if (!creditError && creditPeriod) {
          order.credit_details = creditPeriod;
        }
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
  },

  // Get all orders for sales executive's customers
  async getSalesOrders(req: Request, res: Response) {
    try {
      const sales_executive_id = req.user?.id;

      // Get all customers for this sales executive
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, user_id, name')
        .eq('sales_executive_id', sales_executive_id);

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        return res.status(500).json({ error: 'Failed to fetch customers' });
      }

      if (!customers || customers.length === 0) {
        return res.json([]); // Return empty array if no customers
      }

      // Get all orders for these customers
      const customerUserIds = customers.map(c => c.user_id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*)
          )
        `)
        .in('user_id', customerUserIds)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }

      // Fetch credit periods for relevant orders
      const ordersWithCredit = await Promise.all(orders.map(async (order) => {
        // Only fetch credit details for orders with credit
        if (order.payment_method === 'full_credit' || order.payment_method === 'partial_payment') {
          const { data: creditPeriod, error: creditError } = await supabase
            .from('credit_periods')
            .select('*')
            .eq('order_id', order.id)
            .single();
          
          if (!creditError && creditPeriod) {
            return {
              ...order,
              credit_details: creditPeriod
            };
          }
        }
        return order;
      }));

      // Add customer information to each order
      const ordersWithCustomer = ordersWithCredit.map(order => {
        const customer = customers.find(c => c.user_id === order.user_id);
        return {
          ...order,
          customer: customer ? {
            id: customer.id,
            name: customer.name
          } : null,
          // Add order_number if not present
          order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
          // Ensure status is never null
          status: order.status || 'pending',
          // Ensure payment_status is never null
          payment_status: order.payment_status || 'pending'
        };
      });

      res.json(ordersWithCustomer);
    } catch (error: any) {
      console.error('Error in getSalesOrders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  }
}; 