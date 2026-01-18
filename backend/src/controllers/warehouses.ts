import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all warehouses
export const getAllWarehouses = async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;
    
    let query = supabase
      .from('warehouses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new ApiError(500, `Error fetching warehouses: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching warehouses');
  }
};

// Get warehouse by ID
export const getWarehouseById = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;
    
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', warehouseId)
      .single();
    
    if (error || !data) {
      throw new ApiError(404, 'Warehouse not found');
    }
    
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching warehouse');
  }
};

// Create warehouse (admin only)
export const createWarehouse = async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      address,
      city,
      state,
      country,
      postal_code,
      contact_name,
      contact_phone,
      contact_email,
      is_active = true
    } = req.body;
    
    if (!name || !code) {
      throw new ApiError(400, 'Name and code are required');
    }
    
    const { data, error } = await supabase
      .from('warehouses')
      .insert({
        name,
        code,
        address,
        city,
        state,
        country,
        postal_code,
        contact_name,
        contact_phone,
        contact_email,
        is_active
      })
      .select()
      .single();
    
    if (error) {
      throw new ApiError(400, `Error creating warehouse: ${error.message}`);
    }
    
    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating warehouse');
  }
};

// Update warehouse (admin only)
export const updateWarehouse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove id from updateData if present
    delete updateData.id;
    delete updateData.created_at;
    
    const { data, error } = await supabase
      .from('warehouses')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new ApiError(404, 'Warehouse not found');
    }
    
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating warehouse');
  }
};

// Delete warehouse (admin only - soft delete by setting is_active to false)
export const deleteWarehouse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Soft delete by setting is_active to false
    const { data, error } = await supabase
      .from('warehouses')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new ApiError(404, 'Warehouse not found');
    }
    
    return res.status(200).json({
      success: true,
      data,
      message: 'Warehouse deactivated successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting warehouse');
  }
};

// Get warehouse inventory
export const getWarehouseInventory = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const { product_id, low_stock } = req.query;
    
    let query = supabase
      .from('warehouse_inventory')
      .select(`
        *,
        products (
          id,
          name,
          description,
          price,
          image_url,
          unit_type
        ),
        warehouses (
          id,
          name,
          code,
          is_active
        )
      `)
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });
    
    if (product_id) {
      query = query.eq('product_id', product_id);
    }
    
    if (low_stock === 'true') {
      query = query.lte('stock_count', 10);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new ApiError(500, `Error fetching warehouse inventory: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching warehouse inventory');
  }
};

/**
 * Get product stock across all warehouses (DEPRECATED - Use bulk endpoint instead)
 * @deprecated Use POST /api/warehouses/products/bulk-stock for multiple products
 * This endpoint is kept for backward compatibility but should not be used in list views
 * as it can cause rate limiting issues when called multiple times.
 */
export const getProductStockAcrossWarehouses = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    // Log warning in production to identify usage
    if (process.env.NODE_ENV === 'production') {
      console.warn(`⚠️ Individual stock API called for product ${productId}. Consider using bulk endpoint instead.`);
    }
    
    const { data, error } = await supabase
      .from('warehouse_inventory')
      .select(`
        *,
        warehouses (
          id,
          name,
          code,
          is_active
        )
      `)
      .eq('product_id', productId)
      .order('stock_count', { ascending: false });
    
    if (error) {
      throw new ApiError(500, `Error fetching product stock: ${error.message}`);
    }
    
    const totalStock = data?.reduce((sum, item) => sum + (item.stock_count || 0), 0) || 0;
    
    return res.status(200).json({
      success: true,
      data: {
        warehouses: data || [],
        total_stock: totalStock
      },
      // Include deprecation notice in response
      deprecated: true,
      message: 'This endpoint is deprecated. Use POST /api/warehouses/products/bulk-stock for better performance.'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching product stock');
  }
};

// Get stock for multiple products across all warehouses (bulk endpoint)
export const getBulkProductStock = async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new ApiError(400, 'productIds array is required');
    }
    
    // Limit to prevent abuse
    if (productIds.length > 100) {
      throw new ApiError(400, 'Maximum 100 products allowed per request');
    }
    
    const { data, error } = await supabase
      .from('warehouse_inventory')
      .select(`
        *,
        warehouses (
          id,
          name,
          code,
          is_active
        )
      `)
      .in('product_id', productIds)
      .order('product_id', { ascending: true })
      .order('stock_count', { ascending: false });
    
    if (error) {
      throw new ApiError(500, `Error fetching product stock: ${error.message}`);
    }
    
    // Group by product_id and calculate totals
    const stockByProduct: Record<string, { warehouses: any[], total_stock: number }> = {};
    
    data?.forEach((item: any) => {
      if (!stockByProduct[item.product_id]) {
        stockByProduct[item.product_id] = {
          warehouses: [],
          total_stock: 0
        };
      }
      stockByProduct[item.product_id].warehouses.push(item);
      stockByProduct[item.product_id].total_stock += (item.stock_count || 0);
    });
    
    return res.status(200).json({
      success: true,
      data: stockByProduct
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching bulk product stock');
  }
};
