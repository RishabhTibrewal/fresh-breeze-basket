import { supabaseAdmin } from '../../lib/supabase';
import { InventoryService } from './InventoryService';
import { PricingService } from './PricingService';
import { PaymentService } from './PaymentService';
import { ProductService } from './ProductService';

export interface CreateOrderItem {
  productId: string;
  variantId?: string | null; // Optional - will use DEFAULT variant if not provided
  quantity: number;
  unitPrice: number;
  outletId?: string;
}

export interface CreateOrderContext {
  userId?: string | null;
  outletId?: string | null;
  industryContext?: 'retail' | 'restaurant' | 'service';
  // Business-level order type used in orders table
  // - sales: customer sales orders
  // - purchase: purchase-side orders (from invoices)
  // - return: returns against original orders
  orderType?: 'sales' | 'purchase' | 'return';
  // Where the order originated from
  orderSource?: 'ecommerce' | 'pos' | 'sales' | 'internal';
  // How the order will be fulfilled
  fulfillmentType?: 'delivery' | 'pickup' | 'cash_counter';
  // For return orders, link back to original order
  originalOrderId?: string | null;
}

export interface CreateOrderData {
  items: CreateOrderItem[];
  shippingAddressId?: string | null;
  billingAddressId?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  totalAmount?: number;
  notes?: string;
  paymentIntentId?: string;
}

/**
 * OrderService - Industry-agnostic order management
 * Handles order creation, status updates, and retrieval
 * Uses industry_context to determine behavior
 */
