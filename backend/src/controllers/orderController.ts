import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { Database } from '../types/database';
import { getDefaultWarehouseId, findWarehouseWithStock } from '../utils/warehouseInventory';
import { ProductService } from '../services/core/ProductService';
import { InventoryService } from '../services/core/InventoryService';
import { PricingService } from '../services/core/PricingService';
import { PaymentService } from '../services/core/PaymentService';
import { hasAnyRole } from '../utils/roles';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface OrderItemInput {
  product_id: string;
  variant_id?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  discount_percentage?: number;
  discount_amount?: number;
  tax_percentage?: number;
  tax_amount?: number;
  line_total?: number;
  product_name?: string;
  warehouse_id?: string;
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
        total_amount,
        extra_discount_amount,
        extra_discount_percentage,
        transaction_id,
        cheque_no,
        payment_date,
        sales_executive_id: bodySalesExecutiveId,
        quotation_id
      } = req.body;

      // Log the received payment_status from frontend
      console.log('Payment status from frontend:', payment_status);

      const userId = req.user?.id;
      console.log('User ID:', userId);
      console.log('Customer ID:', customer_id);

      if (!req.companyId) {
        return res.status(400).json({ error: 'Company context is required' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Resolve sales_executive_id for order: from body, or default to current user if they have sales role
      let orderSalesExecutiveId: string | null = null;
      if (bodySalesExecutiveId && typeof bodySalesExecutiveId === 'string' && bodySalesExecutiveId.trim() !== '') {
        orderSalesExecutiveId = bodySalesExecutiveId.trim();
      } else {
        const userIsSales = await hasAnyRole(userId, req.companyId!, ['sales']);
        if (userIsSales) {
          orderSalesExecutiveId = userId;
        }
      }
      console.log('Order sales_executive_id:', orderSalesExecutiveId);

      // Verify the customer belongs to this sales executive
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
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

      // Calculate order total amount and items total from frontend provided values
      // We sum up the line_total from items to use as the base for extra discount
      const itemTotalPromise = (items as OrderItemInput[]).reduce((sum, item) => sum + (item.line_total || 0), 0);
      const projectedItemTotal = itemTotalPromise;
      
      console.log('Projected item total from line totals:', projectedItemTotal);

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

      // Initial total amount calculation
      // Note: extra_discount_percentage should apply to line-item-total (incl tax/disc), not raw subtotal
      const orderExtraDiscPct = extra_discount_percentage || 0;
      const orderExtraDiscAmt = extra_discount_amount != null
        ? extra_discount_amount
        : parseFloat(((projectedItemTotal * orderExtraDiscPct) / 100).toFixed(2));

      const initialTotalAmount = total_amount || (projectedItemTotal - orderExtraDiscAmt);
      console.log('Initial total_amount (will be recalculated from items):', initialTotalAmount);

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
        // Calculate the credit amount for this order (use initialTotalAmount for credit limit check)
        const creditAmount = isFullCreditForLimitCheck
          ? initialTotalAmount
          : (initialTotalAmount - (partial_payment_amount || 0));
        
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

      // Compute formula columns for the orders header
      // These variables (orderExtraDiscPct, orderExtraDiscAmt) were already calculated above using projectedItemTotal


      // Create order record data object for better logging
      const orderData = {
        user_id: customer.user_id,
        company_id: req.companyId!,
        status: 'pending',
        shipping_address_id,
        billing_address_id,
        payment_method,
        subtotal: subtotal,
        total_tax: 0,
        total_discount: 0,
        extra_discount_percentage: orderExtraDiscPct,
        extra_discount_amount: orderExtraDiscAmt,
        total_amount: initialTotalAmount, // Will be updated after order items are created
        notes,
        payment_status: orderPaymentStatus,
        order_type: 'sales',
        order_source: 'sales',
        fulfillment_type: fulfillmentType,
        ...(orderSalesExecutiveId != null && { sales_executive_id: orderSalesExecutiveId }),
        ...(quotation_id && { quotation_id })
      };
      
      console.log('Order data being inserted:', JSON.stringify(orderData, null, 2));

      // Create order - use customer.user_id instead of customer_id for user_id field
      const { data: order, error: orderError } = await (supabaseAdmin || supabase)
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
      const pricingService = new PricingService(req.companyId!);
      
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
            await (supabaseAdmin || supabase).from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
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
          await (supabaseAdmin || supabase).from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
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
      const { data: defaultWarehouse } = await (supabaseAdmin || supabase)
        .from('warehouses')
        .select('id')
        .eq('code', 'WH-001')
        .eq('is_active', true)
        .eq('company_id', req.companyId)
        .single();

      const defaultWarehouseId = defaultWarehouse?.id;

      // Create order items with variant prices, variant_id and tax_amount
      const orderItems = await Promise.all(
        (items as OrderItemInput[]).map(async (item) => {
          // Use the price sent from frontend if available, otherwise fallback to variant prices
          const unitPrice = item.price || item.unit_price || productPrices[item.product_id];
          
          if (!unitPrice || isNaN(Number(unitPrice))) {
            console.error(`Missing or invalid price for product ${item.product_id}`, { 
              item_price: item.price,
              item_unit_price: item.unit_price,
              variant_price: productPrices[item.product_id],
              item: item,
            });
            throw new Error(`Missing price for product ${item.product_id}`);
          }
          
          // Get variant_id (from request or from variantIds map)
          const variantId = item.variant_id || variantIds[item.product_id];

          // Use provided values or calculate
          const taxPercentage = item.tax_percentage || 0;
          const discountPercentage = item.discount_percentage || 0;
          
          let taxAmount = item.tax_amount;
          if (taxAmount === undefined) {
            try {
              const result = await pricingService.calculateLineTotal(
                item.product_id,
                item.quantity,
                Number(unitPrice),
                variantId || null
              );
              taxAmount = result.taxAmount;
            } catch (err) {
              console.error(`Error calculating tax for product ${item.product_id}, falling back to 0`, err);
              taxAmount = 0;
            }
          }

          const amount = item.quantity * Number(unitPrice);
          const discountAmount = item.discount_amount !== undefined 
            ? item.discount_amount 
            : (amount * discountPercentage) / 100;
          
          const lineTotal = item.line_total !== undefined
            ? item.line_total
            : (amount + (taxAmount || 0) - (discountAmount || 0));
        
          return {
            order_id: order.id,
            company_id: req.companyId!,
            product_id: item.product_id,
            variant_id: variantId || null,
            quantity: item.quantity,
            unit_price: unitPrice,
            tax_percentage: taxPercentage,
            tax_amount: Math.round((taxAmount || 0) * 100) / 100,
            discount_percentage: discountPercentage,
            discount_amount: Math.round((discountAmount || 0) * 100) / 100,
            line_total: Math.round((lineTotal || 0) * 100) / 100,
            warehouse_id: item.warehouse_id || defaultWarehouseId || null,
          };
        })
      );

      console.log('Final order items to insert:', JSON.stringify(orderItems, null, 2));

      // Calculate actual total_amount from order items
      const itemSubtotalSum = orderItems.reduce((s, item) => s + (Number(item.quantity) * Number(item.unit_price)), 0);
      const itemTaxSum = orderItems.reduce((s, item) => s + (Number(item.tax_amount) || 0), 0);
      const itemDiscountSum = orderItems.reduce((s, item) => s + (Number(item.discount_amount) || 0), 0);
      
      const calculatedTotalFromItems = orderItems.reduce((s, item) => s + Number(item.line_total), 0);
      const shipping_fee = 0; // For future implementation
      
      // RE-CALCULATE extra discount amount based on ACTUAL calculated totals from items
      const finalExtraDiscAmt = (orderExtraDiscPct > 0)
        ? parseFloat(((calculatedTotalFromItems * orderExtraDiscPct) / 100).toFixed(2))
        : Number(extra_discount_amount || 0);

      const finalTotalAmount = calculatedTotalFromItems + shipping_fee - finalExtraDiscAmt;
      
      console.log('Calculated totals:', {
        itemSubtotalSum,
        itemTaxSum,
        itemDiscountSum,
        calculatedTotalFromItems,
        finalExtraDiscAmt,
        finalTotalAmount
      });
      
      // Update order with the calculated financial fields
      const { error: updateError } = await (supabaseAdmin || supabase)
        .from('orders')
        .update({
          subtotal: itemSubtotalSum,
          total_tax: itemTaxSum,
          total_discount: Math.round((itemDiscountSum + finalExtraDiscAmt) * 100) / 100,
          extra_discount_percentage: orderExtraDiscPct,
          extra_discount_amount: finalExtraDiscAmt,
          total_amount: Math.round(finalTotalAmount * 100) / 100
        })
        .eq('id', order.id)
        .eq('company_id', req.companyId);
      
      if (updateError) {
        console.error('Error updating order financial fields:', updateError);
      } else {
        order.total_amount = Math.round(finalTotalAmount * 100) / 100;
      }

      // Preserve calculatedTotalAmount for following logic (if needed)
      const calculatedTotalAmount = order.total_amount;

      // Reserve stock for all order items (move from stock_count to reserved_stock)
      // Note: For sales orders, stock reservation is non-blocking - inventory will be updated
      // when order status changes from 'pending' to next stage (see updateOrderStatus)
      const defaultWarehouseIdForReservation = await getDefaultWarehouseId(req.companyId!);
      
      if (!defaultWarehouseIdForReservation) {
        console.warn('No default warehouse found (WH-001). Stock reservation will be skipped. Inventory will be updated when order status changes.');
      }
      
      const productServiceForReservation = new ProductService(req.companyId!);
      const inventoryService = new InventoryService(req.companyId!);
      const reservationWarnings: string[] = [];
      
      for (const item of orderItems) {
        try {
          const warehouseId = item.warehouse_id || defaultWarehouseIdForReservation;
          if (!warehouseId) {
            reservationWarnings.push(`No warehouse_id for product ${item.product_id} - stock reservation skipped`);
            continue;
          }
          
          // Get variant_id (from order item or default variant)
          let variantId: string | undefined = (item as any).variant_id || variantIds[item.product_id];
          if (!variantId) {
          try {
              const defaultVariant = await productServiceForReservation.getDefaultVariant(item.product_id);
            variantId = defaultVariant.id;
          } catch (variantError) {
              reservationWarnings.push(`Failed to get default variant for product ${item.product_id} - stock reservation skipped`);
              continue;
            }
          }
          
          if (!variantId) {
            reservationWarnings.push(`No variant_id found for product ${item.product_id} - stock reservation skipped`);
            continue;
          }
          
          // For sales orders, allow negative stock (pre-orders, future delivery)
          await inventoryService.reserveStock(
            item.product_id,
            warehouseId,
            item.quantity,
            variantId,
            true // allowNegative = true for sales orders
          );
          
          console.log(`Stock reserved for product ${item.product_id} variant ${variantId} in warehouse ${warehouseId}: ${item.quantity}`);
        } catch (err: any) {
          // For sales orders, stock reservation failures are warnings, not errors
          // Inventory will be updated when order status changes
          console.warn(`Stock reservation warning for product ${item.product_id}: ${err.message}. Order will proceed - inventory will be updated when order status changes.`);
          reservationWarnings.push(`Stock reservation skipped for product ${item.product_id}: ${err.message}`);
        }
      }

      // Log warnings but don't block order creation
      // Sales orders allow negative stock - inventory is updated when order status changes
      if (reservationWarnings.length > 0) {
        console.warn('Stock reservation warnings (non-blocking for sales orders):', reservationWarnings);
      }

      const { error: itemsError } = await (supabaseAdmin || supabase)
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
        await (supabaseAdmin || supabase).from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
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
        // Calculate credit amount (use the final total amount from order)
        const currentOrderTotal = order.total_amount;
        const creditAmount = isFullCredit
          ? currentOrderTotal 
          : (currentOrderTotal - (partial_payment_amount || 0));
        
        if (creditAmount > 0 && credit_details) {
          console.log('Creating credit period for amount:', creditAmount);
          
          // Create credit period record
          const { error: creditError } = await (supabaseAdmin || supabase)
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
          const { error: updateCreditError } = await (supabaseAdmin || supabase)
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

      // Create payment record if order is created with full_payment or partial_payment
      if ((payment_status === 'full_payment' || payment_status === 'partial_payment') && order) {
        try {
          const paymentService = new PaymentService(req.companyId!);
          
          // Determine payment amount
          let paymentAmount = calculatedTotalAmount;
          if (payment_status === 'partial_payment' && partial_payment_amount) {
            paymentAmount = partial_payment_amount;
          }
          
          // Only create payment record if amount is greater than 0
          if (paymentAmount > 0) {
            const paymentId = await paymentService.processPayment({
              orderId: order.id,
              amount: paymentAmount,
              paymentMethod: payment_method || 'cash',
              status: 'completed',
              transactionId: transaction_id,
              chequeNo: cheque_no,
              paymentDate: payment_date,
              preserveOrderPaymentStatus: true, // Preserve the order's payment_status (partial/paid) set during creation
              paymentGatewayResponse: {
                source: 'order_creation',
                created_by: orderSalesExecutiveId,
                created_at: new Date().toISOString(),
                payment_type: payment_status === 'full_payment' ? 'full_payment' : 'partial_payment',
              },
              transactionReferences: {
                order_payment_status: payment_status,
                sales_order: true,
                created_at_order_creation: true
              }
            });
            
            if (paymentId) {
              console.log('Payment record created successfully during order creation:', paymentId);
            } else {
              console.error('Failed to create payment record during order creation');
            }
          }
        } catch (paymentError) {
          console.error('Error creating payment record during order creation:', paymentError);
          // Don't fail order creation if payment record creation fails
        }
      }

      // Handle quotation conversion if quotation_id was provided
      if (quotation_id) {
        console.log('Linking order to quotation:', quotation_id);
        const { error: quoteUpdateError } = await (supabaseAdmin || supabase)
          .from('quotations')
          .update({
             status: 'accepted',
             converted_to_order_id: order.id
          })
          .eq('id', quotation_id)
          .eq('company_id', req.companyId);

        if (quoteUpdateError) {
           console.error('Error updating quotation status:', quoteUpdateError);
        } else {
           // Also update the lead if it was attached
           const { data: quotationData } = await (supabaseAdmin || supabase)
             .from('quotations')
             .select('lead_id')
             .eq('id', quotation_id)
             .single();
             
           if (quotationData?.lead_id) {
             await (supabaseAdmin || supabase)
               .from('leads')
               .update({ stage: 'won', converted_at: new Date().toISOString() })
               .eq('id', quotationData.lead_id);
           }
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
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
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
      const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
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
      const { data: order, error: orderError } = await (supabaseAdmin || supabase)
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
        const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
          .from('credit_periods')
          .select('*')
          .eq('order_id', order_id)
          .eq('company_id', req.companyId)
          .single();
        
        if (!creditError && creditPeriod) {
          order.credit_details = creditPeriod;
        }
      }

      // Get customer info for the order (sales and admins can view any company order)
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id, name, sales_executive_id')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        return res.status(404).json({ error: 'Customer for this order not found' });
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

      // Verify order exists and belongs to company (sales and admins can update any company order)
      const { error: orderError } = await (supabaseAdmin || supabase)
        .from('orders')
        .select('id')
        .eq('id', order_id)
        .eq('company_id', req.companyId)
        .single();

      if (orderError) throw orderError;

      const { data: updatedOrder, error: updateError } = await (supabaseAdmin || supabase)
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
      
      // Get all company customers (sales and admins see all)
      const { data: customers, error: customersError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id, user_id, name')
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
      const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
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
          const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
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