import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { getDefaultWarehouseId, findWarehouseWithStock } from '../utils/warehouseInventory';
import { ProductService } from '../services/core/ProductService';
import { InventoryService } from '../services/core/InventoryService';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface OrderItemInput {
  product_id: string;
  quantity: number;
  price: number;
  unit_price?: number; // Add unit_price as an optional field
  product_name?: string; // Optional field for frontend
  warehouse_id?: string; // Warehouse ID for this item
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

      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }

      // Verify the customer belongs to this sales executive
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, user_id, current_credit, credit_limit, sales_executive_id')
        .eq('id', customer_id)
        .eq('company_id', req.companyId)
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

      // Calculate order total amount using variant pricing
      console.log('Calculating order total for items:', items);
      let subtotal = 0;
      const productServiceForPricing = new ProductService(req.companyId!);
      
      for (const item of items as OrderItemInput[]) {
        let priceToUse = 0;
        
        // If variant_id provided, use variant pricing
        if ((item as any).variant_id) {
          try {
            priceToUse = await productServiceForPricing.getVariantPrice((item as any).variant_id);
          } catch (variantError) {
            console.error('Variant lookup error:', variantError);
            return res.status(404).json({ 
              error: `Variant ${(item as any).variant_id} not found: ${variantError instanceof Error ? variantError.message : 'Unknown error'}` 
            });
        }
        } else {
          // Default to DEFAULT variant pricing
          try {
            const defaultVariant = await productServiceForPricing.getDefaultVariant(item.product_id);
            priceToUse = await productServiceForPricing.getVariantPrice(defaultVariant.id);
          } catch (productError) {
            console.error('Product/Variant lookup error:', productError);
            return res.status(404).json({ 
              error: `Product ${item.product_id} not found or has no default variant: ${productError instanceof Error ? productError.message : 'Unknown error'}` 
            });
          }
        }
        
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

      // Determine fulfillment type for sales executive order
      const fulfillmentType: 'delivery' | 'pickup' =
        shipping_address_id ? 'delivery' : 'pickup';

      // Create order record data object for better logging
      const orderData = {
        user_id: customer.user_id,
        company_id: req.companyId!,
        status: 'pending',
        shipping_address_id,
        billing_address_id,
        payment_method,
        total_amount: calculatedTotalAmount,
        notes,
        payment_status: orderPaymentStatus,
        order_type: 'sales',
        order_source: 'sales',
        fulfillment_type: fulfillmentType
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

      // Get variant prices for all items (use DEFAULT variant if variant_id not provided)
      const productPrices: Record<string, number> = {};
      const variantIds: Record<string, string> = {}; // Track variant_id for each product_id
      const productServiceForVariants = new ProductService(req.companyId!);
      
      for (const item of items as OrderItemInput[]) {
        let variantId = (item as any).variant_id;
        
        // If no variant_id provided, get DEFAULT variant
        if (!variantId) {
          try {
            const defaultVariant = await productServiceForVariants.getDefaultVariant(item.product_id);
            variantId = defaultVariant.id;
            variantIds[item.product_id] = variantId;
          } catch (error) {
            console.error('Error getting default variant:', error);
            await supabase.from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
            return res.status(500).json({ 
              error: `Failed to get default variant for product ${item.product_id}: ${error instanceof Error ? error.message : 'Unknown error'}` 
            });
          }
        } else {
          variantIds[item.product_id] = variantId;
        }
        
        // Get variant price
        try {
          const variantPrice = await productServiceForVariants.getVariantPrice(variantId);
          productPrices[item.product_id] = variantPrice;
        } catch (error) {
          console.error('Error getting variant price:', error);
          await supabase.from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
          return res.status(500).json({ 
            error: `Failed to get price for variant ${variantId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      }

      console.log('Variant prices for order items:', productPrices);

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

      // Get default warehouse if warehouse_id not provided for items
      const { data: defaultWarehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('code', 'WH-001')
        .eq('is_active', true)
        .eq('company_id', req.companyId)
        .single();

      const defaultWarehouseId = defaultWarehouse?.id;

      // Create order items with variant prices and variant_id
      const orderItems = (items as OrderItemInput[]).map(item => {
        // Use the price sent from frontend if available, otherwise fallback to variant prices
        const unitPrice = item.price || item.unit_price || productPrices[item.product_id];
        
        if (!unitPrice || isNaN(Number(unitPrice))) {
          console.error(`Missing or invalid price for product ${item.product_id}`, { 
            item_price: item.price,
            item_unit_price: item.unit_price,
            variant_price: productPrices[item.product_id],
            item: item
          });
          throw new Error(`Missing price for product ${item.product_id}`);
        }
        
        // Get variant_id (from request or from variantIds map)
        const variantId = (item as any).variant_id || variantIds[item.product_id];
        
        return {
          order_id: order.id,
          company_id: req.companyId!,
          product_id: item.product_id,
          variant_id: variantId || null, // Include variant_id in order items
          quantity: item.quantity,
          unit_price: unitPrice,
          warehouse_id: item.warehouse_id || defaultWarehouseId || null
        };
      });

      console.log('Final order items to insert:', JSON.stringify(orderItems, null, 2));

      // Reserve stock for all order items (move from stock_count to reserved_stock)
      const defaultWarehouseIdForReservation = await getDefaultWarehouseId(req.companyId!);
      
      const productServiceForReservation = new ProductService(req.companyId!);
      const inventoryService = new InventoryService(req.companyId!);
      const reservationErrors: string[] = [];
      for (const item of orderItems) {
        try {
          const warehouseId = item.warehouse_id || defaultWarehouseIdForReservation;
          if (!warehouseId) {
            reservationErrors.push(`No warehouse_id for product ${item.product_id}`);
            continue;
          }
          
          // Get variant_id (from order item or default variant)
          let variantId: string | undefined = (item as any).variant_id || variantIds[item.product_id];
          if (!variantId) {
          try {
              const defaultVariant = await productServiceForReservation.getDefaultVariant(item.product_id);
            variantId = defaultVariant.id;
          } catch (variantError) {
            reservationErrors.push(`Failed to get default variant for product ${item.product_id}`);
              continue;
            }
          }
          
          if (!variantId) {
            reservationErrors.push(`No variant_id found for product ${item.product_id}`);
            continue;
          }
          
          await inventoryService.reserveStock(
            item.product_id,
            warehouseId,
            item.quantity,
            variantId
          );
          
          console.log(`Stock reserved for product ${item.product_id} variant ${variantId} in warehouse ${warehouseId}: ${item.quantity}`);
        } catch (err: any) {
          console.error(`Error reserving stock for product ${item.product_id}:`, err);
          reservationErrors.push(`Failed to reserve stock for product ${item.product_id}: ${err.message}`);
        }
      }

      // If there were reservation errors, rollback the order
      if (reservationErrors.length > 0) {
        console.error('Stock reservation errors:', reservationErrors);
        await supabase.from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
        return res.status(400).json({ 
          error: 'Failed to reserve stock for some products',
          details: reservationErrors
        });
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        
        // Rollback stock reservations if order items creation fails
        for (const item of orderItems) {
          try {
            const warehouseId = item.warehouse_id || defaultWarehouseIdForReservation;
            if (warehouseId) {
              // Get default variant for the product
              let variantId: string;
              try {
                const defaultVariant = await productServiceForReservation.getDefaultVariant(item.product_id);
                variantId = defaultVariant.id;
              } catch (variantError) {
                console.error(`Error getting default variant for product ${item.product_id} during rollback:`, variantError);
                continue; // Skip this item if we can't get the variant
              }
              
              await inventoryService.releaseStock(
                item.product_id,
                warehouseId,
                item.quantity,
                variantId
              );
            }
          } catch (err) {
            console.error(`Error rolling back reservation for product ${item.product_id}:`, err);
          }
        }
        
        // Rollback by deleting the order if items creation fails
        await supabase.from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
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
              description: credit_details.description || `Credit for order ${order.id}`,
              company_id: req.companyId
            });

          if (creditError) {
            console.error('Error creating credit period:', creditError);
            return res.status(500).json({ error: `Failed to create credit period: ${creditError.message}` });
          }

          // Update customer's current credit
          const { error: updateCreditError } = await supabase
            .from('customers')
            .update({ current_credit: customer.current_credit + creditAmount })
            .eq('id', customer_id)
            .eq('company_id', req.companyId);

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

      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }

      console.log(`Fetching orders for customer ID: ${customer_id}`);

      // First get the customer details to get the user_id
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, user_id')
        .eq('id', customer_id)
        .eq('company_id', req.companyId)
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
            product:products (*),
            variant:product_variants (
              id,
              name,
              sku,
              price:product_prices!price_id (
                sale_price,
                mrp_price
              ),
              brand:brands (
                id,
                name,
                logo_url
              ),
              tax:taxes (
                id,
                name,
                rate
              )
            )
          ),
          credit_periods (*)
        `)
        .eq('user_id', customer.user_id)
        .eq('company_id', req.companyId)
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

      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }

      // Find the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*),
            variant:product_variants (
              id,
              name,
              sku,
              price:product_prices!price_id (
                sale_price,
                mrp_price
              ),
              brand:brands (
                id,
                name,
                logo_url
              ),
              tax:taxes (
                id,
                name,
                rate
              )
            )
          )
        `)
        .eq('id', order_id)
        .eq('company_id', req.companyId)
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
          .eq('company_id', req.companyId)
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
        .eq('company_id', req.companyId)
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

      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }

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
        .eq('company_id', req.companyId)
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
        .eq('company_id', req.companyId)
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
      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }
      
      const sales_executive_id = req.user?.id;

      // Get all customers for this sales executive (filtered by company_id)
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, user_id, name')
        .eq('sales_executive_id', sales_executive_id)
        .eq('company_id', req.companyId);

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        return res.status(500).json({ error: 'Failed to fetch customers' });
      }

      if (!customers || customers.length === 0) {
        return res.json([]); // Return empty array if no customers
      }

      // Get all orders for these customers (filtered by company_id)
      const customerUserIds = customers.map(c => c.user_id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*),
            variant:product_variants (
              id,
              name,
              sku,
              price:product_prices!price_id (
                sale_price,
                mrp_price
              ),
              brand:brands (
                id,
                name,
                logo_url
              ),
              tax:taxes (
                id,
                name,
                rate
              )
            )
          )
        `)
        .in('user_id', customerUserIds)
        .eq('company_id', req.companyId)
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
            .eq('company_id', req.companyId)
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