import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all products with optional filtering
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, inStock, sortBy, limit, page } = req.query;
    
    let query = supabase.from('products').select('*');
    
    // Apply filters
    if (category) {
      query = query.eq('category_id', category);
    }
    
    if (minPrice) {
      query = query.gte('price', minPrice);
    }
    
    if (maxPrice) {
      query = query.lte('price', maxPrice);
    }
    
    if (inStock === 'true') {
      query = query.gt('stock_count', 0);
    }
    
    // Apply sorting
    if (sortBy === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sortBy === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    
    // Apply pagination
    const pageSize = parseInt(limit as string) || 10;
    const pageNumber = parseInt(page as string) || 1;
    const start = (pageNumber - 1) * pageSize;
    
    query = query.range(start, start + pageSize - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      count,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching products');
  }
};

// Get single product by ID
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new ApiError(404, 'Product not found');
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching product');
  }
};

// Create a new product (admin only)
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      price, 
      sale_price, 
      category_id, 
      image_url, 
      origin, 
      stock_count, 
      unit_type,
      is_featured,
      is_active,
      nutritional_info,
      best_before,
      slug
    } = req.body;
    
    // Validate required fields
    if (!name || !description || !price || !category_id) {
      throw new ApiError(400, 'Please provide all required fields');
    }
    
    // Generate a slug if not provided
    const productSlug = slug || name.toLowerCase().replace(/\s+/g, '-');
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        description,
        price,
        sale_price: sale_price || null,
        category_id,
        image_url: image_url || null,
        origin,
        stock_count: stock_count || 0,
        unit_type: unit_type || 'piece',
        is_featured: is_featured || false,
        is_active: is_active !== undefined ? is_active : true,
        nutritional_info: nutritional_info || null,
        best_before: best_before || null,
        slug: productSlug
      })
      .select();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating product');
  }
};

// Update a product (admin only)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { 
      name, 
      description, 
      price, 
      sale_price, 
      category_id, 
      image_url, 
      origin, 
      stock_count, 
      unit_type,
      is_featured,
      is_active,
      nutritional_info,
      best_before,
      slug
    } = req.body;
    
    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingProduct) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Update product
    const { data, error } = await supabase
      .from('products')
      .update({
        name: name || existingProduct.name,
        description: description || existingProduct.description,
        price: price || existingProduct.price,
        sale_price: sale_price !== undefined ? sale_price : existingProduct.sale_price,
        category_id: category_id || existingProduct.category_id,
        image_url: image_url !== undefined ? image_url : existingProduct.image_url,
        origin: origin || existingProduct.origin,
        stock_count: stock_count !== undefined ? stock_count : existingProduct.stock_count,
        unit_type: unit_type || existingProduct.unit_type,
        is_featured: is_featured !== undefined ? is_featured : existingProduct.is_featured,
        is_active: is_active !== undefined ? is_active : existingProduct.is_active,
        nutritional_info: nutritional_info !== undefined ? nutritional_info : existingProduct.nutritional_info,
        best_before: best_before || existingProduct.best_before,
        slug: slug || existingProduct.slug,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating product');
  }
};

// Delete a product (admin only)
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingProduct) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting product');
  }
}; 