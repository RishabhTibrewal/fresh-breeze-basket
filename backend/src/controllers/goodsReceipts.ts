import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';
import { updateWarehouseStock } from '../utils/warehouseInventory';

/**
 * Generate GRN number (e.g., GRN-2024-001)
 */
const generateGRNNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  
  const adminClient = supabaseAdmin || supabase;
  const { data: latestGRN, error } = await adminClient
    .schema('procurement')
    .from('goods_receipts')
    .select('grn_number')
    .ilike('grn_number', `GRN-${year}-%`)
    .order('grn_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest GRN:', error);
  }

  let sequence = 1;
  if (latestGRN && latestGRN.grn_number) {
    const parts = latestGRN.grn_number.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2]) + 1;
    }
  }

  return `GRN-${year}-${sequence.toString().padStart(3, '0')}`;
};

/**
 * Create a new goods receipt (GRN) from purchase order
 */
export const createGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      purchase_order_id,
      receipt_date,
      warehouse_id,
      inspection_notes,
      notes,
      items
    } = req.body;

    if (!purchase_order_id) {
      throw new ValidationError('Purchase order ID is required');
    }

    if (!warehouse_id) {
      throw new ValidationError('Warehouse ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Verify purchase order exists
    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseOrder, error: poError } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('*')
      .eq('id', purchase_order_id)
      .single();

    if (poError || !purchaseOrder) {
      throw new ApiError(404, 'Purchase order not found');
    }

    // Generate GRN number
    const grn_number = await generateGRNNumber();

    // Calculate total received amount
    let total_received_amount = 0;
    for (const item of items) {
      if (!item.purchase_order_item_id || !item.quantity_received || !item.unit_price) {
        throw new ValidationError('Each item must have purchase_order_item_id, quantity_received, and unit_price');
      }
      const line_total = item.quantity_received * item.unit_price;
      total_received_amount += line_total;
    }

    // Create goods receipt
    const { data: goodsReceipt, error: grnError } = await supabase
      .from('procurement.goods_receipts')
      .insert({
        purchase_order_id,
        grn_number,
        receipt_date: receipt_date || new Date().toISOString().split('T')[0],
        warehouse_id,
        received_by: userId,
        inspection_notes,
        total_received_amount,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (grnError) {
      console.error('Error creating goods receipt:', grnError);
      throw new ApiError(500, `Failed to create goods receipt: ${grnError.message}`);
    }

    // Create goods receipt items
    const receiptItems = items.map((item: any) => ({
      goods_receipt_id: goodsReceipt.id,
      purchase_order_item_id: item.purchase_order_item_id,
      product_id: item.product_id,
      quantity_received: item.quantity_received,
      quantity_accepted: item.quantity_accepted || item.quantity_received,
      quantity_rejected: item.quantity_rejected || 0,
      unit_price: item.unit_price,
      batch_number: item.batch_number,
      expiry_date: item.expiry_date,
      condition_notes: item.condition_notes
    }));

    const { data: createdItems, error: itemsError } = await adminClient
      .schema('procurement')
      .from('goods_receipt_items')
      .insert(receiptItems)
      .select();

    if (itemsError) {
      console.error('Error creating goods receipt items:', itemsError);
      await adminClient.schema('procurement').from('goods_receipts').delete().eq('id', goodsReceipt.id);
      throw new ApiError(500, `Failed to create goods receipt items: ${itemsError.message}`);
    }

    // Return the created goods receipt with items
    res.status(201).json({
      success: true,
      data: { ...goodsReceipt, goods_receipt_items: createdItems }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all goods receipts with optional filters
 */
export const getGoodsReceipts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, warehouse_id, purchase_order_id, search } = req.query;

    const adminClient = supabaseAdmin || supabase;
    let query = adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    if (purchase_order_id) {
      query = query.eq('purchase_order_id', purchase_order_id);
    }

    if (search) {
      query = query.ilike('grn_number', `%${search}%`);
    }

    const { data: goodsReceipts, error } = await query;

    if (error) {
      console.error('Error fetching goods receipts:', error);
      throw new ApiError(500, 'Failed to fetch goods receipts');
    }

    // Fetch related purchase orders and warehouses separately
    const purchaseOrderIds = [...new Set(goodsReceipts?.map((gr: any) => gr.purchase_order_id).filter(Boolean) || [])];
    const warehouseIds = [...new Set(goodsReceipts?.map((gr: any) => gr.warehouse_id).filter(Boolean) || [])];

    const purchaseOrdersMap = new Map();
    const warehousesMap = new Map();

    if (purchaseOrderIds.length > 0) {
      const { data: purchaseOrders } = await adminClient
        .schema('procurement')
        .from('purchase_orders')
        .select('*')
        .in('id', purchaseOrderIds);
      
      purchaseOrders?.forEach((po: any) => {
        purchaseOrdersMap.set(po.id, po);
      });
    }

    if (warehouseIds.length > 0) {
      const { data: warehouses } = await adminClient
        .from('warehouses')
        .select('*')
        .in('id', warehouseIds);
      
      warehouses?.forEach((warehouse: any) => {
        warehousesMap.set(warehouse.id, warehouse);
      });
    }

    // Join the data
    const enrichedReceipts = (goodsReceipts || []).map((gr: any) => ({
      ...gr,
      purchase_orders: gr.purchase_order_id ? purchaseOrdersMap.get(gr.purchase_order_id) : null,
      warehouses: gr.warehouse_id ? warehousesMap.get(gr.warehouse_id) : null
    }));

    res.json({
      success: true,
      data: enrichedReceipts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get goods receipt by ID
 */
export const getGoodsReceiptById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch goods receipt from procurement schema
    const { data: goodsReceipt, error } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Goods receipt not found');
      }
      console.error('Error fetching goods receipt:', error);
      throw new ApiError(500, 'Failed to fetch goods receipt');
    }

    // Fetch goods receipt items from procurement schema
    const { data: items } = await adminClient
      .schema('procurement')
      .from('goods_receipt_items')
      .select('*')
      .eq('goods_receipt_id', id);

    // Fetch related purchase order and warehouse from public/procurement schemas
    const [purchaseOrderResult, warehouseResult] = await Promise.all([
      goodsReceipt.purchase_order_id 
        ? adminClient.schema('procurement').from('purchase_orders').select('*').eq('id', goodsReceipt.purchase_order_id).single()
        : Promise.resolve({ data: null, error: null }),
      goodsReceipt.warehouse_id
        ? adminClient.from('warehouses').select('*').eq('id', goodsReceipt.warehouse_id).single()
        : Promise.resolve({ data: null, error: null })
    ]);

    const purchaseOrder = purchaseOrderResult.error ? null : purchaseOrderResult.data;
    const warehouse = warehouseResult.error ? null : warehouseResult.data;

    // Fetch products and purchase order items for receipt items
    const productIds = items?.map((item: any) => item.product_id).filter(Boolean) || [];
    const purchaseOrderItemIds = items?.map((item: any) => item.purchase_order_item_id).filter(Boolean) || [];

    const productsMap = new Map();
    const purchaseOrderItemsMap = new Map();

    if (productIds.length > 0) {
      const { data: products } = await adminClient
        .from('products')
        .select('*')
        .in('id', productIds);
      
      products?.forEach((product: any) => {
        productsMap.set(product.id, product);
      });
    }

    if (purchaseOrderItemIds.length > 0) {
      const { data: purchaseOrderItems } = await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .select('*')
        .in('id', purchaseOrderItemIds);
      
      purchaseOrderItems?.forEach((poItem: any) => {
        purchaseOrderItemsMap.set(poItem.id, poItem);
      });
    }

    // Enrich items with products and purchase order items
    const enrichedItems = (items || []).map((item: any) => ({
      ...item,
      products: item.product_id ? productsMap.get(item.product_id) : null,
      purchase_order_items: item.purchase_order_item_id ? purchaseOrderItemsMap.get(item.purchase_order_item_id) : null
    }));

    res.json({
      success: true,
      data: {
        ...goodsReceipt,
        purchase_orders: purchaseOrder,
        warehouses: warehouse,
        goods_receipt_items: enrichedItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update goods receipt
 */
export const updateGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      receipt_date,
      inspection_notes,
      notes,
      status,
      inspected_by,
      items
    } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (receipt_date !== undefined) updateData.receipt_date = receipt_date;
    if (inspection_notes !== undefined) updateData.inspection_notes = inspection_notes;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (inspected_by !== undefined) updateData.inspected_by = inspected_by;

    const { data: goodsReceipt, error: updateError } = await supabase
      .from('procurement.goods_receipts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Goods receipt not found');
      }
      console.error('Error updating goods receipt:', updateError);
      throw new ApiError(500, 'Failed to update goods receipt');
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      await supabase
        .from('procurement.goods_receipt_items')
        .delete()
        .eq('goods_receipt_id', id);

      if (items.length > 0) {
        const receiptItems = items.map((item: any) => ({
          goods_receipt_id: id,
          purchase_order_item_id: item.purchase_order_item_id,
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          quantity_accepted: item.quantity_accepted || item.quantity_received,
          quantity_rejected: item.quantity_rejected || 0,
          unit_price: item.unit_price,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          condition_notes: item.condition_notes
        }));

        const { error: itemsError } = await supabase
          .from('procurement.goods_receipt_items')
          .insert(receiptItems);

        if (itemsError) {
          console.error('Error updating goods receipt items:', itemsError);
          throw new ApiError(500, 'Failed to update goods receipt items');
        }

        // Recalculate total
        let total_received_amount = 0;
        for (const item of items) {
          total_received_amount += item.quantity_received * item.unit_price;
        }

        await supabase
          .from('procurement.goods_receipts')
          .update({ total_received_amount })
          .eq('id', id);
      }
    }

    const { data: completeGRN, error: fetchError } = await supabase
      .from('procurement.goods_receipts')
      .select(`
        *,
        procurement.purchase_orders (*),
        warehouses (*),
        procurement.goods_receipt_items (
          *,
          products (*),
          procurement.purchase_order_items (*)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching goods receipt:', fetchError);
    }

    res.json({
      success: true,
      data: completeGRN || goodsReceipt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Receive goods and update warehouse inventory
 */
export const receiveGoods = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      throw new ValidationError('Items array is required');
    }

    // Get goods receipt
    const { data: goodsReceipt, error: grnError } = await supabase
      .from('procurement.goods_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Update items and warehouse inventory
    for (const item of items) {
      const { product_id, quantity_accepted, warehouse_id } = item;

      if (!product_id || !quantity_accepted || !warehouse_id) {
        continue; // Skip invalid items
      }

      // Update warehouse inventory (add stock)
      try {
        await updateWarehouseStock(
          product_id,
          warehouse_id,
          quantity_accepted,
          false, // Don't allow negative
          true // Use admin client
        );
      } catch (stockError) {
        console.error(`Error updating stock for product ${product_id}:`, stockError);
        // Continue with other items
      }

      // Update received quantity in purchase order item
      const { data: poiData } = await supabase
        .from('procurement.purchase_order_items')
        .select('received_quantity')
        .eq('id', item.purchase_order_item_id)
        .single();

      if (poiData) {
        const newReceivedQuantity = (poiData.received_quantity || 0) + quantity_accepted;
        await supabase
          .from('procurement.purchase_order_items')
          .update({ received_quantity: newReceivedQuantity })
          .eq('id', item.purchase_order_item_id);
      }
    }

    // Update GRN status to completed
    const { data: updatedGRN, error: updateError } = await supabase
      .from('procurement.goods_receipts')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating GRN status:', updateError);
      throw new ApiError(500, 'Failed to update GRN status');
    }

    res.json({
      success: true,
      message: 'Goods received and inventory updated successfully',
      data: updatedGRN
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete goods receipt
 */
export const completeGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: goodsReceipt, error: grnError } = await supabase
      .from('procurement.goods_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Fetch goods receipt items separately to avoid type issues
    const { data: items, error: itemsError } = await supabase
      .from('procurement.goods_receipt_items')
      .select('*')
      .eq('goods_receipt_id', id);

    if (itemsError) {
      console.error('Error fetching goods receipt items:', itemsError);
      throw new ApiError(500, 'Failed to fetch goods receipt items');
    }

    // Update warehouse inventory for all accepted items
    const itemsList = items || [];
    for (const item of itemsList) {
      if (item.quantity_accepted > 0) {
        try {
          await updateWarehouseStock(
            item.product_id,
            goodsReceipt.warehouse_id,
            item.quantity_accepted,
            false,
            true
          );
        } catch (stockError) {
          console.error(`Error updating stock for product ${item.product_id}:`, stockError);
        }

        // Update received quantity in purchase order item
        const { data: poiData } = await supabase
          .from('procurement.purchase_order_items')
          .select('received_quantity')
          .eq('id', item.purchase_order_item_id)
          .single();

        if (poiData) {
          const newReceivedQuantity = (poiData.received_quantity || 0) + item.quantity_accepted;
          await supabase
            .from('procurement.purchase_order_items')
            .update({ received_quantity: newReceivedQuantity })
            .eq('id', item.purchase_order_item_id);
        }
      }
    }

    // Update GRN status
    const { data: updatedGRN, error: updateError } = await supabase
      .from('procurement.goods_receipts')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing GRN:', updateError);
      throw new ApiError(500, 'Failed to complete goods receipt');
    }

    res.json({
      success: true,
      message: 'Goods receipt completed and inventory updated',
      data: updatedGRN
    });
  } catch (error) {
    next(error);
  }
};
