import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
    
    // First get the product with its category
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('id', id)
      .single();
    
    if (productError || !product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 404
        }
      });
    }

    // Then get the product images
    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .order('display_order', { ascending: true });

    if (imagesError) {
      throw new ApiError(400, imagesError.message);
    }

    // Combine product data with images
    const productWithImages = {
      ...product,
      additionalImages: images?.map(img => img.image_url) || []
    };
    
    res.status(200).json({
      success: true,
      data: productWithImages
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching product',
          code: 500
        }
      });
    }
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
      slug,
      is_featured,
      is_active,
      stock_count,
      unit_type,
      nutritional_info,
      origin,
      best_before,
      unit,
      badge
    } = req.body;
    
    // Validate required fields
    if (!name || !price) {
      throw new ApiError(400, 'Please provide all required fields');
    }
    
    // Generate a slug if not provided
    const productSlug = slug || name.toLowerCase().replace(/\s+/g, '-');

    // Extract JWT from Authorization header
    const userJwt = req.headers.authorization?.replace('Bearer ', '');
    if (!userJwt) {
      throw new ApiError(401, 'Missing user token');
    }
    // Create a Supabase client with the user's JWT
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } }
    });

    const { data, error } = await supabaseWithAuth
      .from('products')
      .insert({
        name,
        description,
        price,
        sale_price: sale_price || null,
        category_id: category_id || null,
        image_url: image_url || null,
        slug: productSlug,
        is_featured: is_featured || false,
        is_active: is_active !== undefined ? is_active : true,
        stock_count: stock_count || 0,
        unit_type: unit_type || 'piece',
        nutritional_info: nutritional_info || null,
        origin: origin || null,
        best_before: best_before || null,
        unit: unit || null,
        badge: badge || null
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
    console.log('Updating product with ID:', id);
    console.log('Request body:', req.body);
    
    // Check if product exists
    console.log('Checking if product exists...');
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching existing product:', fetchError);
      throw new ApiError(404, 'Product not found');
    }
    
    if (!existingProduct) {
      console.error('Product not found with ID:', id);
      throw new ApiError(404, 'Product not found');
    }
    
    console.log('Existing product found:', existingProduct);
    
    // Prepare update data - only include fields that are provided in the request
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    // Handle each field only if it's provided in the request
    if ('name' in req.body) {
      updateData.name = req.body.name;
    }
    if ('description' in req.body) {
      updateData.description = req.body.description;
    }
    if ('price' in req.body) {
      updateData.price = parseFloat(req.body.price);
    }
    if ('sale_price' in req.body) {
      updateData.sale_price = req.body.sale_price ? parseFloat(req.body.sale_price) : null;
    }
    if ('stock_count' in req.body) {
      updateData.stock_count = parseInt(req.body.stock_count);
    }
    if ('category_id' in req.body) {
      updateData.category_id = req.body.category_id;
    }
    if ('unit_type' in req.body) {
      updateData.unit_type = req.body.unit_type;
    }
    if ('unit' in req.body) {
      updateData.unit = req.body.unit ? parseFloat(req.body.unit) : null;
    }
    if ('badge' in req.body) {
      updateData.badge = req.body.badge;
    }
    if ('is_featured' in req.body) {
      updateData.is_featured = Boolean(req.body.is_featured);
    }
    if ('is_active' in req.body) {
      updateData.is_active = Boolean(req.body.is_active);
    }
    if ('image_url' in req.body) {
      updateData.image_url = req.body.image_url;
    }
    if ('nutritional_info' in req.body) {
      updateData.nutritional_info = req.body.nutritional_info;
    }
    if ('origin' in req.body) {
      updateData.origin = req.body.origin;
    }
    if ('best_before' in req.body) {
      updateData.best_before = req.body.best_before;
    }
    if ('slug' in req.body) {
      updateData.slug = req.body.slug;
    }
    
    console.log('Prepared update data:', updateData);
    
    // Perform the update without select
    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating product:', updateError);
      throw new ApiError(400, updateError.message);
    }

    // Then fetch the updated product
    let { data: updatedProduct, error: fetchUpdateError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchUpdateError || !updatedProduct) {
      console.error('Error fetching updated product:', fetchUpdateError);
      throw new ApiError(500, 'Failed to fetch updated product');
    }

    // Verify critical numeric fields if they were updated
    const fieldsToVerify = ['stock_count', 'price', 'sale_price', 'unit'].filter(field => field in req.body);
    const verificationFailed = fieldsToVerify.some(field => {
      const expectedValue = field === 'stock_count' 
        ? parseInt(req.body[field])
        : parseFloat(req.body[field]);
      return !isNaN(expectedValue) && updatedProduct[field] !== expectedValue;
    });

    if (verificationFailed) {
      console.error('Update verification failed. Values do not match:', {
        expected: fieldsToVerify.reduce((acc, field) => ({
          ...acc,
          [field]: field === 'stock_count' ? parseInt(req.body[field]) : parseFloat(req.body[field])
        }), {}),
        received: fieldsToVerify.reduce((acc, field) => ({
          ...acc,
          [field]: updatedProduct[field]
        }), {})
      });

      // Add a small delay and try one more time
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: retryData, error: retryError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (retryError || !retryData) {
        throw new ApiError(500, 'Failed to verify product update after retry');
      }

      // Check if retry data has expected values
      const retryVerificationFailed = fieldsToVerify.some(field => {
        const expectedValue = field === 'stock_count' 
          ? parseInt(req.body[field])
          : parseFloat(req.body[field]);
        return !isNaN(expectedValue) && retryData[field] !== expectedValue;
      });

      if (!retryVerificationFailed) {
        console.log('Update verification succeeded after retry');
        updatedProduct = retryData;
      } else {
        console.error('Update verification failed after retry. Final values:', {
          expected: fieldsToVerify.reduce((acc, field) => ({
            ...acc,
            [field]: field === 'stock_count' ? parseInt(req.body[field]) : parseFloat(req.body[field])
          }), {}),
          received: fieldsToVerify.reduce((acc, field) => ({
            ...acc,
            [field]: retryData[field]
          }), {})
        });
        throw new ApiError(500, 'Product update verification failed - database did not return expected values');
      }
    }
    
    console.log('Product updated successfully:', updatedProduct);
    
    res.status(200).json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
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