export class OrderService {
  private companyId: string;
  private inventoryService: InventoryService;
  private pricingService: PricingService;
  private paymentService: PaymentService;
  private productService: ProductService;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.inventoryService = new InventoryService(companyId);
    this.pricingService = new PricingService(companyId);
    this.paymentService = new PaymentService(companyId);
    this.productService = new ProductService(companyId);
  }

  /**
   * Create a new order (industry-agnostic)
   */
  async createOrder(
    data: CreateOrderData,
    context: CreateOrderContext
  ): Promise<{ id: string; orderNumber: string }> {
    try {
      const {
        items,
        shippingAddressId,
        billingAddressId,
        paymentMethod = 'cash',
        paymentStatus = 'pending',
        totalAmount,
        notes,
        paymentIntentId,
      } = data;

      const {
        userId = null,
        outletId = null,
        industryContext = 'retail',
        orderType = 'sales',
        orderSource = 'ecommerce',
        fulfillmentType = 'delivery',
        originalOrderId = null,
      } = context;

      if (!items || items.length === 0) {
        throw new Error('No items provided');
      }

      // Validate and calculate totals
      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      const validatedItems: Array<CreateOrderItem & { taxAmount: number }> = [];

      for (const item of items) {
        // Validate product exists
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('id, name')
          .eq('id', item.productId)
          .eq('company_id', this.companyId)
          .single();

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Get variantId - use provided or get DEFAULT variant
        let finalVariantId: string | null = item.variantId || null;
        if (!finalVariantId) {
          const defaultVariant = await this.productService.getDefaultVariant(item.productId);
          finalVariantId = defaultVariant.id;
        }

        // Validate price (optional - can be disabled for flexibility)
        const itemOutletId = item.outletId || outletId || null;
        const isValidPrice = await this.pricingService.validatePrice(
          item.productId,
          finalVariantId,
          itemOutletId,
          item.unitPrice
        );

        if (!isValidPrice) {
          console.warn(`Price validation failed for product ${item.productId}, but continuing`);
        }

        // Calculate tax
        const lineSubtotal = item.quantity * item.unitPrice;
        const { taxAmount } = await this.pricingService.calculateLineTotal(
          item.productId,
          item.quantity,
          item.unitPrice,
          finalVariantId
        );

        calculatedSubtotal += lineSubtotal;
        calculatedTax += taxAmount;

        validatedItems.push({
          ...item,
          variantId: finalVariantId, // Ensure variantId is set
          taxAmount: Math.round(taxAmount * 100) / 100,
        });
      }

      const finalTotal = totalAmount || calculatedSubtotal + calculatedTax;

      // Get default outlet if not provided
      let finalOutletId = outletId;
      if (!finalOutletId) {
        const { data: defaultWarehouse } = await supabaseAdmin
          .from('warehouses')
          .select('id')
          .eq('company_id', this.companyId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        finalOutletId = defaultWarehouse?.id || null;
      }

      // Reserve stock for sales orders (retail baseline)
      if (orderType === 'sales' && industryContext === 'retail') {
        for (const item of validatedItems) {
          const itemOutletId = item.outletId || finalOutletId;
          if (itemOutletId && item.variantId) {
            try {
              await this.inventoryService.reserveStock(
                item.productId,
                itemOutletId,
                item.quantity,
                item.variantId // Now required
              );
            } catch (error: any) {
              throw new Error(`Stock reservation failed: ${error.message}`);
            }
          }
        }
      }

      // Create order
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          user_id: userId,
          company_id: this.companyId,
          outlet_id: finalOutletId,
          order_type: orderType,
          industry_context: industryContext,
           order_source: orderSource,
           fulfillment_type: fulfillmentType,
           original_order_id: orderType === 'return' ? originalOrderId : null,
          total_amount: finalTotal,
          shipping_address_id: shippingAddressId || null,
          billing_address_id: billingAddressId || null,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_intent_id: paymentIntentId || null,
          status: 'pending',
          notes: notes || null,
          inventory_updated: false,
        })
        .select('id')
        .single();

      if (orderError) {
        // Rollback stock reservations
        if (orderType === 'sales' && industryContext === 'retail') {
          for (const item of validatedItems) {
            const itemOutletId = item.outletId || finalOutletId;
            if (itemOutletId && item.variantId) {
              await this.inventoryService.releaseStock(
                item.productId,
                itemOutletId,
                item.quantity,
                item.variantId // Now required
              );
            }
          }
        }
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Create order items
      const orderItems = validatedItems.map(item => ({
        order_id: order.id,
        company_id: this.companyId,
        product_id: item.productId,
        variant_id: item.variantId, // Now required (DEFAULT variant if not provided)
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_amount: item.taxAmount,
        warehouse_id: item.outletId || finalOutletId,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        // Rollback order and stock reservations
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        if (orderType === 'sales' && industryContext === 'retail') {
          for (const item of validatedItems) {
            const itemOutletId = item.outletId || finalOutletId;
            if (itemOutletId && item.variantId) {
              await this.inventoryService.releaseStock(
                item.productId,
                itemOutletId,
                item.quantity,
                item.variantId // Now required
              );
            }
          }
        }
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      // Process payment if payment_intent_id is provided
      if (paymentIntentId && paymentStatus === 'paid') {
        await this.paymentService.processPayment({
          orderId: order.id,
          amount: finalTotal,
          paymentMethod,
          status: 'completed',
          stripePaymentIntentId: paymentIntentId,
        });
      }

      // Generate order number
      const orderNumber = `ORD-${order.id.substring(0, 8).toUpperCase()}`;

      return {
        id: order.id,
        orderNumber,
      };
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    options?: {
      trackingNumber?: string;
      estimatedDelivery?: string;
      notes?: string;
      paymentStatus?: string;
      paymentMethod?: string;
    }
  ): Promise<boolean> {
    try {
      // Get current order
      const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .eq('company_id', this.companyId)
        .single();

      if (!currentOrder) {
        throw new Error('Order not found');
      }

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (options?.trackingNumber) {
        updateData.tracking_number = options.trackingNumber;
      }
      if (options?.estimatedDelivery) {
        updateData.estimated_delivery = options.estimatedDelivery;
      }
      if (options?.notes) {
        updateData.notes = options.notes;
      }
      if (options?.paymentStatus) {
        updateData.payment_status = options.paymentStatus;
      }
      if (options?.paymentMethod) {
        updateData.payment_method = options.paymentMethod;
      }

      // Handle inventory updates for retail sales orders AND return orders
      if (
        currentOrder.industry_context === 'retail' &&
        (currentOrder.order_type === 'sales' || currentOrder.order_type === 'return') &&
        status !== 'pending' &&
        status !== 'cancelled' &&
        !currentOrder.inventory_updated
      ) {
        // Record stock movement - ensure variant_id exists for each item
        const items = await Promise.all(
          currentOrder.order_items.map(async (item: any) => {
            let variantId = item.variant_id;
            if (!variantId) {
              // Get DEFAULT variant if variant_id is missing (for old orders)
              const defaultVariant = await this.productService.getDefaultVariant(item.product_id);
              variantId = defaultVariant.id;
            }
            return {
              productId: item.product_id,
              variantId,
              outletId: item.warehouse_id || currentOrder.outlet_id,
              quantity: item.quantity,
            };
          })
        );

        // For return orders, stock increases (positive quantity)
        // For sales orders, stock decreases (negative quantity)
        await this.inventoryService.handleOrderStockMovement(orderId, currentOrder.order_type, items);

        // Release reserved stock (only for sales orders, not returns)
        if (currentOrder.order_type === 'sales') {
          for (const item of currentOrder.order_items) {
            const outletId = item.warehouse_id || currentOrder.outlet_id;
            if (outletId) {
              let variantId = item.variant_id;
              if (!variantId) {
                const defaultVariant = await this.productService.getDefaultVariant(item.product_id);
                variantId = defaultVariant.id;
              }
              await this.inventoryService.releaseStock(
                item.product_id,
                outletId,
                item.quantity,
                variantId
              );
            }
          }
        }

        updateData.inventory_updated = true;
      }

      // Update order
      const { error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('company_id', this.companyId);

      if (error) {
        throw new Error(`Failed to update order: ${error.message}`);
      }

      return true;
    } catch (error: any) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (*),
            variant:product_variants (*)
          ),
          outlet:warehouses (*)
        `)
        .eq('id', orderId)
        .eq('company_id', this.companyId)
        .single();

      if (error || !data) {
        throw new Error('Order not found');
      }

      return data;
    } catch (error: any) {
      console.error('Error getting order:', error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = await this.getOrderById(orderId);

      // Release reserved stock if order was pending sales order
      if (order.status === 'pending' && order.order_type === 'sales' && order.industry_context === 'retail') {
        for (const item of order.order_items) {
          const outletId = item.warehouse_id || order.outlet_id;
          if (outletId) {
            let variantId = item.variant_id;
            if (!variantId) {
              // Get DEFAULT variant if variant_id is missing (for old orders)
              const defaultVariant = await this.productService.getDefaultVariant(item.product_id);
              variantId = defaultVariant.id;
            }
            await this.inventoryService.releaseStock(
              item.product_id,
              outletId,
              item.quantity,
              variantId
            );
          }
        }
      }

      // Reverse stock movement if processed sales order
      if (order.inventory_updated && order.order_type === 'sales' && order.industry_context === 'retail') {
        const items = await Promise.all(
          order.order_items.map(async (item: any) => {
            let variantId = item.variant_id;
            if (!variantId) {
              // Get DEFAULT variant if variant_id is missing (for old orders)
              const defaultVariant = await this.productService.getDefaultVariant(item.product_id);
              variantId = defaultVariant.id;
            }
            return {
              productId: item.product_id,
              variantId,
              outletId: item.warehouse_id || order.outlet_id,
              quantity: item.quantity,
            };
          })
        );

        // Create RETURN movement to reverse the SALE
        for (const item of items) {
          await this.inventoryService.recordStockMovement({
            productId: item.productId,
            variantId: item.variantId,
            outletId: item.outletId,
            movementType: 'RETURN',
            quantity: item.quantity,
            referenceType: 'order',
            referenceId: orderId,
            sourceType: 'return',
            notes: `Cancelled order ${orderId}`,
          });
        }
      }

      // Update order status
      await this.updateOrderStatus(orderId, 'cancelled', {
        notes: 'Order cancelled',
      });

      return true;
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }
}

