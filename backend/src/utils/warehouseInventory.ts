import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../config/supabase';

/**
 * Get stock count for a product variant in a specific warehouse
 * 
 * @deprecated Use InventoryService.getCurrentStock() instead
 * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
 */
export const getWarehouseStock = async (
  productId: string,
  warehouseId: string,
  variantId: string, // MANDATORY - no longer nullable
  companyId?: string
): Promise<number> => {
  if (!variantId) {
    throw new Error('variantId is required');
  }

  let query = supabase
    .from('warehouse_inventory')
    .select('stock_count')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return 0;
  }

  return data.stock_count || 0;
};

/**
 * Update stock count for a product variant in a specific warehouse
 * Returns the new stock count
 * 
 * @deprecated Use InventoryService.recordStockMovement() instead
 * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
 */
export const updateWarehouseStock = async (
  productId: string,
  warehouseId: string,
  variantId: string, // MANDATORY - no longer nullable
  quantityChange: number,
  companyId?: string,
  allowNegative: boolean = false,
  useAdminClient: boolean = false
): Promise<number> => {
  if (!variantId) {
    throw new Error('variantId is required');
  }

  const client = useAdminClient && supabaseAdmin ? supabaseAdmin : supabase;

  // Get current stock using the same client to avoid RLS issues
  let stockQuery = client
    .from('warehouse_inventory')
    .select('stock_count')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    stockQuery = stockQuery.eq('company_id', companyId);
  }

  const { data: currentData, error: currentError } = await stockQuery.maybeSingle();

  if (currentError) {
    console.error(`Error fetching warehouse stock for product ${productId} in warehouse ${warehouseId}:`, currentError);
    throw currentError;
  }

  const currentStock = currentData?.stock_count || 0;
  const newStockCount = allowNegative 
    ? currentStock + quantityChange 
    : Math.max(0, currentStock + quantityChange);

  // Upsert warehouse inventory
  const upsertPayload: Record<string, any> = {
    warehouse_id: warehouseId,
    product_id: productId,
    variant_id: variantId, // Now required
    stock_count: newStockCount,
    updated_at: new Date().toISOString()
  };

  if (companyId) {
    upsertPayload.company_id = companyId;
  }

  const { data, error } = await client
    .from('warehouse_inventory')
    .upsert(upsertPayload, {
      onConflict: 'warehouse_id,product_id,variant_id' // Updated constraint
    })
    .select('stock_count')
    .single();

  if (error) {
    console.error(`Error updating warehouse stock for product ${productId} in warehouse ${warehouseId}:`, error);
    throw error;
  }

  return data?.stock_count || 0;
};

/**
 * Get total stock across all warehouses for a product
 */
