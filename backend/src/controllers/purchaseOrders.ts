import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

// Helper function to query procurement schema tables using Supabase schema() method
// Note: Requires procurement schema to be exposed in Supabase Dashboard → Settings → API → Exposed Schemas
const queryProcurementTable = async (table: string, operation: 'select' | 'insert' | 'update' | 'delete', options: any = {}) => {
  const adminClient = supabaseAdmin || supabase;
  if (!adminClient) {
    throw new ApiError(500, 'Admin client not available');
  }

  try {
    switch (operation) {
      case 'select':
        let selectQuery: any = adminClient.schema('procurement').from(table).select(options.select || '*');
        if (options.companyId) {
          selectQuery = selectQuery.eq('company_id', options.companyId);
        }
        if (options.filter) {
          selectQuery = selectQuery.eq(options.filter.key, options.filter.value);
        }
        if (options.order) {
          const [column, direction] = options.order.split('.');
          selectQuery = selectQuery.order(column, { ascending: direction !== 'desc' });
        }
        if (options.limit) {
          selectQuery = selectQuery.limit(options.limit);
        }
        if (options.search) {
          selectQuery = selectQuery.ilike(options.search.field, `%${options.search.value}%`);
        }
        const { data, error } = await selectQuery;
        if (error) throw error;
        return data;
      
      case 'insert':
        const insertData = Array.isArray(options.data) ? options.data : [options.data];
        const insertWithCompany = options.companyId
          ? insertData.map((row: any) => ({ company_id: options.companyId, ...row }))
          : insertData;
        const { data: insertResult, error: insertError } = await adminClient
          .schema('procurement')
          .from(table)
          .insert(insertWithCompany)
          .select();
        if (insertError) throw insertError;
        return insertResult;
      
      case 'update':
        let updateQuery: any = adminClient.schema('procurement').from(table).update(options.data);
        if (options.companyId) {
          updateQuery = updateQuery.eq('company_id', options.companyId);
        }
        if (options.filter) {
          updateQuery = updateQuery.eq(options.filter.key, options.filter.value);
        }
        const { data: updateResult, error: updateError } = await updateQuery.select();
        if (updateError) throw updateError;
        return updateResult;
      
      case 'delete':
        let deleteQuery: any = adminClient.schema('procurement').from(table).delete();
        if (options.companyId) {
          deleteQuery = deleteQuery.eq('company_id', options.companyId);
        }
        if (options.filter) {
          deleteQuery = deleteQuery.eq(options.filter.key, options.filter.value);
        }
        const { error: deleteError } = await deleteQuery;
        if (deleteError) throw deleteError;
        return { success: true };
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error: unknown) {
    // Properly extract error message from Supabase error objects
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as any).message);
    } else if (error && typeof error === 'object' && 'code' in error) {
      const supabaseError = error as any;
      errorMessage = supabaseError.message || supabaseError.code || JSON.stringify(error);
    } else {
      errorMessage = JSON.stringify(error);
    }
    console.error(`Error in queryProcurementTable (${operation}):`, errorMessage);
    console.error('Full error object:', error);
    throw new Error(errorMessage);
  }
};

/**
 * Generate PO number (e.g., PO-2024-001)
 */
