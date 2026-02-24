import { supabaseAdmin } from '../../lib/supabase';
import { ApiError } from '../../middleware/error';

/**
 * InventoryService - Handles stock movements and inventory logic
 * Retail baseline: SALE reduces stock, RETURN increases stock
 * 
 * CORE RULE: variantId is MANDATORY for all inventory operations
 * Every product has at least one variant (DEFAULT variant), so inventory is tracked
 * at warehouse × product × variant level.
 */
export class InventoryService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Record a stock movement
   * This is the single source of truth for inventory changes
   * 
   * @param params - Stock movement parameters
   * @param params.variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
   */
  async recordStockMovement(params: {
    productId: string;
    variantId: string; // MANDATORY - no longer nullable
    outletId: string;
    movementType:
      | 'SALE'
      | 'RETURN'
      | 'PURCHASE'
      | 'ADJUSTMENT'
      | 'ADJUSTMENT_IN'
      | 'ADJUSTMENT_OUT'
      | 'TRANSFER'
      | 'RECEIPT';
    quantity: number; // positive for increase, negative for decrease
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
    sourceType?: 'sales' | 'purchase' | 'return' | 'transfer' | 'adjustment' | 'receipt';
  }): Promise<string> {
    const {
      productId,
      variantId,
      outletId,
      movementType,
      quantity,
      referenceType,
      referenceId,
      notes,
      createdBy,
    } = params;

    if (!variantId) {
      throw new ApiError(400, 'variantId is required for stock movements');
    }

    if (quantity === 0) {
      throw new ApiError(400, 'Quantity cannot be zero');
    }

    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        product_id: productId,
        variant_id: variantId, // Now required
        outlet_id: outletId,
        movement_type: movementType,
        quantity,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        notes: notes || null,
        company_id: this.companyId,
        created_by: createdBy || null,
        source_type: params.sourceType || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error recording stock movement:', error);
      throw new ApiError(500, `Failed to record stock movement: ${error.message}`);
    }

    // Update warehouse_inventory stock_count (calculated from movements)
    await this.updateWarehouseInventory(productId, variantId, outletId);

    return data.id;
  }

  /**
   * Calculate current stock from stock_movements
   * 
   * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
   */
  async getCurrentStock(
    productId: string,
    outletId: string,
    variantId: string // MANDATORY - no longer nullable
  ): Promise<number> {
    if (!variantId) {
      throw new ApiError(400, 'variantId is required to get current stock');
    }

    const { data, error } = await supabaseAdmin
      .from('stock_movements')
      .select('quantity')
      .eq('product_id', productId)
      .eq('outlet_id', outletId)
      .eq('variant_id', variantId) // Now required
      .eq('company_id', this.companyId);

    if (error) {
      console.error('Error getting current stock:', error);
      throw new ApiError(500, `Failed to get current stock: ${error.message}`);
    }

    if (!data) {
      return 0;
    }

    // Sum all movements
    return data.reduce((sum, movement) => sum + movement.quantity, 0);
  }

  /**
   * Reserve stock for pending orders
   * Moves stock from available to reserved
   * 
   * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
   */
  async reserveStock(
    productId: string,
    outletId: string,
    quantity: number,
    variantId: string // MANDATORY - no longer nullable
  ): Promise<void> {
    if (!variantId) {
      throw new ApiError(400, 'variantId is required to reserve stock');
    }

    if (quantity <= 0) {
      throw new ApiError(400, 'Quantity must be positive');
    }

    const currentStock = await this.getCurrentStock(productId, outletId, variantId);
    const { data: inventory } = await supabaseAdmin
      .from('warehouse_inventory')
      .select('reserved_stock')
      .eq('product_id', productId)
      .eq('warehouse_id', outletId)
      .eq('variant_id', variantId) // Now required
      .eq('company_id', this.companyId)
      .maybeSingle();

    const reservedStock = inventory?.reserved_stock || 0;
    const availableStock = currentStock - reservedStock;

    if (availableStock < quantity) {
      throw new ApiError(400, `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Update reserved_stock in warehouse_inventory
    const { error } = await supabaseAdmin
      .from('warehouse_inventory')
      .upsert(
        {
          product_id: productId,
          warehouse_id: outletId,
          variant_id: variantId, // Now required
          company_id: this.companyId,
          reserved_stock: reservedStock + quantity,
        },
        {
          onConflict: 'warehouse_id,product_id,variant_id', // Updated constraint
        }
      );

    if (error) {
      console.error('Error reserving stock:', error);
      throw new ApiError(500, `Failed to reserve stock: ${error.message}`);
    }
  }

  /**
   * Release reserved stock back to available
   * 
   * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
   */
  async releaseStock(
    productId: string,
    outletId: string,
    quantity: number,
    variantId: string // MANDATORY - no longer nullable
  ): Promise<void> {
    if (!variantId) {
      throw new ApiError(400, 'variantId is required to release stock');
    }

    if (quantity <= 0) {
      throw new ApiError(400, 'Quantity must be positive');
    }

    const { data: inventory } = await supabaseAdmin
      .from('warehouse_inventory')
      .select('reserved_stock')
      .eq('product_id', productId)
      .eq('warehouse_id', outletId)
      .eq('variant_id', variantId) // Now required
      .eq('company_id', this.companyId)
      .maybeSingle();

    const reservedStock = inventory?.reserved_stock || 0;
    const newReservedStock = Math.max(0, reservedStock - quantity);

    const { error } = await supabaseAdmin
      .from('warehouse_inventory')
      .upsert(
        {
          product_id: productId,
          warehouse_id: outletId,
          variant_id: variantId, // Now required
          company_id: this.companyId,
          reserved_stock: newReservedStock,
        },
        {
          onConflict: 'warehouse_id,product_id,variant_id', // Updated constraint
        }
      );

    if (error) {
      console.error('Error releasing stock:', error);
      throw new ApiError(500, `Failed to release stock: ${error.message}`);
    }
  }

  /**
   * Update warehouse_inventory stock_count from stock_movements
   * This maintains consistency between stock_movements and warehouse_inventory
   * 
   * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
   */
  private async updateWarehouseInventory(
    productId: string,
    variantId: string, // MANDATORY - no longer nullable
    outletId: string
  ): Promise<void> {
    if (!variantId) {
      throw new ApiError(400, 'variantId is required to update warehouse inventory');
    }

    const currentStock = await this.getCurrentStock(productId, outletId, variantId);

    const { error } = await supabaseAdmin
      .from('warehouse_inventory')
      .upsert(
        {
          product_id: productId,
          warehouse_id: outletId,
          variant_id: variantId, // Now required
          company_id: this.companyId,
          stock_count: currentStock,
        },
        {
          onConflict: 'warehouse_id,product_id,variant_id', // Updated constraint
        }
      );

    if (error) {
      console.error('Error updating warehouse inventory:', error);
      throw new ApiError(500, `Failed to update warehouse inventory: ${error.message}`);
    }
  }

  /**
   * Handle order stock movement (sales or return)
   * Retail logic: sales reduces stock, return increases stock
   * 
   * @param items - Order items with MANDATORY variantId
   */
  async handleOrderStockMovement(
    orderId: string,
    orderType: 'sales' | 'return',
    items: Array<{
      productId: string;
      variantId: string; // MANDATORY - no longer nullable
      outletId: string;
      quantity: number;
    }>
  ): Promise<void> {
    const isReturn = orderType === 'return';
    const movementType: 'RETURN' | 'SALE' = isReturn ? 'RETURN' : 'SALE';

    for (const item of items) {
      if (!item.variantId) {
        throw new ApiError(400, `variantId is required for product ${item.productId} in order ${orderId}`);
      }

      const quantity = isReturn ? item.quantity : -item.quantity;

      await this.recordStockMovement({
        productId: item.productId,
        variantId: item.variantId, // Now required
        outletId: item.outletId,
        movementType,
        quantity,
        referenceType: 'order',
        referenceId: orderId,
        sourceType: isReturn ? 'return' : 'sales',
        notes: `${orderType} order ${orderId}`,
      });
    }
  }

  /**
   * Handle purchase stock movements from GRN / procurement
   * Always increases stock count.
   */
  async handlePurchaseStockMovement(
    referenceId: string,
    items: Array<{
      productId: string;
      variantId: string;
      outletId: string;
      quantity: number;
    }>
  ): Promise<void> {
    for (const item of items) {
      if (!item.variantId) {
        throw new ApiError(
          400,
          `variantId is required for product ${item.productId} in purchase reference ${referenceId}`
        );
      }

      if (item.quantity <= 0) {
        continue;
      }

      await this.recordStockMovement({
        productId: item.productId,
        variantId: item.variantId,
        outletId: item.outletId,
        movementType: 'PURCHASE',
        quantity: item.quantity,
        referenceType: 'goods_receipt',
        referenceId,
        sourceType: 'purchase',
        notes: `Purchase GRN ${referenceId}`,
      });
    }
  }

  /**
   * Get reserved stock for a variant
   * 
   * @param variantId - MANDATORY: Variant ID
   */
  async getReservedStock(
    productId: string,
    outletId: string,
    variantId: string
  ): Promise<number> {
    if (!variantId) {
      throw new ApiError(400, 'variantId is required to get reserved stock');
    }

    const { data: inventory } = await supabaseAdmin
      .from('warehouse_inventory')
      .select('reserved_stock')
      .eq('product_id', productId)
      .eq('warehouse_id', outletId)
      .eq('variant_id', variantId)
      .eq('company_id', this.companyId)
      .maybeSingle();

    return inventory?.reserved_stock || 0;
  }

  /**
   * Adjust stock to reconcile physical count with system count
   * Creates single movement: ADJUSTMENT_IN (if physical > system) or ADJUSTMENT_OUT (if physical < system)
   * 
   * Adjustment Math:
   * - difference = physical_quantity - system_stock_count
   * - If difference > 0: ADJUSTMENT_IN with quantity = difference
   * - If difference < 0: ADJUSTMENT_OUT with quantity = difference (stored as negative)
   * - If difference = 0: No movement created (already reconciled)
   * 
   * Uses PostgreSQL RPC function for atomic transaction safety.
   * 
   * @param params - Adjustment parameters
   * @returns Movement ID, difference, and new stock count
   */
  async adjustStock(params: {
    warehouseId: string;
    productId: string;
    variantId: string;
    physicalQuantity: number; // Physical count from warehouse
    reason: string; // Reason for adjustment (damage, found, miscount, etc.)
    createdBy?: string;
  }): Promise<{ movementId: string | null; difference: number; newStockCount: number }> {
    const {
      warehouseId,
      productId,
      variantId,
      physicalQuantity,
      reason,
      createdBy,
    } = params;

    // Validate inputs
    if (!variantId) {
      throw new ApiError(400, 'variantId is required for stock adjustment');
    }

    if (physicalQuantity < 0) {
      throw new ApiError(400, 'Physical quantity cannot be negative');
    }

    if (!reason || reason.trim() === '') {
      throw new ApiError(400, 'Reason is required for stock adjustment');
    }

    // Call RPC function for atomic operation
    const { data, error } = await supabaseAdmin.rpc('adjust_stock', {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_variant_id: variantId,
      p_physical_quantity: physicalQuantity,
      p_reason: reason.trim(),
      p_company_id: this.companyId,
      p_created_by: createdBy || null,
    });

    if (error) {
      console.error('Error adjusting stock:', error);
      // Convert PostgreSQL error messages to user-friendly errors
      const errorMessage = error.message || 'Failed to adjust stock';
      if (errorMessage.includes('not found') || errorMessage.includes('does not belong')) {
        throw new ApiError(404, errorMessage);
      }
      throw new ApiError(500, errorMessage);
    }

    if (!data) {
      throw new ApiError(500, 'No data returned from stock adjustment');
    }

    return {
      movementId: data.movement_id || null,
      difference: data.difference || 0,
      newStockCount: data.new_stock_count || physicalQuantity,
    };
  }

  /**
   * Transfer stock between warehouses
   * Creates TWO movements: TRANSFER_OUT (source) and TRANSFER_IN (destination)
   * Both movements share same reference_id for traceability
   * 
   * Transfer Math (per item):
   * - Source warehouse: TRANSFER_OUT with quantity = -item.quantity (negative)
   * - Destination warehouse: TRANSFER_IN with quantity = +item.quantity (positive)
   * - Update source warehouse_inventory: stock_count -= quantity
   * - Update destination warehouse_inventory: stock_count += quantity (UPSERT)
   * 
   * Uses PostgreSQL RPC function for atomic transaction safety.
   * Prevents negative stock in source warehouse.
   * 
   * @param params - Transfer parameters
   * @returns Transfer ID and movement details
   */
  async transferStock(params: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
    }>;
    notes?: string;
    createdBy?: string;
  }): Promise<{ transferId: string; movements: Array<{ productId: string; variantId: string; quantity: number; transferOutId: string; transferInId: string }> }> {
    const {
      sourceWarehouseId,
      destinationWarehouseId,
      items,
      notes,
      createdBy,
    } = params;

    // Validate inputs
    if (sourceWarehouseId === destinationWarehouseId) {
      throw new ApiError(400, 'Source and destination warehouses cannot be the same');
    }

    if (!items || items.length === 0) {
      throw new ApiError(400, 'Items array cannot be empty');
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || !item.variantId) {
        throw new ApiError(400, 'Each item must have productId and variantId');
      }
      if (!item.variantId) {
        throw new ApiError(400, 'variantId is required for all transfer items');
      }
      if (item.quantity <= 0) {
        throw new ApiError(400, 'Transfer quantity must be greater than 0');
      }
    }

    // Prepare items JSONB for RPC
    const itemsJsonb = items.map(item => ({
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
    }));

    // Call RPC function for atomic operation
    const { data, error } = await supabaseAdmin.rpc('transfer_stock', {
      p_source_warehouse_id: sourceWarehouseId,
      p_destination_warehouse_id: destinationWarehouseId,
      p_items: itemsJsonb,
      p_notes: notes || null,
      p_company_id: this.companyId,
      p_created_by: createdBy || null,
    });

    if (error) {
      console.error('Error transferring stock:', error);
      // Convert PostgreSQL error messages to user-friendly errors
      const errorMessage = error.message || 'Failed to transfer stock';
      if (errorMessage.includes('cannot be the same')) {
        throw new ApiError(400, errorMessage);
      }
      if (errorMessage.includes('Insufficient stock')) {
        throw new ApiError(400, errorMessage);
      }
      if (errorMessage.includes('not found') || errorMessage.includes('does not belong')) {
        throw new ApiError(404, errorMessage);
      }
      throw new ApiError(500, errorMessage);
    }

    if (!data) {
      throw new ApiError(500, 'No data returned from stock transfer');
    }

    // Transform response to match expected format
    const movements = (data.movements || []).map((m: any) => ({
      productId: m.product_id,
      variantId: m.variant_id,
      quantity: m.quantity,
      transferOutId: m.transfer_out_id,
      transferInId: m.transfer_in_id,
    }));

    return {
      transferId: data.transfer_id,
      movements,
    };
  }
}

