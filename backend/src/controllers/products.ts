import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getDefaultWarehouseId, updateWarehouseStock } from '../utils/warehouseInventory';

// Get all products with optional filtering
export const getProducts = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { category, minPrice, maxPrice, inStock, sortBy, limit, page } = req.query;
    
    const client = supabaseAdmin || supabase;
    let query = client.from('products').select('*');

    if (req.companyId) {
      query = query.eq('company_id', req.companyId);
    }
    
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
    
    // Note: stock_count filtering is deprecated - use warehouse_inventory for accurate stock
    // Keeping this for backward compatibility but it may not reflect accurate multi-warehouse stock
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
    
    // Apply pagination only if limit is provided
    if (limit) {
      const pageSize = parseInt(limit as string);
      const pageNumber = parseInt(page as string) || 1;
      const start = (pageNumber - 1) * pageSize;
      query = query.range(start, start + pageSize - 1);
    }
    
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
    
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Company context is required',
          code: 400
        }
      });
    }
    
    const client = supabaseAdmin || supabase;

    // First get the product with its category
    const { data: product, error: productError } = await client
      .from('products')
      .select('*, categories(*)')
      .eq('id', id)
      .eq('company_id', req.companyId)
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
    const { data: images, error: imagesError } = await client
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .eq('company_id', req.companyId)
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
      warehouse_id,
      unit_type,
      nutritional_info,
      origin,
      best_before,
      unit,
      badge,
      product_code,
      hsn_code,
      tax
    } = req.body;
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

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
        // Stock is managed in warehouse_inventory; keep product.stock_count at 0
        stock_count: 0,
        unit_type: unit_type || 'piece',
        nutritional_info: nutritional_info || null,
        origin: origin || null,
        best_before: best_before || null,
        unit: unit || null,
        badge: badge || null,
        product_code: product_code || null,
        hsn_code: hsn_code || null,
        tax: tax !== undefined && tax !== null && tax !== '' ? parseFloat(tax) : null,
        company_id: req.companyId
      })
      .select();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    const createdProduct = data[0];

    // Resolve warehouse for initial inventory
    const initialStock = parseInt(stock_count, 10) || 0;
    let selectedWarehouseId = warehouse_id;
    if (selectedWarehouseId) {
      const { data: warehouse, error: warehouseError } = await supabaseWithAuth
        .from('warehouses')
        .select('id, is_active')
        .eq('id', selectedWarehouseId)
        .single();

      if (warehouseError || !warehouse || !warehouse.is_active) {
        await supabaseWithAuth.from('products').delete().eq('id', createdProduct.id);
        throw new ApiError(400, 'Selected warehouse is invalid or inactive');
      }
    } else {
      const defaultWarehouseId = await getDefaultWarehouseId(req.companyId);
      if (!defaultWarehouseId) {
        // Rollback product creation to avoid inconsistent state
        await supabaseWithAuth.from('products').delete().eq('id', createdProduct.id);
        throw new ApiError(500, 'Default warehouse not found for stock initialization');
      }
      selectedWarehouseId = defaultWarehouseId;
    }

    try {
      // Upsert inventory even when initialStock is 0
      await updateWarehouseStock(createdProduct.id, selectedWarehouseId, initialStock, req.companyId, false, true);
    } catch (inventoryError) {
      // Rollback product creation to avoid inconsistent state
      await supabaseWithAuth.from('products').delete().eq('id', createdProduct.id);
      throw new ApiError(500, 'Failed to initialize warehouse inventory for product');
    }

    res.status(201).json({
      success: true,
      data: createdProduct
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
    
    // Verify company_id matches
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Check if product exists and belongs to the company
    console.log('Checking if product exists...');
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
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

    // Handle each field only if it's provided in the request and has a valid value
    if ('name' in req.body && req.body.name !== undefined && req.body.name !== null) {
      updateData.name = req.body.name;
    }
    if ('description' in req.body && req.body.description !== undefined) {
      updateData.description = req.body.description;
    }
    if ('price' in req.body && req.body.price !== undefined && req.body.price !== null) {
      const priceValue = typeof req.body.price === 'number' ? req.body.price : parseFloat(req.body.price);
      if (!isNaN(priceValue)) {
        updateData.price = priceValue;
      }
    }
    if ('sale_price' in req.body && req.body.sale_price !== undefined) {
      if (req.body.sale_price === null || req.body.sale_price === '') {
        updateData.sale_price = null;
      } else {
        const salePriceValue = typeof req.body.sale_price === 'number' ? req.body.sale_price : parseFloat(req.body.sale_price);
        if (!isNaN(salePriceValue)) {
          updateData.sale_price = salePriceValue;
        }
      }
    }
    if ('stock_count' in req.body && req.body.stock_count !== undefined && req.body.stock_count !== null) {
      const stockValue = typeof req.body.stock_count === 'number' ? req.body.stock_count : parseInt(req.body.stock_count);
      if (!isNaN(stockValue)) {
        updateData.stock_count = stockValue;
      }
    }
    if ('category_id' in req.body && req.body.category_id !== undefined) {
      updateData.category_id = req.body.category_id || null;
    }
    if ('unit_type' in req.body && req.body.unit_type !== undefined && req.body.unit_type !== null) {
      updateData.unit_type = req.body.unit_type;
    }
    if ('unit' in req.body && req.body.unit !== undefined) {
      if (req.body.unit === null || req.body.unit === '') {
        updateData.unit = null;
      } else {
        const unitValue = typeof req.body.unit === 'number' ? req.body.unit : parseFloat(req.body.unit);
        if (!isNaN(unitValue)) {
          updateData.unit = unitValue;
        }
      }
    }
    if ('badge' in req.body && req.body.badge !== undefined) {
      updateData.badge = req.body.badge || null;
    }
    if ('is_featured' in req.body && req.body.is_featured !== undefined) {
      updateData.is_featured = Boolean(req.body.is_featured);
    }
    if ('is_active' in req.body && req.body.is_active !== undefined) {
      updateData.is_active = Boolean(req.body.is_active);
    }
    if ('image_url' in req.body && req.body.image_url !== undefined) {
      updateData.image_url = req.body.image_url || null;
    }
    if ('nutritional_info' in req.body && req.body.nutritional_info !== undefined) {
      updateData.nutritional_info = req.body.nutritional_info || null;
    }
    if ('origin' in req.body && req.body.origin !== undefined) {
      updateData.origin = req.body.origin || null;
    }
    if ('best_before' in req.body && req.body.best_before !== undefined) {
      updateData.best_before = req.body.best_before || null;
    }
    if ('slug' in req.body && req.body.slug !== undefined && req.body.slug !== null) {
      updateData.slug = req.body.slug;
    }
    if ('product_code' in req.body && req.body.product_code !== undefined) {
      updateData.product_code = req.body.product_code === '' ? null : req.body.product_code;
    }
    if ('hsn_code' in req.body && req.body.hsn_code !== undefined) {
      updateData.hsn_code = req.body.hsn_code === '' ? null : req.body.hsn_code;
    }
    if ('tax' in req.body && req.body.tax !== undefined) {
      if (req.body.tax === null || req.body.tax === '') {
        updateData.tax = null;
      } else {
        const taxValue = typeof req.body.tax === 'number' ? req.body.tax : parseFloat(req.body.tax);
        if (!isNaN(taxValue) && taxValue >= 0 && taxValue <= 100) {
          updateData.tax = taxValue;
        }
      }
    }
    
    console.log('Prepared update data:', updateData);
    
    // Perform the update with company_id filter
    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId);
    
    if (updateError) {
      console.error('Error updating product:', updateError);
      console.error('Update data:', updateData);
      console.error('Product ID:', id);
      console.error('Company ID:', req.companyId);
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
      throw new ApiError(400, `Failed to update product: ${errorMessage}`);
    }

    // Then fetch the updated product
    let { data: updatedProduct, error: fetchUpdateError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
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