const generatePONumber = async (companyId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  try {
    // Use admin client with schema() method to query procurement schema
    const adminClient = supabaseAdmin || supabase;
    if (!adminClient) {
      throw new Error('Admin client not available');
    }

    // Query using ilike for pattern matching
    const { data, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('po_number')
      .eq('company_id', companyId)
      .ilike('po_number', `PO-${year}-%`)
      .order('po_number', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error fetching latest PO:', error);
      throw error;
    }

    let sequence = 1;
    if (Array.isArray(data) && data.length > 0 && data[0]?.po_number) {
      const parts = data[0].po_number.split('-');
      if (parts.length === 3) {
        sequence = parseInt(parts[2]) + 1;
      }
    }
    return `PO-${year}-${sequence.toString().padStart(3, '0')}`;
  } catch (error: unknown) {
    // Extract proper error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as any).message)
        : JSON.stringify(error);
    console.error('Error fetching latest PO, using default:', errorMessage);
    console.error('Full error:', error);
    // Fallback: return a default PO number
    return `PO-${year}-001`;
  }
};

/**
 * Create a new purchase order
 */
export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      supplier_id,
      warehouse_id,
      expected_delivery_date,
      notes,
      terms_conditions,
      items
    } = req.body;

    if (!supplier_id) {
      throw new ValidationError('Supplier ID is required');
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

    // Generate PO number
    const po_number = await generatePONumber(req.companyId);

    // Calculate total amount
    let total_amount = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        throw new ValidationError('Each item must have product_id, quantity, and unit_price');
      }
      const line_total = item.quantity * item.unit_price;
      total_amount += line_total;
    }

    // Create purchase order using admin client for custom schema access
    const adminClient = supabaseAdmin || supabase;
    
    const purchaseOrderData = {
      supplier_id,
      warehouse_id,
      po_number,
      expected_delivery_date,
      total_amount,
      notes,
      terms_conditions,
      status: 'draft',
      created_by: userId,
      company_id: req.companyId
    };

    const purchaseOrderResult = await queryProcurementTable('purchase_orders', 'insert', {
      data: purchaseOrderData,
      companyId: req.companyId
    });

    if (!purchaseOrderResult || (Array.isArray(purchaseOrderResult) && purchaseOrderResult.length === 0)) {
      throw new ApiError(500, 'Failed to create purchase order');
    }

    const po = Array.isArray(purchaseOrderResult) ? purchaseOrderResult[0] : purchaseOrderResult as any;

    // Create purchase order items
    const orderItems = items.map((item: any) => ({
      purchase_order_id: po.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
      company_id: req.companyId
    }));

    try {
      const createdItems = await queryProcurementTable('purchase_order_items', 'insert', {
        data: orderItems,
        companyId: req.companyId
      });

      // Fetch complete purchase order with items and relations
      // Note: For now, return the created PO with items
      // Full relations would require additional queries or RPC functions
      res.status(201).json({
        success: true,
        data: {
          ...po,
          items: Array.isArray(createdItems) ? createdItems : [createdItems]
        }
      });
    } catch (itemsError: any) {
      console.error('Error creating purchase order items:', itemsError);
      // Rollback purchase order
      try {
        await queryProcurementTable('purchase_orders', 'delete', {
          filter: { key: 'id', value: po.id },
          companyId: req.companyId
        });
      } catch (deleteError) {
        console.error('Error rolling back purchase order:', deleteError);
      }
      throw new ApiError(500, `Failed to create purchase order items: ${itemsError.message || itemsError}`);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get all purchase orders with optional filters
 */
export const getPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, warehouse_id, supplier_id, search } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    let query = adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }

    if (search) {
      query = query.ilike('po_number', `%${search}%`);
    }

    const { data: purchaseOrders, error } = await query;

    if (error) {
      console.error('Error fetching purchase orders:', error);
      throw new ApiError(500, 'Failed to fetch purchase orders');
    }

    // Fetch related suppliers and warehouses separately (they're in public schema)
    const supplierIds = [...new Set(purchaseOrders?.map((po: any) => po.supplier_id).filter(Boolean) || [])];
    const warehouseIds = [...new Set(purchaseOrders?.map((po: any) => po.warehouse_id).filter(Boolean) || [])];

    const suppliersMap = new Map();
    const warehousesMap = new Map();

    if (supplierIds.length > 0) {
      const { data: suppliers } = await adminClient
        .from('suppliers')
        .select('*')
        .in('id', supplierIds)
        .eq('company_id', req.companyId);
      
      suppliers?.forEach((supplier: any) => {
        suppliersMap.set(supplier.id, supplier);
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
    const enrichedOrders = (purchaseOrders || []).map((po: any) => ({
      ...po,
      suppliers: po.supplier_id ? suppliersMap.get(po.supplier_id) : null,
      warehouses: po.warehouse_id ? warehousesMap.get(po.warehouse_id) : null
    }));

    res.json({
      success: true,
      data: enrichedOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get purchase order by ID
 */
export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch purchase order from procurement schema
    const { data: purchaseOrder, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase order not found');
      }
      console.error('Error fetching purchase order:', error);
      throw new ApiError(500, 'Failed to fetch purchase order');
    }

    // Fetch purchase order items from procurement schema
    const { data: items } = await adminClient
      .schema('procurement')
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', id)
      .eq('company_id', req.companyId);

    // Fetch related supplier and warehouse from public schema
    const [supplierResult, warehouseResult] = await Promise.all([
      purchaseOrder.supplier_id 
        ? adminClient.from('suppliers').select('*').eq('id', purchaseOrder.supplier_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      purchaseOrder.warehouse_id
        ? adminClient.from('warehouses').select('*').eq('id', purchaseOrder.warehouse_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null })
    ]);

    const supplier = supplierResult.error ? null : supplierResult.data;
    const warehouse = warehouseResult.error ? null : warehouseResult.data;

    // Fetch products for items
    const productIds = items?.map((item: any) => item.product_id).filter(Boolean) || [];
    let productsMap = new Map();
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

    // Enrich items with products
    const enrichedItems = (items || []).map((item: any) => ({
      ...item,
      products: item.product_id ? productsMap.get(item.product_id) : null
    }));

    res.json({
      success: true,
      data: {
        ...purchaseOrder,
        suppliers: supplier,
        warehouses: warehouse,
        purchase_order_items: enrichedItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update purchase order
 */
export const updatePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      supplier_id,
      warehouse_id,
      expected_delivery_date,
      notes,
      terms_conditions,
      status,
      items
    } = req.body;

    // Update purchase order
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
    if (warehouse_id !== undefined) updateData.warehouse_id = warehouse_id;
    if (expected_delivery_date !== undefined) updateData.expected_delivery_date = expected_delivery_date;
    if (notes !== undefined) updateData.notes = notes;
    if (terms_conditions !== undefined) updateData.terms_conditions = terms_conditions;
    if (status !== undefined) updateData.status = status;

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseOrder, error: updateError } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase order not found');
      }
      console.error('Error updating purchase order:', updateError);
      throw new ApiError(500, 'Failed to update purchase order');
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await adminClient
        .schema('procurement')
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', id)
        .eq('company_id', req.companyId);

      // Insert new items
      if (items.length > 0) {
        const orderItems = items.map((item: any) => ({
          purchase_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
          company_id: req.companyId
        }));

        const { error: itemsError } = await adminClient
          .schema('procurement')
          .from('purchase_order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error updating purchase order items:', itemsError);
          throw new ApiError(500, 'Failed to update purchase order items');
        }

        // Recalculate total
        let total_amount = 0;
        for (const item of items) {
          total_amount += item.quantity * item.unit_price;
        }

        await adminClient
          .schema('procurement')
          .from('purchase_orders')
          .update({ total_amount })
          .eq('id', id)
          .eq('company_id', req.companyId);
      }
    }

    // Fetch complete purchase order with relations
    const { data: updatedPO } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    // Fetch relations separately
    const [supplierResult, warehouseResult, orderItemsResult] = await Promise.all([
      updatedPO?.supplier_id 
        ? adminClient.from('suppliers').select('*').eq('id', updatedPO.supplier_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      updatedPO?.warehouse_id
        ? adminClient.from('warehouses').select('*').eq('id', updatedPO.warehouse_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      adminClient.schema('procurement').from('purchase_order_items').select('*').eq('purchase_order_id', id).eq('company_id', req.companyId)
    ]);

    const supplier = supplierResult.error ? null : supplierResult.data;
    const warehouse = warehouseResult.error ? null : warehouseResult.data;
    const orderItems = orderItemsResult.error ? [] : (orderItemsResult.data || []);

    // Fetch products for items
    const productIds = orderItems?.map((item: any) => item.product_id).filter(Boolean) || [];
    let productsMap = new Map();
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

    const enrichedItems = (orderItems || []).map((item: any) => ({
      ...item,
      products: item.product_id ? productsMap.get(item.product_id) : null
    }));

    res.json({
      success: true,
      data: {
        ...updatedPO,
        suppliers: supplier,
        warehouses: warehouse,
        purchase_order_items: enrichedItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve purchase order
 */
export const approvePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseOrder, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase order not found');
      }
      console.error('Error approving purchase order:', error);
      throw new ApiError(500, 'Failed to approve purchase order');
    }

    res.json({
      success: true,
      message: 'Purchase order approved successfully',
      data: purchaseOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseOrder, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase order not found');
      }
      console.error('Error cancelling purchase order:', error);
      throw new ApiError(500, 'Failed to cancel purchase order');
    }

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: purchaseOrder
    });
  } catch (error) {
    next(error);
  }
};