export const getTotalProductStock = async (
  productId: string,
  companyId?: string
): Promise<number> => {
  let query = supabase
    .from('warehouse_inventory')
    .select('stock_count')
    .eq('product_id', productId);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error getting total stock for product ${productId}:`, error);
    return 0;
  }

  return data?.reduce((sum, item) => sum + (item.stock_count || 0), 0) || 0;
};

/**
 * Find warehouse with available stock for a product
 * Returns warehouse_id or null if no stock available
 */
export const findWarehouseWithStock = async (
  productId: string,
  requiredQuantity: number,
  companyId?: string
): Promise<string | null> => {
  let query = supabase
    .from('warehouse_inventory')
    .select('warehouse_id, stock_count, warehouses!inner(is_active)')
    .eq('product_id', productId)
    .gte('stock_count', requiredQuantity)
    .eq('warehouses.is_active', true);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query
    .order('stock_count', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.warehouse_id;
};

/**
 * Get default warehouse ID (WH-001)
 */
export const getDefaultWarehouseId = async (companyId?: string): Promise<string | null> => {
  let query = supabase
    .from('warehouses')
    .select('id')
    .eq('code', 'WH-001')
    .eq('is_active', true);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    console.error('Error getting default warehouse:', error);
    return null;
  }

  return data.id;
};

/**
 * Reserve stock for an order (move from stock_count to reserved_stock)
 * Returns the new reserved_stock count
 * 
 * @deprecated Use InventoryService.reserveStock() instead
 * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
 */
export const reserveWarehouseStock = async (
  productId: string,
  warehouseId: string,
  variantId: string, // MANDATORY - no longer nullable
  quantity: number,
  companyId?: string,
  useAdminClient: boolean = false
): Promise<{ stock_count: number; reserved_stock: number }> => {
  if (!variantId) {
    throw new Error('variantId is required');
  }

  const client = useAdminClient && supabaseAdmin ? supabaseAdmin : supabase;

  // Get current inventory
  let inventoryQuery = client
    .from('warehouse_inventory')
    .select('stock_count, reserved_stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    inventoryQuery = inventoryQuery.eq('company_id', companyId);
  }

  const { data: currentInventory, error: fetchError } = await inventoryQuery.maybeSingle(); // Use maybeSingle() instead of single() to handle no rows gracefully

  // If inventory doesn't exist (PGRST116 or no data), create it with reserved stock
  if (fetchError?.code === 'PGRST116' || !currentInventory) {
    // If inventory doesn't exist, create it with negative stock_count for advance orders
    // Example: reserve 70 items → stock_count=-70, reserved_stock=70
    const upsertPayload: Record<string, any> = {
      warehouse_id: warehouseId,
      product_id: productId,
      variant_id: variantId, // Now required
      stock_count: -quantity, // Negative for advance orders when no inventory exists
      reserved_stock: quantity,
      updated_at: new Date().toISOString()
    };

    if (companyId) {
      upsertPayload.company_id = companyId;
    }

    const { data, error } = await client
      .from('warehouse_inventory')
      .upsert(upsertPayload, {
        onConflict: 'warehouse_id,product_id,variant_id' // Updated constraint
      })
      .select('stock_count, reserved_stock')
      .maybeSingle(); // Use maybeSingle() for better error handling

    if (error) {
      console.error(`Error creating warehouse inventory for product ${productId} in warehouse ${warehouseId}:`, error);
      throw error;
    }

    if (!data) {
      throw new Error(`Failed to create warehouse inventory for product ${productId} in warehouse ${warehouseId}`);
    }

    return { stock_count: data.stock_count || 0, reserved_stock: data.reserved_stock || 0 };
  }

  // If there's a different fetch error, throw it
  if (fetchError) {
    console.error(`Error fetching warehouse inventory for product ${productId} in warehouse ${warehouseId}:`, fetchError);
    throw fetchError;
  }

  const currentStock = currentInventory.stock_count || 0;
  const currentReserved = currentInventory.reserved_stock || 0;

  // Allow advance ordering: reserved_stock can exceed stock_count
  // When reserving more than available stock, stock_count can go negative
  // Example: stock_count=50, reserve=70 → stock_count=-20, reserved_stock=70
  const newStockCount = currentStock - quantity; // Allow negative for advance orders
  const newReservedStock = currentReserved + quantity; // Always add full quantity to reserved

  const { data, error } = await client
    .from('warehouse_inventory')
    .update({
      stock_count: newStockCount,
      reserved_stock: newReservedStock,
      updated_at: new Date().toISOString()
    })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId) // Now required
    .select('stock_count, reserved_stock')
    .maybeSingle(); // Use maybeSingle() for better error handling

  if (error) {
    console.error(`Error updating warehouse stock for product ${productId} in warehouse ${warehouseId}:`, error);
    throw error;
  }

  if (!data) {
    throw new Error(`Failed to update warehouse inventory for product ${productId} in warehouse ${warehouseId}`);
  }

  return { stock_count: data.stock_count || 0, reserved_stock: data.reserved_stock || 0 };
};

/**
 * Release reserved stock (deduct from reserved_stock when order is processed)
 * Returns the new reserved_stock count
 * 
 * @deprecated Use InventoryService.releaseStock() instead
 * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
 */
export const releaseReservedStock = async (
  productId: string,
  warehouseId: string,
  variantId: string, // MANDATORY - no longer nullable
  quantity: number,
  companyId?: string,
  allowNegative: boolean = false,
  useAdminClient: boolean = false
): Promise<{ stock_count: number; reserved_stock: number }> => {
  if (!variantId) {
    throw new Error('variantId is required');
  }

  const client = useAdminClient && supabaseAdmin ? supabaseAdmin : supabase;

  // Get current inventory
  let inventoryQuery = client
    .from('warehouse_inventory')
    .select('stock_count, reserved_stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    inventoryQuery = inventoryQuery.eq('company_id', companyId);
  }

  const { data: currentInventory, error: fetchError } = await inventoryQuery.single();

  if (fetchError || !currentInventory) {
    console.error(`Inventory not found for product ${productId} in warehouse ${warehouseId}`);
    throw new Error('Inventory not found');
  }

  const currentReserved = currentInventory.reserved_stock || 0;
  const newReservedStock = allowNegative
    ? currentReserved - quantity
    : Math.max(0, currentReserved - quantity);

  let updateQuery = client
    .from('warehouse_inventory')
    .update({
      reserved_stock: newReservedStock,
      updated_at: new Date().toISOString()
    })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    updateQuery = updateQuery.eq('company_id', companyId);
  }

  const { data, error } = await updateQuery
    .select('stock_count, reserved_stock')
    .single();

  if (error) {
    console.error(`Error releasing reserved stock for product ${productId} in warehouse ${warehouseId}:`, error);
    throw error;
  }

  return { stock_count: data?.stock_count || 0, reserved_stock: data?.reserved_stock || 0 };
};

/**
 * Restore reserved stock back to available stock (when order is cancelled)
 * Moves stock from reserved_stock back to stock_count
 * 
 * @deprecated Use InventoryService.releaseStock() instead
 * @param variantId - MANDATORY: Variant ID (use DEFAULT variant if product has no visible variants)
 */
export const restoreReservedStock = async (
  productId: string,
  warehouseId: string,
  variantId: string, // MANDATORY - no longer nullable
  quantity: number,
  companyId?: string,
  useAdminClient: boolean = false
): Promise<{ stock_count: number; reserved_stock: number }> => {
  if (!variantId) {
    throw new Error('variantId is required');
  }

  const client = useAdminClient && supabaseAdmin ? supabaseAdmin : supabase;

  // Get current inventory
  let inventoryQuery = client
    .from('warehouse_inventory')
    .select('stock_count, reserved_stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    inventoryQuery = inventoryQuery.eq('company_id', companyId);
  }

  const { data: currentInventory, error: fetchError } = await inventoryQuery.single();

  if (fetchError || !currentInventory) {
    console.error(`Inventory not found for product ${productId} in warehouse ${warehouseId}`);
    throw new Error('Inventory not found');
  }

  const currentStock = currentInventory.stock_count || 0;
  const currentReserved = currentInventory.reserved_stock || 0;

  // Move stock back from reserved_stock to stock_count
  const newStockCount = currentStock + quantity;
  const newReservedStock = Math.max(0, currentReserved - quantity);

  let updateQuery = client
    .from('warehouse_inventory')
    .update({
      stock_count: newStockCount,
      reserved_stock: newReservedStock,
      updated_at: new Date().toISOString()
    })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId); // Now required

  if (companyId) {
    updateQuery = updateQuery.eq('company_id', companyId);
  }

  const { data, error } = await updateQuery
    .select('stock_count, reserved_stock')
    .single();

  if (error) {
    console.error(`Error restoring reserved stock for product ${productId} in warehouse ${warehouseId}:`, error);
    throw error;
  }

  return { stock_count: data?.stock_count || 0, reserved_stock: data?.reserved_stock || 0 };
};
