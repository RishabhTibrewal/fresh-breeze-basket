import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError, AuthorizationError } from '../middleware/error';
import { updateWarehouseStock } from '../utils/warehouseInventory';
import { hasAnyRole, hasWarehouseAccess } from '../utils/roles';

/**
 * Generate GRN number (e.g., GRN-2024-001)
 */
const generateGRNNumber = async (companyId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  const adminClient = supabaseAdmin || supabase;
  const { data: latestGRN, error } = await adminClient
    .schema('procurement')
    .from('goods_receipts')
    .select('grn_number')
    .eq('company_id', companyId)
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

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Verify purchase order exists
    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseOrder, error: poError } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('*')
      .eq('id', purchase_order_id)
      .eq('company_id', req.companyId)
      .single();

    if (poError || !purchaseOrder) {
      throw new ApiError(404, 'Purchase order not found');
    }

    // Validate warehouse access for warehouse managers
    const isAdmin = await hasAnyRole(userId, req.companyId, ['admin']);
    if (!isAdmin) {
      const hasAccess = await hasWarehouseAccess(userId, req.companyId, warehouse_id);
      if (!hasAccess) {
        throw new AuthorizationError('You do not have access to manage this warehouse');
      }
    }

    // Generate GRN number
    const grn_number = await generateGRNNumber(req.companyId);

    // Fetch PO items to validate quantities
    const { data: poItems, error: poItemsError } = await adminClient
      .schema('procurement')
      .from('purchase_order_items')
      .select('id, quantity, received_quantity')
      .eq('purchase_order_id', purchase_order_id)
      .eq('company_id', req.companyId);

    if (poItemsError) {
      console.error('Error fetching PO items:', poItemsError);
      throw new ApiError(500, 'Failed to fetch purchase order items');
    }

    const poItemsMap = new Map(poItems?.map((item: any) => [item.id, item]) || []);

    // Fetch all existing GRNs for this PO (completed and pending) to calculate total received
    const { data: existingGRNs, error: grnsError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('id, status')
      .eq('purchase_order_id', purchase_order_id)
      .eq('company_id', req.companyId)
      .in('status', ['pending', 'inspected', 'completed']);

    const existingGRNIds = existingGRNs?.map((grn: any) => grn.id) || [];
    const completedGRNIds = existingGRNs?.filter((grn: any) => grn.status === 'completed').map((grn: any) => grn.id) || [];
    const pendingGRNIds = existingGRNIds.filter((id: string) => !completedGRNIds.includes(id));
    
    let existingReceivedQuantities = new Map<string, number>();

    if (existingGRNIds.length > 0) {
      // For completed GRNs, use quantity_accepted (what was actually received and updated PO)
      if (completedGRNIds.length > 0) {
        const { data: completedGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('purchase_order_item_id, quantity_accepted')
          .in('goods_receipt_id', completedGRNIds)
          .eq('company_id', req.companyId);

        completedGRNItems?.forEach((grnItem: any) => {
          const currentTotal = existingReceivedQuantities.get(grnItem.purchase_order_item_id) || 0;
          existingReceivedQuantities.set(
            grnItem.purchase_order_item_id,
            currentTotal + (grnItem.quantity_accepted || 0)
          );
        });
      }

      // For pending/inspected GRNs, use quantity_received (what's planned to be received)
      if (pendingGRNIds.length > 0) {
        const { data: pendingGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('purchase_order_item_id, quantity_received')
          .in('goods_receipt_id', pendingGRNIds)
          .eq('company_id', req.companyId);

        pendingGRNItems?.forEach((grnItem: any) => {
          const currentTotal = existingReceivedQuantities.get(grnItem.purchase_order_item_id) || 0;
          existingReceivedQuantities.set(
            grnItem.purchase_order_item_id,
            currentTotal + (grnItem.quantity_received || 0)
          );
        });
      }
    }

    // Calculate total received amount and validate quantities
    let total_received_amount = 0;
    for (const item of items) {
      if (!item.purchase_order_item_id) {
        throw new ValidationError('Each item must have purchase_order_item_id');
      }
      
      if (item.quantity_received === undefined || item.quantity_received === null) {
        throw new ValidationError('Each item must have quantity_received');
      }
      
      if (item.quantity_received <= 0) {
        throw new ValidationError('Each item must have quantity_received greater than 0');
      }
      
      if (item.unit_price === undefined || item.unit_price === null || item.unit_price < 0) {
        throw new ValidationError('Each item must have a valid unit_price (greater than or equal to 0)');
      }

      const poItem = poItemsMap.get(item.purchase_order_item_id);
      if (!poItem) {
        throw new ValidationError(`Purchase order item ${item.purchase_order_item_id} not found`);
      }

      const orderedQuantity = poItem.quantity || 0;
      const alreadyReceived = existingReceivedQuantities.get(item.purchase_order_item_id) || 0;
      const newReceived = item.quantity_received || 0;
      const totalAfterThisGRN = alreadyReceived + newReceived;

      if (totalAfterThisGRN > orderedQuantity) {
        const available = orderedQuantity - alreadyReceived;
        throw new ValidationError(
          `Cannot receive ${newReceived} units for item ${item.purchase_order_item_id}. ` +
          `Only ${available} units available (ordered: ${orderedQuantity}, already received: ${alreadyReceived})`
        );
      }

      const line_total = item.quantity_received * item.unit_price;
      total_received_amount += line_total;
    }

    // Create goods receipt
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .insert({
        purchase_order_id,
        grn_number,
        receipt_date: receipt_date || new Date().toISOString().split('T')[0],
        warehouse_id,
        received_by: userId,
        inspection_notes,
        total_received_amount,
        notes,
        status: 'pending',
        company_id: req.companyId
      })
      .select()
      .single();

    if (grnError) {
      console.error('Error creating goods receipt:', grnError);
      throw new ApiError(500, `Failed to create goods receipt: ${grnError.message}`);
    }

    // Fetch product details for all items
    const productIds = items.map((item: any) => item.product_id).filter(Boolean);
    let productsMap = new Map();
    
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await adminClient
        .from('products')
        .select('id, unit_type, product_code, hsn_code, tax')
        .in('id', productIds)
        .eq('company_id', req.companyId);

      if (productsError) {
        console.error('Error fetching products:', productsError);
        throw new ApiError(500, 'Failed to fetch product details');
      }

      productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);
    }

    // Create goods receipt items with product details
    const receiptItems = items.map((item: any) => {
      const product = productsMap.get(item.product_id);
      return {
        goods_receipt_id: goodsReceipt.id,
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
        quantity_received: item.quantity_received,
        quantity_accepted: item.quantity_accepted || item.quantity_received,
        quantity_rejected: item.quantity_rejected || 0,
        unit_price: item.unit_price,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        condition_notes: item.condition_notes,
        unit: product?.unit_type || 'piece',
        product_code: product?.product_code || '',
        hsn_code: product?.hsn_code || '',
        tax_percentage: product?.tax || 0,
        company_id: req.companyId
      };
    });

    const { data: createdItems, error: itemsError } = await adminClient
      .schema('procurement')
      .from('goods_receipt_items')
      .insert(receiptItems)
      .select();

    if (itemsError) {
      console.error('Error creating goods receipt items:', itemsError);
      await adminClient
        .schema('procurement')
        .from('goods_receipts')
        .delete()
        .eq('id', goodsReceipt.id)
        .eq('company_id', req.companyId);
      throw new ApiError(500, `Failed to create goods receipt items: ${itemsError.message}`);
    }

    // Auto-update PO status to 'ordered' if PO is approved (GRN can only be created for approved/ordered/partially_received POs)
    // This ensures PO status reflects that goods have been ordered from supplier
    if (purchaseOrder.status === 'approved') {
      await adminClient
        .schema('procurement')
        .from('purchase_orders')
        .update({
          status: 'ordered',
          updated_at: new Date().toISOString()
        })
        .eq('id', purchase_order_id)
        .eq('company_id', req.companyId);
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    let query = adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('company_id', req.companyId)
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
        .in('id', purchaseOrderIds)
        .eq('company_id', req.companyId);
      
      purchaseOrders?.forEach((po: any) => {
        purchaseOrdersMap.set(po.id, po);
      });
    }

    if (warehouseIds.length > 0) {
      const { data: warehouses } = await adminClient
        .from('warehouses')
        .select('*')
        .in('id', warehouseIds)
        .eq('company_id', req.companyId);
      
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch goods receipt from procurement schema
    const { data: goodsReceipt, error } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
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
      .eq('goods_receipt_id', id)
      .eq('company_id', req.companyId);

    // Fetch related purchase order and warehouse from public/procurement schemas
    const [purchaseOrderResult, warehouseResult] = await Promise.all([
      goodsReceipt.purchase_order_id 
        ? adminClient.schema('procurement').from('purchase_orders').select('*').eq('id', goodsReceipt.purchase_order_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      goodsReceipt.warehouse_id
        ? adminClient.from('warehouses').select('*').eq('id', goodsReceipt.warehouse_id).eq('company_id', req.companyId).single()
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
        .in('id', productIds)
        .eq('company_id', req.companyId);
      
      products?.forEach((product: any) => {
        productsMap.set(product.id, product);
      });
    }

    if (purchaseOrderItemIds.length > 0) {
      const { data: purchaseOrderItems } = await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .select('*')
        .in('id', purchaseOrderItemIds)
        .eq('company_id', req.companyId);
      
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (receipt_date !== undefined) updateData.receipt_date = receipt_date;
    if (inspection_notes !== undefined) updateData.inspection_notes = inspection_notes;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (inspected_by !== undefined) updateData.inspected_by = inspected_by;

    const adminClient = supabaseAdmin || supabase;
    const { data: goodsReceipt, error: updateError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
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
      await adminClient
        .schema('procurement')
        .from('goods_receipt_items')
        .delete()
        .eq('goods_receipt_id', id)
        .eq('company_id', req.companyId);

      if (items.length > 0) {
        // Fetch product details for all items
        const productIds = items.map((item: any) => item.product_id).filter(Boolean);
        let productsMap = new Map();
        
        if (productIds.length > 0) {
          const { data: products, error: productsError } = await adminClient
            .from('products')
            .select('id, unit_type, product_code, hsn_code, tax')
            .in('id', productIds)
            .eq('company_id', req.companyId);

          if (productsError) {
            console.error('Error fetching products:', productsError);
            throw new ApiError(500, 'Failed to fetch product details');
          }

          productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);
        }

        const receiptItems = items.map((item: any) => {
          const product = productsMap.get(item.product_id);
          return {
            goods_receipt_id: id,
            purchase_order_item_id: item.purchase_order_item_id,
            product_id: item.product_id,
            quantity_received: item.quantity_received,
            quantity_accepted: item.quantity_accepted || item.quantity_received,
            quantity_rejected: item.quantity_rejected || 0,
            unit_price: item.unit_price,
            batch_number: item.batch_number,
            expiry_date: item.expiry_date,
            condition_notes: item.condition_notes,
            unit: product?.unit_type || 'piece',
            product_code: product?.product_code || '',
            hsn_code: product?.hsn_code || '',
            tax_percentage: product?.tax || 0,
            company_id: req.companyId
          };
        });

        const { error: itemsError } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
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

        await adminClient
          .schema('procurement')
          .from('goods_receipts')
          .update({ total_received_amount })
          .eq('id', id)
          .eq('company_id', req.companyId);
      }
    }

    const { data: completeGRN, error: fetchError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
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
      .eq('company_id', req.companyId)
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

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    if (!items || !Array.isArray(items)) {
      throw new ValidationError('Items array is required');
    }

    // Get goods receipt
    const adminClient = supabaseAdmin || supabase;
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Fetch PO items to calculate remaining quantities
    const { data: poItems } = await adminClient
      .schema('procurement')
      .from('purchase_order_items')
      .select('id, quantity, received_quantity')
      .eq('purchase_order_id', goodsReceipt.purchase_order_id)
      .eq('company_id', req.companyId);

    const poItemsMap = new Map(poItems?.map((item: any) => [item.id, item]) || []);

    // Calculate what the received quantities will be after completing this GRN
    const quantitiesToAdd = new Map<string, number>();
    
    for (const item of items) {
      const { purchase_order_item_id, quantity_accepted } = item;
      if (purchase_order_item_id && quantity_accepted > 0) {
        const current = quantitiesToAdd.get(purchase_order_item_id) || 0;
        quantitiesToAdd.set(purchase_order_item_id, current + quantity_accepted);
      }
    }

    // Before updating PO items, check and adjust pending GRNs if needed
    if (goodsReceipt.purchase_order_id) {
      // Fetch all pending GRNs for this PO (excluding the one being completed)
      const { data: pendingGRNs } = await adminClient
        .schema('procurement')
        .from('goods_receipts')
        .select('id')
        .eq('purchase_order_id', goodsReceipt.purchase_order_id)
        .eq('company_id', req.companyId)
        .in('status', ['pending', 'inspected'])
        .neq('id', id);

      if (pendingGRNs && pendingGRNs.length > 0) {
        const pendingGRNIds = pendingGRNs.map((grn: any) => grn.id);
        
        // Fetch all items from pending GRNs
        const { data: pendingGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('id, goods_receipt_id, purchase_order_item_id, quantity_received')
          .in('goods_receipt_id', pendingGRNIds)
          .eq('company_id', req.companyId);

        // For each PO item, calculate remaining quantity after this GRN completion and adjust pending GRN items
        for (const [poItemId, poItem] of poItemsMap.entries()) {
          const orderedQuantity = poItem.quantity || 0;
          const currentReceived = poItem.received_quantity || 0;
          const quantityToAdd = quantitiesToAdd.get(poItemId) || 0;
          const totalReceivedAfterThisGRN = currentReceived + quantityToAdd;
          const remainingQuantity = Math.max(0, orderedQuantity - totalReceivedAfterThisGRN);

          // Find all pending GRN items for this PO item
          const pendingItemsForPOItem = pendingGRNItems?.filter(
            (grnItem: any) => grnItem.purchase_order_item_id === poItemId
          ) || [];

          // Calculate total quantity in pending GRNs for this PO item
          const totalPendingQuantity = pendingItemsForPOItem.reduce(
            (sum: number, item: any) => sum + (item.quantity_received || 0),
            0
          );

          // If pending GRNs exceed remaining quantity, adjust them to fit within remaining quantity
          if (totalPendingQuantity > remainingQuantity && remainingQuantity >= 0) {
            // Update each pending GRN item proportionally to fit within remaining quantity
            for (const pendingItem of pendingItemsForPOItem) {
              const currentQuantity = pendingItem.quantity_received || 0;
              if (currentQuantity > 0 && totalPendingQuantity > 0) {
                // Calculate proportional reduction
                const ratio = remainingQuantity / totalPendingQuantity;
                const adjustedQuantity = Math.floor(currentQuantity * ratio);
                
                // Only update if the quantity changed
                if (adjustedQuantity !== currentQuantity) {
                  await adminClient
                    .schema('procurement')
                    .from('goods_receipt_items')
                    .update({ quantity_received: adjustedQuantity })
                    .eq('id', pendingItem.id)
                    .eq('company_id', req.companyId);
                }
              } else if (remainingQuantity === 0) {
                // If no remaining quantity, set pending items to 0
                await adminClient
                  .schema('procurement')
                  .from('goods_receipt_items')
                  .update({ quantity_received: 0 })
                  .eq('id', pendingItem.id)
                  .eq('company_id', req.companyId);
              }
            }
          }
        }
      }
    }

    // Update items and warehouse inventory
    for (const item of items) {
      const { product_id, quantity_accepted, warehouse_id, purchase_order_item_id } = item;

      if (!product_id || !quantity_accepted || !warehouse_id || !purchase_order_item_id) {
        continue; // Skip invalid items
      }

      // Update warehouse inventory (add stock)
      try {
        await updateWarehouseStock(
          product_id,
          warehouse_id,
          quantity_accepted,
          req.companyId,
          false, // Don't allow negative
          true // Use admin client
        );
      } catch (stockError) {
        console.error(`Error updating stock for product ${product_id}:`, stockError);
        // Continue with other items
      }

      // Update received quantity in purchase order item
      const { data: poiData } = await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .select('received_quantity')
        .eq('id', purchase_order_item_id)
        .eq('company_id', req.companyId)
        .single();

      if (poiData) {
        const newReceivedQuantity = (poiData.received_quantity || 0) + quantity_accepted;
        await adminClient
          .schema('procurement')
          .from('purchase_order_items')
          .update({ received_quantity: newReceivedQuantity })
          .eq('id', purchase_order_item_id)
          .eq('company_id', req.companyId);
      }
    }

    // Update GRN status to completed
    const { data: updatedGRN, error: updateError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating GRN status:', updateError);
      throw new ApiError(500, 'Failed to update GRN status');
    }

    // Auto-update PO status based on received quantities
    if (goodsReceipt.purchase_order_id) {
      const { data: poItems } = await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .select('quantity, received_quantity')
        .eq('purchase_order_id', goodsReceipt.purchase_order_id)
        .eq('company_id', req.companyId);

      if (poItems && poItems.length > 0) {
        const allFullyReceived = poItems.every((item: any) => 
          item.received_quantity >= item.quantity
        );
        const anyPartiallyReceived = poItems.some((item: any) => 
          item.received_quantity > 0 && item.received_quantity < item.quantity
        );

        let newPOStatus = 'ordered';
        if (allFullyReceived) {
          newPOStatus = 'received';
        } else if (anyPartiallyReceived) {
          newPOStatus = 'partially_received';
        }

        await adminClient
          .schema('procurement')
          .from('purchase_orders')
          .update({
            status: newPOStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', goodsReceipt.purchase_order_id)
          .eq('company_id', req.companyId);
      }
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Fetch goods receipt items separately to avoid type issues
    const { data: items, error: itemsError } = await adminClient
      .schema('procurement')
      .from('goods_receipt_items')
      .select('*')
      .eq('goods_receipt_id', id)
      .eq('company_id', req.companyId);

    if (itemsError) {
      console.error('Error fetching goods receipt items:', itemsError);
      throw new ApiError(500, 'Failed to fetch goods receipt items');
    }

    // Fetch PO items to calculate remaining quantities
    const { data: poItems } = await adminClient
      .schema('procurement')
      .from('purchase_order_items')
      .select('id, quantity, received_quantity')
      .eq('purchase_order_id', goodsReceipt.purchase_order_id)
      .eq('company_id', req.companyId);

    const poItemsMap = new Map(poItems?.map((item: any) => [item.id, item]) || []);

    // Calculate what the received quantities will be after completing this GRN
    const itemsList = items || [];
    const quantitiesToAdd = new Map<string, number>();
    
    for (const item of itemsList) {
      if (item.quantity_accepted > 0) {
        const current = quantitiesToAdd.get(item.purchase_order_item_id) || 0;
        quantitiesToAdd.set(item.purchase_order_item_id, current + item.quantity_accepted);
      }
    }

    // Before updating PO items, check and adjust pending GRNs if needed
    if (goodsReceipt.purchase_order_id) {
      // Fetch all pending GRNs for this PO (excluding the one being completed)
      const { data: pendingGRNs } = await adminClient
        .schema('procurement')
        .from('goods_receipts')
        .select('id')
        .eq('purchase_order_id', goodsReceipt.purchase_order_id)
        .eq('company_id', req.companyId)
        .in('status', ['pending', 'inspected'])
        .neq('id', id);

      if (pendingGRNs && pendingGRNs.length > 0) {
        const pendingGRNIds = pendingGRNs.map((grn: any) => grn.id);
        
        // Fetch all items from pending GRNs
        const { data: pendingGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('id, goods_receipt_id, purchase_order_item_id, quantity_received')
          .in('goods_receipt_id', pendingGRNIds)
          .eq('company_id', req.companyId);

        // For each PO item, calculate remaining quantity after this GRN completion and adjust pending GRN items
        for (const [poItemId, poItem] of poItemsMap.entries()) {
          const orderedQuantity = poItem.quantity || 0;
          const currentReceived = poItem.received_quantity || 0;
          const quantityToAdd = quantitiesToAdd.get(poItemId) || 0;
          const totalReceivedAfterThisGRN = currentReceived + quantityToAdd;
          const remainingQuantity = Math.max(0, orderedQuantity - totalReceivedAfterThisGRN);

          // Find all pending GRN items for this PO item
          const pendingItemsForPOItem = pendingGRNItems?.filter(
            (grnItem: any) => grnItem.purchase_order_item_id === poItemId
          ) || [];

          // Calculate total quantity in pending GRNs for this PO item
          const totalPendingQuantity = pendingItemsForPOItem.reduce(
            (sum: number, item: any) => sum + (item.quantity_received || 0),
            0
          );

          // If pending GRNs exceed remaining quantity, adjust them to fit within remaining quantity
          if (totalPendingQuantity > remainingQuantity && remainingQuantity >= 0) {
            // Update each pending GRN item proportionally to fit within remaining quantity
            for (const pendingItem of pendingItemsForPOItem) {
              const currentQuantity = pendingItem.quantity_received || 0;
              if (currentQuantity > 0 && totalPendingQuantity > 0) {
                // Calculate proportional reduction
                const ratio = remainingQuantity / totalPendingQuantity;
                const adjustedQuantity = Math.floor(currentQuantity * ratio);
                
                // Only update if the quantity changed
                if (adjustedQuantity !== currentQuantity) {
                  await adminClient
                    .schema('procurement')
                    .from('goods_receipt_items')
                    .update({ quantity_received: adjustedQuantity })
                    .eq('id', pendingItem.id)
                    .eq('company_id', req.companyId);
                }
              } else if (remainingQuantity === 0) {
                // If no remaining quantity, set pending items to 0
                await adminClient
                  .schema('procurement')
                  .from('goods_receipt_items')
                  .update({ quantity_received: 0 })
                  .eq('id', pendingItem.id)
                  .eq('company_id', req.companyId);
              }
            }
          }
        }
      }
    }

    // Update warehouse inventory for all accepted items and update PO received quantities
    for (const item of itemsList) {
      if (item.quantity_accepted > 0) {
        try {
          await updateWarehouseStock(
            item.product_id,
            goodsReceipt.warehouse_id,
            item.quantity_accepted,
            req.companyId,
            false,
            true
          );
        } catch (stockError) {
          console.error(`Error updating stock for product ${item.product_id}:`, stockError);
        }

        // Update received quantity in purchase order item
        const { data: poiData } = await adminClient
          .schema('procurement')
          .from('purchase_order_items')
          .select('received_quantity')
          .eq('id', item.purchase_order_item_id)
          .eq('company_id', req.companyId)
          .single();

        if (poiData) {
          const newReceivedQuantity = (poiData.received_quantity || 0) + item.quantity_accepted;
          
          await adminClient
            .schema('procurement')
            .from('purchase_order_items')
            .update({ received_quantity: newReceivedQuantity })
            .eq('id', item.purchase_order_item_id)
            .eq('company_id', req.companyId);
        }
      }
    }

    // Update GRN status
    const { data: updatedGRN, error: updateError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing GRN:', updateError);
      throw new ApiError(500, 'Failed to complete goods receipt');
    }

    // Auto-update PO status based on received quantities
    if (goodsReceipt.purchase_order_id) {
      const { data: poItems } = await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .select('quantity, received_quantity')
        .eq('purchase_order_id', goodsReceipt.purchase_order_id)
        .eq('company_id', req.companyId);

      if (poItems && poItems.length > 0) {
        const allFullyReceived = poItems.every((item: any) => 
          item.received_quantity >= item.quantity
        );
        const anyPartiallyReceived = poItems.some((item: any) => 
          item.received_quantity > 0 && item.received_quantity < item.quantity
        );

        let newPOStatus = 'ordered';
        if (allFullyReceived) {
          newPOStatus = 'received';
        } else if (anyPartiallyReceived) {
          newPOStatus = 'partially_received';
        }

        await adminClient
          .schema('procurement')
          .from('purchase_orders')
          .update({
            status: newPOStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', goodsReceipt.purchase_order_id)
          .eq('company_id', req.companyId);
      }
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
