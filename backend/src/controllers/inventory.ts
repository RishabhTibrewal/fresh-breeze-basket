import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get inventory across all warehouses or filter by warehouse
export const getInventory = async (req: Request, res: Response) => {
    try {
        const { warehouse_id } = req.query;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }
        
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
                    code
                )
            `)
            .eq('company_id', req.companyId)
            .order('created_at', { ascending: false });
        
        if (warehouse_id) {
            query = query.eq('warehouse_id', warehouse_id);
        }
        
        const { data, error } = await query;

        if (error) {
            console.error('Supabase error fetching inventory:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch inventory'
            });
        }

        return res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Get inventory for a specific product across all warehouses
export const getInventoryByProductId = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        const { data, error } = await supabase
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
            .eq('product_id', product_id)
            .eq('company_id', req.companyId);

        if (error) {
            console.error('Supabase error fetching inventory by product ID:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch inventory'
            });
        }

        const totalStock = data?.reduce((sum, item) => sum + (item.stock_count || 0), 0) || 0;

        return res.json({
            success: true,
            data: {
                warehouses: data || [],
                total_stock: totalStock
            }
        });
    } catch (error) {
        console.error('Error fetching inventory by product ID:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Update inventory for a specific product in a specific warehouse
export const updateInventory = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;
        const { warehouse_id, stock_count, location } = req.body;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        if (!warehouse_id) {
            return res.status(400).json({
                success: false,
                error: 'warehouse_id is required'
            });
        }

        // Check if inventory already exists
        const { data: existingInventory, error: fetchError } = await supabase
            .from('warehouse_inventory')
            .select('stock_count')
            .eq('warehouse_id', warehouse_id)
            .eq('product_id', product_id)
            .eq('company_id', req.companyId)
            .maybeSingle();

        if (fetchError) {
            console.error('Supabase error fetching inventory:', fetchError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch inventory'
            });
        }

        // Calculate new stock_count: add to existing if exists, otherwise set to provided value
        const currentStock = existingInventory?.stock_count || 0;
        const stockToAdd = stock_count !== undefined ? stock_count : 0;
        const newStockCount = currentStock + stockToAdd;

        // Upsert warehouse inventory (insert or update)
        const { data, error } = await supabase
            .from('warehouse_inventory')
            .upsert({
                warehouse_id,
                product_id,
                stock_count: newStockCount,
                location,
                company_id: req.companyId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'warehouse_id,product_id'
            })
            .select(`
                *,
                products (
                    id,
                    name,
                    description,
                    price,
                    image_url
                ),
                warehouses (
                    id,
                    name,
                    code
                )
            `)
            .single();

        if (error) {
            console.error('Supabase error updating inventory:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update inventory'
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Inventory not found'
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error updating inventory:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}; 