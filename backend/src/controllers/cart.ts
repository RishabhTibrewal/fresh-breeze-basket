import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../utils/ApiError';

const db = () => supabaseAdmin || supabase;

/**
 * Atomically get or create the cart for a user.
 * Handles the race-condition where two concurrent requests both see "no cart"
 * and both try to INSERT — the second one would hit the unique constraint.
 * We catch error code 23505 (duplicate key) and fall back to fetching the
 * cart that the first concurrent request just created.
 */
async function getOrCreateCart(userId: string, companyId: string): Promise<string> {
    // 1. Try to find an existing cart first
    const { data: existing, error: fetchError } = await db()
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing.id;

    // 2. No cart found — try to create one
    const { data: newCart, error: createError } = await db()
        .from('carts')
        .insert([{ user_id: userId, company_id: companyId }])
        .select('id')
        .single();

    if (createError) {
        if (createError.code === '23505') {
            // Race condition: another concurrent request already created the cart.
            // Fetch the one that was just created.
            const { data: racedCart, error: raceFetchError } = await db()
                .from('carts')
                .select('id')
                .eq('user_id', userId)
                .eq('company_id', companyId)
                .single();

            if (raceFetchError) throw raceFetchError;
            return racedCart.id;
        }
        throw createError;
    }

    return newCart.id;
}

// Get user's cart
export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }

        const cartId = await getOrCreateCart(userId, req.companyId);

        // Get cart items with product + variant + variant price details
        const { data: cartItems, error: itemsError } = await db()
            .from('cart_items')
            .select(`
                id,
                quantity,
                variant_id,
                products (
                    id,
                    name,
                    description,
                    image_url,
                    category_id,
                    is_active,
                    slug
                ),
                variant:product_variants!variant_id (
                    id,
                    name,
                    sku,
                    image_url,
                    unit,
                    unit_type,
                    is_default,
                    price:product_prices!price_id (
                        id,
                        sale_price,
                        mrp_price,
                        price_type
                    )
                )
            `)
            .eq('cart_id', cartId)
            .eq('company_id', req.companyId);

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

        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }

        const { product_id, quantity, variant_id } = req.body;

        if (!product_id || !quantity) {
            return res.status(400).json({ success: false, error: 'Product ID and quantity are required' });
        }

        if (!variant_id) {
            return res.status(400).json({ success: false, error: 'Variant ID is required' });
        }

        // Get or create cart — race-condition safe
        const cartId = await getOrCreateCart(userId, req.companyId);

        // Validate variant belongs to the product and is active
        // Note: we only filter by variant_id + product_id (not company_id) because
        // product_variants.company_id may not always be set, and the product_id FK
        // already anchors the variant to the correct company's product.
        const { data: variant, error: variantError } = await db()
            .from('product_variants')
            .select('id, is_active, product_id')
            .eq('id', variant_id)
            .eq('product_id', product_id)
            .single();

        if (variantError || !variant) {
            return res.status(404).json({ success: false, error: 'Variant not found for this product' });
        }

        if (!variant.is_active) {
            return res.status(400).json({ success: false, error: 'Variant is not active' });
        }

        // Check if this exact variant is already in the cart
        const { data: existingItem, error: existingError } = await db()
            .from('cart_items')
            .select('id, quantity')
            .eq('cart_id', cartId)
            .eq('variant_id', variant_id)
            .eq('company_id', req.companyId)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existingItem) {
            // Update quantity if this variant is already in cart
            const { error: updateError } = await db()
                .from('cart_items')
                .update({ quantity: existingItem.quantity + quantity })
                .eq('id', existingItem.id)
                .eq('company_id', req.companyId);

            if (updateError) throw updateError;
        } else {
            // Add new item to cart with variant_id
            const { error: insertError } = await db()
                .from('cart_items')
                .insert([{ cart_id: cartId, product_id, variant_id, quantity, company_id: req.companyId }]);

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

        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }

        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity) {
            return res.status(400).json({ success: false, error: 'Quantity is required' });
        }

        // Check if item exists in user's cart
        const { data: cartItem, error: checkError } = await db()
            .from('cart_items')
            .select('id, cart_id')
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();

        if (checkError || !cartItem) {
            return res.status(404).json({ success: false, error: 'Cart item not found' });
        }

        // Verify cart ownership
        const { data: cart, error: cartError } = await db()
            .from('carts')
            .select('id')
            .eq('id', cartItem.cart_id)
            .eq('user_id', userId)
            .eq('company_id', req.companyId)
            .single();

        if (cartError || !cart) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this cart item' });
        }

        // Update quantity
        const { error: updateError } = await db()
            .from('cart_items')
            .update({ quantity })
            .eq('id', id)
            .eq('company_id', req.companyId);

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

        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }

        const { id } = req.params;

        // Check if item exists in user's cart
        const { data: cartItem, error: checkError } = await db()
            .from('cart_items')
            .select('id, cart_id')
            .eq('id', id)
            .eq('company_id', req.companyId)
            .single();

        if (checkError || !cartItem) {
            return res.status(404).json({ success: false, error: 'Cart item not found' });
        }

        // Verify cart ownership
        const { data: cart, error: cartError } = await db()
            .from('carts')
            .select('id')
            .eq('id', cartItem.cart_id)
            .eq('user_id', userId)
            .eq('company_id', req.companyId)
            .single();

        if (cartError || !cart) {
            return res.status(403).json({ success: false, error: 'Not authorized to remove this cart item' });
        }

        // Delete item
        const { error: deleteError } = await db()
            .from('cart_items')
            .delete()
            .eq('id', id)
            .eq('company_id', req.companyId);

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

        if (!req.companyId) {
            return res.status(400).json({ success: false, error: 'Company context is required' });
        }

        const { error } = await db()
            .from('carts')
            .delete()
            .eq('user_id', userId)
            .eq('company_id', req.companyId);

        if (error) throw error;

        res.json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ success: false, error: 'Failed to clear cart' });
    }
}; 