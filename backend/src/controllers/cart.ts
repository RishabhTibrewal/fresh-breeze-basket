import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { ApiError } from '../utils/ApiError';

// Get user's cart
export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // First get or create the user's cart
        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (cartError && cartError.code !== 'PGRST116') {
            throw cartError;
        }

        let cartId;
        if (!cart) {
            // Create a new cart if it doesn't exist
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert([{ user_id: userId }])
                .select('id')
                .single();

            if (createError) throw createError;
            cartId = newCart.id;
        } else {
            cartId = cart.id;
        }

        // Get cart items with product details
        const { data: cartItems, error: itemsError } = await supabase
            .from('cart_items')
            .select(`
                id,
                quantity,
                products (
                    id,
                    name,
                    description,
                    price,
                    image_url,
                    category_id,
                    is_active,
                    is_featured
                )
            `)
            .eq('cart_id', cartId);

        if (itemsError) throw itemsError;

        res.json({ success: true, data: cartItems });
    } catch (error) {
        console.error('Error getting cart:', error);
        res.status(500).json({ success: false, error: 'Failed to get cart' });
    }
};

// Add item to cart
export const addToCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { product_id, quantity } = req.body;

        if (!product_id || !quantity) {
            return res.status(400).json({ success: false, error: 'Product ID and quantity are required' });
        }

        // First get or create the user's cart
        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (cartError && cartError.code !== 'PGRST116') {
            throw cartError;
        }

        let cartId;
        if (!cart) {
            // Create a new cart if it doesn't exist
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert([{ user_id: userId }])
                .select('id')
                .single();

            if (createError) throw createError;
            cartId = newCart.id;
        } else {
            cartId = cart.id;
        }

        // Check if product exists and is active
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, is_active')
            .eq('id', product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        if (!product.is_active) {
            return res.status(400).json({ success: false, error: 'Product is not active' });
        }

        // Check if item already exists in cart
        const { data: existingItem, error: existingError } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('cart_id', cartId)
            .eq('product_id', product_id)
            .single();

        if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
        }

        if (existingItem) {
            // Update quantity if item exists
            const { error: updateError } = await supabase
                .from('cart_items')
                .update({ quantity: existingItem.quantity + quantity })
                .eq('id', existingItem.id);

            if (updateError) throw updateError;
        } else {
            // Add new item to cart
            const { error: insertError } = await supabase
                .from('cart_items')
                .insert([{ cart_id: cartId, product_id, quantity }]);

            if (insertError) throw insertError;
        }

        res.json({ success: true, message: 'Item added to cart' });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, error: 'Failed to add item to cart' });
    }
};

// Update cart item quantity
export const updateCartItem = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity) {
            return res.status(400).json({ success: false, error: 'Quantity is required' });
        }

        // Check if item exists in user's cart
        const { data: cartItem, error: checkError } = await supabase
            .from('cart_items')
            .select('id, cart_id')
            .eq('id', id)
            .single();

        if (checkError || !cartItem) {
            return res.status(404).json({ success: false, error: 'Cart item not found' });
        }

        // Verify cart ownership
        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .select('id')
            .eq('id', cartItem.cart_id)
            .eq('user_id', userId)
            .single();

        if (cartError || !cart) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this cart item' });
        }

        // Update quantity
        const { error: updateError } = await supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Cart item updated' });
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ success: false, error: 'Failed to update cart item' });
    }
};

// Remove item from cart
export const removeFromCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { id } = req.params;

        // Check if item exists in user's cart
        const { data: cartItem, error: checkError } = await supabase
            .from('cart_items')
            .select('id, cart_id')
            .eq('id', id)
            .single();

        if (checkError || !cartItem) {
            return res.status(404).json({ success: false, error: 'Cart item not found' });
        }

        // Verify cart ownership
        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .select('id')
            .eq('id', cartItem.cart_id)
            .eq('user_id', userId)
            .single();

        if (cartError || !cart) {
            return res.status(403).json({ success: false, error: 'Not authorized to remove this cart item' });
        }

        // Delete item
        const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ success: false, error: 'Failed to remove item from cart' });
    }
};

// Clear cart
export const clearCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { error } = await supabase
            .from('carts')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ success: false, error: 'Failed to clear cart' });
    }
}; 