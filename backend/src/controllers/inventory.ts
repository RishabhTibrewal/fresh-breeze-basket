import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { ApiError } from '../utils/ApiError';

export const getInventory = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select(`
                *,
                products (
                    id,
                    name,
                    description,
                    price,
                    image_url
                )
            `)
            .order('created_at', { ascending: false });

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

export const getInventoryByProductId = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;

        const { data, error } = await supabase
            .from('inventory')
            .select(`
                *,
                products (
                    id,
                    name,
                    description,
                    price,
                    image_url
                )
            `)
            .eq('product_id', product_id)
            .single();

        if (error) {
            console.error('Supabase error fetching inventory by product ID:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch inventory'
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
        console.error('Error fetching inventory by product ID:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

export const updateInventory = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;
        const { quantity, low_stock_threshold, batch_number, expiry_date } = req.body;

        const { data, error } = await supabase
            .from('inventory')
            .update({
                quantity,
                low_stock_threshold,
                batch_number,
                expiry_date
            })
            .eq('product_id', product_id)
            .select()
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