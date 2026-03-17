import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { ApiError } from '../middleware/error';
import { InventoryService } from '../services/core/InventoryService';
import { ProductService } from '../services/core/ProductService';

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
        
        let query = (supabaseAdmin || supabase)
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

        const { data, error } = await (supabaseAdmin || supabase)
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
// Uses InventoryService to record stock movements
// REQUIRES variant_id in request body (use DEFAULT variant if product has no visible variants)
export const updateInventory = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;
        const { warehouse_id, variant_id, stock_count, location, notes } = req.body;

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

        // Get variant_id - use provided or get DEFAULT variant
        let finalVariantId = variant_id;
        if (!finalVariantId) {
            const productService = new ProductService(req.companyId);
            const defaultVariant = await productService.getDefaultVariant(product_id);
            finalVariantId = defaultVariant.id;
        }

        const inventoryService = new InventoryService(req.companyId);

        // Get current stock (requires variantId)
        const currentStock = await inventoryService.getCurrentStock(product_id, warehouse_id, finalVariantId);

        // Calculate adjustment
        const adjustment = stock_count !== undefined ? stock_count - currentStock : 0;

        if (adjustment !== 0) {
            // Record stock movement (requires variantId)
            await inventoryService.recordStockMovement({
                productId: product_id,
                variantId: finalVariantId,
                outletId: warehouse_id,
                movementType: 'ADJUSTMENT',
                quantity: adjustment,
                referenceType: 'adjustment',
                notes: notes || `Manual inventory adjustment`,
                createdBy: req.user?.id,
            });
        }

        // Update location if provided
        if (location) {
            await supabaseAdmin
            .from('warehouse_inventory')
            .upsert({
                warehouse_id,
                product_id,
                    variant_id: finalVariantId,
                location,
                company_id: req.companyId,
                updated_at: new Date().toISOString()
            }, {
                    onConflict: 'warehouse_id,product_id,variant_id'
                });
        }

        // Fetch updated inventory
        const { data, error } = await supabaseAdmin
            .from('warehouse_inventory')
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
                ),
                variant:product_variants (
                    id,
                    name,
                    sku,
                    price_id,
                    price:product_prices!price_id (
                        id,
                        sale_price,
                        mrp_price,
                        price_type
                    )
                )
            `)
            .eq('warehouse_id', warehouse_id)
            .eq('product_id', product_id)
            .eq('variant_id', finalVariantId)
            .eq('company_id', req.companyId)
            .single();

        if (error) {
            console.error('Supabase error fetching inventory:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch inventory'
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error: any) {
        console.error('Error updating inventory:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Record stock movement (new endpoint)
// REQUIRES variant_id in request body (use DEFAULT variant if product has no visible variants)
export const recordStockMovement = async (req: Request, res: Response) => {
    try {
        const {
            product_id,
            variant_id,
            outlet_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            notes
        } = req.body;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        if (!product_id || !outlet_id || !movement_type || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'product_id, outlet_id, movement_type, and quantity are required'
            });
        }

        // Get variant_id - use provided or get DEFAULT variant
        let finalVariantId = variant_id;
        if (!finalVariantId) {
            const productService = new ProductService(req.companyId);
            const defaultVariant = await productService.getDefaultVariant(product_id);
            finalVariantId = defaultVariant.id;
        }

        const inventoryService = new InventoryService(req.companyId);

        const movementId = await inventoryService.recordStockMovement({
            productId: product_id,
            variantId: finalVariantId, // Now required
            outletId: outlet_id,
            movementType: movement_type,
            quantity,
            referenceType: reference_type || null,
            referenceId: reference_id || null,
            notes: notes || null,
            createdBy: req.user?.id,
        });

        return res.json({
            success: true,
            data: { id: movementId }
        });
    } catch (error: any) {
        console.error('Error recording stock movement:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

/**
 * POST /api/inventory/adjust
 * Adjust stock to match physical count
 * 
 * Body: {
 *   warehouse_id: string;
 *   product_id: string;
 *   variant_id: string;
 *   physical_quantity: number;
 *   reason: string; // Required: explanation for adjustment
 * }
 */
export const adjustStock = async (req: Request, res: Response) => {
    try {
        const {
            warehouse_id,
            product_id,
            variant_id,
            physical_quantity,
            reason
        } = req.body;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        // Validate required fields
        if (!warehouse_id || !product_id || !variant_id) {
            return res.status(400).json({
                success: false,
                error: 'warehouse_id, product_id, and variant_id are required'
            });
        }

        if (physical_quantity === undefined || physical_quantity === null) {
            return res.status(400).json({
                success: false,
                error: 'physical_quantity is required'
            });
        }

        if (physical_quantity < 0) {
            return res.status(400).json({
                success: false,
                error: 'physical_quantity cannot be negative'
            });
        }

        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'reason is required for stock adjustment'
            });
        }

        const inventoryService = new InventoryService(req.companyId);

        const result = await inventoryService.adjustStock({
            warehouseId: warehouse_id,
            productId: product_id,
            variantId: variant_id,
            physicalQuantity: physical_quantity,
            reason: reason.trim(),
            createdBy: req.user?.id,
        });

        return res.json({
            success: true,
            data: {
                movement_id: result.movementId,
                difference: result.difference,
                new_stock_count: result.newStockCount,
                message: result.movementId 
                    ? `Stock adjusted by ${result.difference > 0 ? '+' : ''}${result.difference}`
                    : 'Stock already matches physical count'
            }
        });
    } catch (error: any) {
        console.error('Error adjusting stock:', error);
        
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

/**
 * POST /api/inventory/transfer
 * Transfer stock between warehouses
 * 
 * Body: {
 *   source_warehouse_id: string;
 *   destination_warehouse_id: string;
 *   items: Array<{
 *     product_id: string;
 *     variant_id: string;
 *     quantity: number; // Must be > 0
 *   }>;
 *   notes?: string;
 * }
 */
export const transferStock = async (req: Request, res: Response) => {
    try {
        const {
            source_warehouse_id,
            destination_warehouse_id,
            items,
            notes
        } = req.body;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        // Validate required fields
        if (!source_warehouse_id || !destination_warehouse_id) {
            return res.status(400).json({
                success: false,
                error: 'source_warehouse_id and destination_warehouse_id are required'
            });
        }

        if (source_warehouse_id === destination_warehouse_id) {
            return res.status(400).json({
                success: false,
                error: 'Source and destination warehouses cannot be the same'
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'items array is required and cannot be empty'
            });
        }

        // Validate each item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.product_id || !item.variant_id) {
                return res.status(400).json({
                    success: false,
                    error: `Item ${i + 1}: product_id and variant_id are required`
                });
            }
            if (!item.quantity || item.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: `Item ${i + 1}: quantity must be greater than 0`
                });
            }
        }

        const inventoryService = new InventoryService(req.companyId);

        const result = await inventoryService.transferStock({
            sourceWarehouseId: source_warehouse_id,
            destinationWarehouseId: destination_warehouse_id,
            items: items.map(item => ({
                productId: item.product_id,
                variantId: item.variant_id,
                quantity: item.quantity,
            })),
            notes: notes || null,
            createdBy: req.user?.id,
        });

        return res.json({
            success: true,
            data: {
                transfer_id: result.transferId,
                movements: result.movements,
                message: `Successfully transferred ${result.movements.length} item(s) between warehouses`
            }
        });
    } catch (error: any) {
        console.error('Error transferring stock:', error);
        
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Get stock movements list
export const getStockMovements = async (req: Request, res: Response) => {
    try {
        const { 
            product_id, 
            warehouse_id, 
            variant_id,
            movement_type, 
            start_date,
            end_date,
            limit = 100, 
            offset = 0 
        } = req.query;

        if (!req.companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company context is required'
            });
        }

        // Use supabaseAdmin to bypass RLS for admin queries
        const client = supabaseAdmin || supabase;
        
        let query = client
            .from('stock_movements')
            .select(`
                *,
                products (
                    id,
                    name
                ),
                warehouses (
                    id,
                    name,
                    code
                ),
                product_variants (
                    id,
                    name,
                    sku
                )
            `)
            .eq('company_id', req.companyId)
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (product_id) {
            query = query.eq('product_id', product_id as string);
        }

        if (variant_id) {
            query = query.eq('variant_id', variant_id as string);
        }

        if (warehouse_id) {
            query = query.eq('outlet_id', warehouse_id as string);
        }

        if (movement_type) {
            query = query.eq('movement_type', movement_type as string);
        }

        if (start_date) {
            // Parse as midnight UTC to ensure consistency regardless of server timezone
            const startDate = new Date(start_date as string);
            query = query.gte('created_at', startDate.toISOString());
        }

        if (end_date) {
            // Add one day (in UTC) to include the entire end date
            const endDate = new Date(end_date as string);
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            query = query.lt('created_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error fetching stock movements:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch stock movements',
                details: error.message
            });
        }

        // Debug logging
        console.log('Stock movements query result:', {
            companyId: req.companyId,
            filters: { product_id, warehouse_id, variant_id, movement_type, start_date, end_date },
            count: data?.length || 0,
            sample: data?.[0] ? {
                id: data[0].id,
                hasProducts: !!data[0].products,
                hasWarehouses: !!data[0].warehouses,
                hasProductVariants: !!data[0].product_variants,
                productsType: Array.isArray(data[0].products) ? 'array' : typeof data[0].products,
            } : null
        });

        // Fetch user information from profiles table for movements that have created_by
        const userIds = [...new Set((data || []).map((m: any) => m.created_by).filter(Boolean))];
        let userMap: Record<string, { id: string; email: string }> = {};
        
        if (userIds.length > 0) {
            const { data: profiles } = await client
                .from('profiles')
                .select('id, email')
                .in('id', userIds);
            
            if (profiles) {
                userMap = profiles.reduce((acc: any, profile: any) => {
                    acc[profile.id] = {
                        id: profile.id,
                        email: profile.email || 'Unknown'
                    };
                    return acc;
                }, {});
            }
        }

        // Map Supabase response to frontend interface
        // Supabase returns: products, warehouses, product_variants (plural)
        // Frontend expects: product, warehouse, variant (singular)
        const movementsWithUsers = (data || []).map((movement: any) => {
            const mapped: any = {
                id: movement.id,
                product_id: movement.product_id,
                variant_id: movement.variant_id,
                outlet_id: movement.outlet_id,
                movement_type: movement.movement_type,
                quantity: movement.quantity,
                reference_type: movement.reference_type,
                reference_id: movement.reference_id,
                notes: movement.notes,
                company_id: movement.company_id,
                created_by: movement.created_by,
                created_at: movement.created_at,
            };

            // Map products (plural) to product (singular)
            if (movement.products) {
                // Supabase can return array or object, handle both
                const product = Array.isArray(movement.products) 
                    ? movement.products[0] 
                    : movement.products;
                if (product) {
                    mapped.product = {
                        id: product.id,
                        name: product.name,
                    };
                }
            }

            // Map warehouses (plural) to warehouse (singular)
            if (movement.warehouses) {
                // Supabase can return array or object, handle both
                const warehouse = Array.isArray(movement.warehouses)
                    ? movement.warehouses[0]
                    : movement.warehouses;
                if (warehouse) {
                    mapped.warehouse = {
                        id: warehouse.id,
                        name: warehouse.name,
                        code: warehouse.code,
                    };
                }
            }

            // Map product_variants (plural) to variant (singular)
            if (movement.product_variants) {
                // Supabase can return array or object, handle both
                const variant = Array.isArray(movement.product_variants)
                    ? movement.product_variants[0]
                    : movement.product_variants;
                if (variant) {
                    mapped.variant = {
                        id: variant.id,
                        name: variant.name,
                        sku: variant.sku,
                    };
                }
            }

            // Attach user information
            if (movement.created_by && userMap[movement.created_by]) {
                mapped.user = userMap[movement.created_by];
            }

            return mapped;
        });

        return res.json({
            success: true,
            data: movementsWithUsers || []
        });
    } catch (error: any) {
        console.error('Error fetching stock movements:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Packaging Recipes CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const getPackagingRecipes = async (req: Request, res: Response) => {
    try {
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('packaging_recipes')
            .select(`
                *,
                input_products:products!input_product_id(id, name),
                input_product_variants:product_variants!input_variant_id(id, name, unit, unit_type),
                output_products:products!output_product_id(id, name),
                output_product_variants:product_variants!output_variant_id(id, name, unit, unit_type)
            `)
            .eq('company_id', req.companyId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching packaging recipes:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.json({ success: true, data: data || [] });
    } catch (err: any) {
        console.error('Error in getPackagingRecipes:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const createPackagingRecipe = async (req: Request, res: Response) => {
    try {
        const { input_product_id, input_variant_id, output_product_id, output_variant_id, conversion_ratio } = req.body;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        if (!input_product_id || !input_variant_id || !output_product_id || !output_variant_id || conversion_ratio == null) {
            return res.status(400).json({ success: false, error: 'input_product_id, input_variant_id, output_product_id, output_variant_id, and conversion_ratio are required' });
        }
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('packaging_recipes')
            .insert({
                company_id: req.companyId,
                input_product_id,
                input_variant_id,
                output_product_id,
                output_variant_id,
                conversion_ratio: parseFloat(conversion_ratio),
            })
            .select()
            .single();
        if (error) {
            console.error('Error creating packaging recipe:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.status(201).json({ success: true, data });
    } catch (err: any) {
        console.error('Error in createPackagingRecipe:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const updatePackagingRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { conversion_ratio } = req.body;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const updatePayload: Record<string, unknown> = {};
        if (conversion_ratio != null) updatePayload.conversion_ratio = parseFloat(conversion_ratio);
        if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }
        const { data, error } = await client
            .from('packaging_recipes')
            .update(updatePayload)
            .eq('id', id)
            .eq('company_id', req.companyId)
            .select()
            .single();
        if (error) {
            console.error('Error updating packaging recipe:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.json({ success: true, data });
    } catch (err: any) {
        console.error('Error in updatePackagingRecipe:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const deletePackagingRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { error } = await client
            .from('packaging_recipes')
            .delete()
            .eq('id', id)
            .eq('company_id', req.companyId);
        if (error) {
            console.error('Error deleting packaging recipe:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.json({ success: true, message: 'Packaging recipe deleted' });
    } catch (err: any) {
        console.error('Error in deletePackagingRecipe:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Repack Orders CRUD + Process
// ─────────────────────────────────────────────────────────────────────────────

export const getRepackOrders = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, status } = req.query;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        let query = client
            .from('repack_orders')
            .select(`
                *,
                warehouses(id, name, code)
            `)
            .eq('company_id', req.companyId)
            .order('created_at', { ascending: false });
        if (warehouse_id) query = query.eq('warehouse_id', warehouse_id as string);
        if (status) query = query.eq('status', status as string);
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching repack orders:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.json({ success: true, data: data || [] });
    } catch (err: any) {
        console.error('Error in getRepackOrders:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const getRepackOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('repack_orders')
            .select(`
                *,
                warehouses(id, name, code)
            `)
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();
        if (error || !data) {
            return res.status(404).json({ success: false, error: 'Repack order not found' });
        }
        const { data: items } = await client
            .from('repack_order_items')
            .select(`
                *,
                input_products:products!input_product_id(id, name),
                input_product_variants:product_variants!input_variant_id(id, name, unit, unit_type),
                output_products:products!output_product_id(id, name),
                output_product_variants:product_variants!output_variant_id(id, name, unit, unit_type)
            `)
            .eq('repack_order_id', id);
        return res.json({ success: true, data: { ...data, items: items || [] } });
    } catch (err: any) {
        console.error('Error in getRepackOrderById:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const createRepackOrder = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, notes, items } = req.body;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        if (!warehouse_id) {
            return res.status(400).json({ success: false, error: 'warehouse_id is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'items array is required and cannot be empty' });
        }
        const client = supabaseAdmin || supabase;
        const { data: order, error: orderError } = await client
            .from('repack_orders')
            .insert({
                company_id: req.companyId,
                warehouse_id,
                status: 'draft',
                notes: notes || null,
                created_by: req.user?.id || null,
            })
            .select()
            .single();
        if (orderError) {
            console.error('Error creating repack order:', orderError);
            return res.status(500).json({ success: false, error: orderError.message });
        }
        const itemRows = items.map((it: { input_product_id: string; input_variant_id: string; input_quantity: number; output_product_id: string; output_variant_id: string; output_quantity: number; wastage_quantity?: number; additional_cost_per_unit?: number }) => ({
            repack_order_id: order.id,
            input_product_id: it.input_product_id,
            input_variant_id: it.input_variant_id,
            input_quantity: it.input_quantity,
            output_product_id: it.output_product_id,
            output_variant_id: it.output_variant_id,
            output_quantity: it.output_quantity,
            wastage_quantity: it.wastage_quantity ?? 0,
            additional_cost_per_unit: it.additional_cost_per_unit ?? 0,
        }));
        const { error: itemsError } = await client
            .from('repack_order_items')
            .insert(itemRows);
        if (itemsError) {
            await client.from('repack_orders').delete().eq('id', order.id);
            return res.status(500).json({ success: false, error: itemsError.message });
        }
        const { data: full } = await client
            .from('repack_orders')
            .select('*, repack_order_items(*)')
            .eq('id', order.id)
            .single();
        return res.status(201).json({ success: true, data: full || order });
    } catch (err: any) {
        console.error('Error in createRepackOrder:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const updateRepackOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes, items } = req.body;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { data: existing } = await client
            .from('repack_orders')
            .select('status')
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Repack order not found' });
        }
        if (existing.status !== 'draft') {
            return res.status(400).json({ success: false, error: 'Only draft repack orders can be updated' });
        }
        const updates: Record<string, unknown> = {};
        if (notes !== undefined) updates.notes = notes;
        if (Object.keys(updates).length > 0) {
            await client.from('repack_orders').update(updates).eq('id', id).eq('company_id', req.companyId);
        }
        if (items && Array.isArray(items)) {
            await client.from('repack_order_items').delete().eq('repack_order_id', id);
            if (items.length > 0) {
                const itemRows = items.map((it: { input_product_id: string; input_variant_id: string; input_quantity: number; output_product_id: string; output_variant_id: string; output_quantity: number; wastage_quantity?: number; additional_cost_per_unit?: number }) => ({
                    repack_order_id: id,
                    input_product_id: it.input_product_id,
                    input_variant_id: it.input_variant_id,
                    input_quantity: it.input_quantity,
                    output_product_id: it.output_product_id,
                    output_variant_id: it.output_variant_id,
                    output_quantity: it.output_quantity,
                    wastage_quantity: it.wastage_quantity ?? 0,
                    additional_cost_per_unit: it.additional_cost_per_unit ?? 0,
                }));
                await client.from('repack_order_items').insert(itemRows);
            }
        }
        const { data } = await client
            .from('repack_orders')
            .select('*, repack_order_items(*)')
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();
        return res.json({ success: true, data: data || {} });
    } catch (err: any) {
        console.error('Error in updateRepackOrder:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const processRepackOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { data, error } = await client.rpc('process_repack_order', {
            p_repack_order_id: id,
            p_company_id: req.companyId,
            p_created_by: req.user?.id || null,
        });
        if (error) {
            console.error('Error processing repack order:', error);
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.json({ success: true, data });
    } catch (err: any) {
        console.error('Error in processRepackOrder:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};

export const deleteRepackOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }
        const client = supabaseAdmin || supabase;
        const { data: existing } = await client
            .from('repack_orders')
            .select('status')
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Repack order not found' });
        }
        if (existing.status !== 'draft') {
            return res.status(400).json({ success: false, error: 'Only draft repack orders can be deleted' });
        }
        const { error } = await client
            .from('repack_orders')
            .delete()
            .eq('id', id)
            .eq('company_id', req.companyId);
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        return res.json({ success: true, message: 'Repack order deleted' });
    } catch (err: any) {
        console.error('Error in deleteRepackOrder:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
};
