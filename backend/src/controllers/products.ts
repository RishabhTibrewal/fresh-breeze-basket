import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ProductService } from '../services/core/ProductService';

// Get all products with optional filtering
export const getProducts = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { category, minPrice, maxPrice, inStock, sortBy, limit, page, format } = req.query;
    
    const client = supabaseAdmin || supabase;
    
    // Check if legacy format requested
    const useLegacyFormat = format === 'legacy';
    
    if (useLegacyFormat) {
      // Legacy format - return flat product array (backward compatibility)
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
      
      return res.status(200).json({
        success: true,
        count,
        data,
        deprecated: true,
        message: 'Legacy format. Use default format to get variants information.'
      });
    }
    
    // New format - include variants with prices, brand, tax
    // Fetch products first (without nested variants - PostgREST nested selects are unreliable)
    let query = client
      .from('products')
      .select(`
        *,
        brand:brands (
          id,
          name,
          logo_url
        )
      `);

    if (req.companyId) {
      query = query.eq('company_id', req.companyId);
    }
    
    // Apply filters
    if (category) {
      query = query.eq('category_id', category);
    }
    
    // Price filtering now applies to variant prices
    // Note: This filters products that have at least one variant matching the price range
    if (minPrice || maxPrice) {
      // We'll filter in application logic after fetching
    }
    
    // Note: stock_count filtering is deprecated - use warehouse_inventory for accurate stock
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
    
    const { data: products, error, count } = await query;
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    if (!products || products.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    // Fetch all variants for these products in a separate query (more reliable than nested selects)
    const productIds = products.map((p: any) => p.id);
    const { data: allVariants, error: variantsError } = await client
      .from('product_variants')
      .select(`
        *,
        price:product_prices!price_id (
          id,
          sale_price,
          mrp_price,
          price_type
        ),
        brand:brands (
          id,
          name,
          logo_url
        ),
        tax:taxes (
          id,
          name,
          rate
        )
      `)
      .in('product_id', productIds)
      // CRITICAL: Explicit company_id filter when using admin client (RLS bypassed)
      // Include variants with matching company_id OR NULL company_id (inherit from product)
      .or(`company_id.eq.${req.companyId},company_id.is.null`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (variantsError) {
      console.error('Error fetching variants:', variantsError);
      // Continue without variants rather than failing
    }
    
    // No application-level company_id filtering:
    // Products are already filtered by company_id above. Variants tied to those products via
    // product_id FK implicitly belong to the same company — don't filter them further.
    const allFilteredVariants = allVariants || [];
    
    if (productIds.length > 0) {
      console.log(`[getProducts] Fetched ${allFilteredVariants.length} variants for ${productIds.length} products`);
    }
    
    // Group variants by product_id
    const variantsByProductId: Record<string, any[]> = {};
    allFilteredVariants.forEach((variant: any) => {
      if (!variantsByProductId[variant.product_id]) {
        variantsByProductId[variant.product_id] = [];
      }
      variantsByProductId[variant.product_id].push(variant);
    });
    
    // Process products to include variants and default_variant_id
    const processedProducts = products.map((product: any) => {
      const variants = variantsByProductId[product.id] || [];
      const defaultVariant = variants.find((v: any) => v.is_default === true);
      
      // Filter variants by price if minPrice/maxPrice specified
      let filteredVariants = variants;
      if (minPrice || maxPrice) {
        filteredVariants = variants.filter((v: any) => {
          const salePrice = v.price?.sale_price || 0;
          if (minPrice && salePrice < parseFloat(minPrice as string)) return false;
          if (maxPrice && salePrice > parseFloat(maxPrice as string)) return false;
          return true;
        });
      }
      
      return {
        ...product,
        variants: filteredVariants,
        default_variant_id: defaultVariant?.id || null,
      };
    }).filter((product: any) => {
      // If price filter was applied and no variants match, exclude product
      if ((minPrice || maxPrice) && product.variants.length === 0) {
        return false;
      }
      return true;
    });
    
    res.status(200).json({
      success: true,
      count,
      data: processedProducts
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
    const { include } = req.query;
    
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

    // Check if variants should be included (default: yes)
    const includeVariants = include !== 'false';

    if (!includeVariants) {
      // Legacy format - return product without variants
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
            message: `Product with ID '${id}' not found or does not belong to your company`,
            code: 404
          }
        });
      }

      // Get product images
      const { data: images, error: imagesError } = await client
        .from('product_images')
        .select('*')
        .eq('product_id', id)
        .is('variant_id', null)
        .eq('company_id', req.companyId)
        .order('display_order', { ascending: true });

      if (imagesError) {
        throw new ApiError(400, imagesError.message);
      }

      return res.status(200).json({
        success: true,
        data: {
          ...product,
          additionalImages: images?.map(img => img.image_url) || []
        },
        deprecated: true,
        message: 'Legacy format. Use default format (include !== false) to get variants information.'
      });
    }

    // New format - include variants with prices, brand, tax, images
    // Fetch product first (without nested variants - PostgREST nested selects are unreliable)
    const { data: product, error: productError } = await client
      .from('products')
      .select(`
        *,
        categories (*),
        brand:brands (
          id,
          name,
          logo_url
        )
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (productError || !product) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Product with ID '${id}' not found or does not belong to your company`,
          code: 404
        }
      });
    }

    // Fetch variants separately (more reliable than nested selects)
    const { data: variants, error: variantsError } = await client
      .from('product_variants')
      .select(`
        *,
        price:product_prices!price_id (
          id,
          sale_price,
          mrp_price,
          price_type
        ),
        brand:brands (
          id,
          name,
          logo_url
        ),
        tax:taxes (
          id,
          name,
          rate
        ),
        variant_images:product_images!variant_id (
          id,
          image_url,
          display_order
        )
      `)
      .eq('product_id', id)
      // CRITICAL: Explicit company_id filter when using admin client (RLS bypassed)
      // Include variants with matching company_id OR NULL company_id (inherit from product)
      .or(`company_id.eq.${req.companyId},company_id.is.null`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (variantsError) {
      console.error('Error fetching variants:', variantsError);
      // Continue without variants rather than failing
    }

    // No application-level company_id filtering:
    // Product is already verified to belong to req.companyId above. Variants tied to this
    // product via product_id FK implicitly belong to the same company.
    const filteredVariants = variants || [];

    // Get product-level images (not variant-specific)
    const { data: productImages, error: imagesError } = await client
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .is('variant_id', null)
      .eq('company_id', req.companyId)
      .order('display_order', { ascending: true });

    if (imagesError) {
      console.error('Error fetching product images:', imagesError);
      // Don't fail, just log
    }

    // Process variants - keep variant_images in the response
    const processedVariants = filteredVariants.map((variant: any) => ({
      ...variant,
      // Keep variant_images as is (don't rename to images)
      variant_images: variant.variant_images || [],
    }));

    // Find default variant
    const defaultVariant = processedVariants.find((v: any) => v.is_default === true);

    // Structure response according to plan
    const response = {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        category_id: product.category_id,
        price: product.price,
        sale_price: product.sale_price,
        slug: product.slug,
        is_active: product.is_active,
        stock_count: product.stock_count,
        brand_id: product.brand_id,
        brand: product.brand,
        category: product.categories,
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
      variants: processedVariants, // Keep variant_images in each variant
      images: productImages?.map(img => img.image_url) || [],
      default_variant_id: defaultVariant?.id || null,
    };
    
    res.status(200).json({
      success: true,
      data: response
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
// Uses ProductService which automatically creates DEFAULT variant
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
      tax,
      brand_id, // Product-level brand
      variants // Optional: array of variant objects with variant-level fields
    } = req.body;
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Validate required fields
    if (!name) {
      throw new ApiError(400, 'Product name is required');
    }
    
    // Use ProductService to create product with automatic DEFAULT variant
    const productService = new ProductService(req.companyId);
    
    const initialStock = parseInt(stock_count, 10) || 0;

    // Price is optional - defaults to 0 if not provided (pricing is managed at variant level)
    // If variants are provided with prices, those will be used
    const productPrice = price !== undefined && price !== null ? parseFloat(price) : 0;

    // Note: Deprecated product-level fields (image_url, is_featured, unit, unit_type, 
    // best_before, tax, hsn_code, badge) are still accepted for backward compatibility
    // but will be applied to the DEFAULT variant
    const result = await productService.createProduct(
      {
        name,
        description,
        price: productPrice,
        sale_price,
        category_id,
        image_url, // Deprecated: will be applied to DEFAULT variant
        slug,
        is_featured, // Deprecated: will be applied to DEFAULT variant
        is_active,
        unit_type, // Deprecated: will be applied to DEFAULT variant
        nutritional_info,
        origin,
        best_before, // Deprecated: will be applied to DEFAULT variant
        unit, // Deprecated: will be applied to DEFAULT variant
        badge, // Deprecated: will be applied to DEFAULT variant
        product_code,
        hsn_code, // Deprecated: will be applied to DEFAULT variant as 'hsn'
        tax, // Deprecated: will be applied to DEFAULT variant
        brand_id, // Product-level brand
      },
      variants, // Optional variants array - can include variant-level fields
      warehouse_id || null,
      initialStock
    );

    res.status(201).json({
      success: true,
      data: {
        ...result.product,
        default_variant: result.defaultVariant,
        variants: result.variants,
      }
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error.message || 'Error creating product');
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
    const { data: existingProduct, error: fetchError } = await (supabaseAdmin || supabase)
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
    if ('brand_id' in req.body && req.body.brand_id !== undefined) {
      // Validate brand_id if provided
      if (req.body.brand_id) {
        const { data: brand, error: brandError } = await (supabaseAdmin || supabase)
          .from('brands')
          .select('id')
          .eq('id', req.body.brand_id)
          .eq('company_id', req.companyId)
          .single();

        if (brandError || !brand) {
          throw new ApiError(
            404,
            `Brand with ID '${req.body.brand_id}' not found or does not belong to your company. Please select a valid brand.`
          );
        }
      }
      updateData.brand_id = req.body.brand_id || null;
    }
    
    console.log('Prepared update data:', updateData);
    
    // Perform the update with company_id filter
    const { error: updateError } = await (supabaseAdmin || supabase)
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
    let { data: updatedProduct, error: fetchUpdateError } = await (supabaseAdmin || supabase)
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (fetchUpdateError || !updatedProduct) {
      console.error('Error fetching updated product:', fetchUpdateError);
      throw new ApiError(500, 'Failed to fetch updated product');
    }

    // Ensure default variant exists after update
    const productService = new ProductService(req.companyId);
    try {
      const productPrice = updatedProduct.price || 0;
      await productService.ensureDefaultVariant(id, productPrice);
    } catch (variantError) {
      // Log but don't fail the update if variant creation fails
      console.error('Error ensuring default variant after product update:', variantError);
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

      const { data: retryData, error: retryError } = await (supabaseAdmin || supabase)
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
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Check if product exists
    const { data: existingProduct, error: fetchError } = await (supabaseAdmin || supabase)
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (fetchError || !existingProduct) {
      throw new ApiError(
        404,
        `Product with ID '${id}' not found or does not belong to your company`
      );
    }
    
    // Delete product (cascade will delete variants and prices)
    const { error } = await (supabaseAdmin || supabase)
      .from('products')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);
    
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

// Get all variants for a product
export const getProductVariants = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Always use admin client to bypass RLS
    const client = supabaseAdmin || supabase;
    const isUsingAdmin = !!supabaseAdmin;
    
    console.log(`[getProductVariants] Using ${isUsingAdmin ? 'admin' : 'anon'} client for product ${id}, company ${req.companyId}`);

    // Verify product exists
    const { data: product, error: productError } = await client
      .from('products')
      .select('id, name, company_id')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (productError || !product) {
      console.error(`[getProductVariants] Product not found:`, productError);
      throw new ApiError(
        404,
        `Product with ID '${id}' not found or does not belong to your company`
      );
    }
    
    console.log(`[getProductVariants] Product verified: ${product.name} (company: ${product.company_id})`);

    // First, try a simple query to verify variants exist
    console.log(`[getProductVariants] Testing simple variant query for product_id: ${id}`);
    const { data: testVariants, error: testError } = await client
      .from('product_variants')
      .select('id, name, product_id, company_id')
      .eq('product_id', id);
    
    console.log(`[getProductVariants] Simple query result: ${testVariants?.length || 0} variants, error: ${testError?.message || 'none'}`);
    if (testVariants && testVariants.length > 0) {
      console.log(`[getProductVariants] Sample test variant:`, testVariants[0]);
    }

    // Get all variants with prices, brand, tax, images
    // Since product is already verified to belong to company, we can rely on product_id FK for company isolation
    // Filter by product_id only - variants inherit company context from product
    console.log(`[getProductVariants] Fetching full variant data for product_id: ${id}`);
    
    // Try full query with all nested data first
    let { data: variants, error: variantsError } = await client
      .from('product_variants')
      .select(`
        *,
        price:product_prices!price_id (
          id,
          sale_price,
          mrp_price,
          price_type
        ),
        brand:brands (
          id,
          name,
          logo_url
        ),
        tax:taxes (
          id,
          name,
          rate
        ),
        variant_images:product_images!variant_id (
          id,
          image_url,
          display_order
        )
      `)
      .eq('product_id', id)
      // CRITICAL: Explicit company_id filter when using admin client (RLS bypassed)
      // Include variants with matching company_id OR NULL company_id (inherit from product)
      .or(`company_id.eq.${req.companyId},company_id.is.null`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    // If nested query fails, try simpler query without variant_images
    if (variantsError) {
      console.warn('[getProductVariants] Full query failed, trying without variant_images:', variantsError.message);
      const simpleResult = await client
        .from('product_variants')
        .select(`
          *,
          price:product_prices!price_id (
            id,
            sale_price,
            mrp_price,
            price_type
          ),
          brand:brands (
            id,
            name,
            logo_url
          ),
          tax:taxes (
            id,
            name,
            rate
          )
        `)
        .eq('product_id', id)
        // CRITICAL: Explicit company_id filter when using admin client (RLS bypassed)
        // Include variants with matching company_id OR NULL company_id (inherit from product)
        .or(`company_id.eq.${req.companyId},company_id.is.null`)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (simpleResult.error) {
        console.error('[getProductVariants] Simple query also failed:', simpleResult.error);
        throw new ApiError(500, `Failed to fetch variants: ${simpleResult.error.message}`);
      }
      
      variants = simpleResult.data;
      variantsError = null;
      
      // Fetch variant images separately if needed
      if (variants && variants.length > 0) {
        const variantIds = variants.map((v: any) => v.id);
        const { data: images } = await client
          .from('product_images')
          .select('*')
          .in('variant_id', variantIds)
          .order('display_order', { ascending: true });
        
        // Attach images to variants
        if (images) {
          const imagesByVariantId: Record<string, any[]> = {};
          images.forEach((img: any) => {
            if (!imagesByVariantId[img.variant_id]) {
              imagesByVariantId[img.variant_id] = [];
            }
            imagesByVariantId[img.variant_id].push(img);
          });
          
          variants = variants.map((v: any) => ({
            ...v,
            variant_images: imagesByVariantId[v.id] || []
          }));
        }
      }
    }
    
    // No application-level company_id filtering needed:
    // - Product was already verified to belong to req.companyId (step above)
    // - Variants are tied to the product via product_id FK
    // - Therefore all variants for this product implicitly belong to this company
    const allVariants = variants || [];
    console.log(`[getProductVariants] Returning ${allVariants.length} variants for product ${id}`);

    res.status(200).json({
      success: true,
      data: allVariants,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching variants',
          code: 500,
        },
      });
    }
  }
};

// Get single variant by ID
export const getVariantById = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;

    const { data: variant, error: variantError } = await client
      .from('product_variants')
      .select(`
        *,
        product:products (
          id,
          name,
          description
        ),
        price:product_prices!price_id (
          id,
          sale_price,
          mrp_price,
          price_type
        ),
        brand:brands (
          id,
          name,
          logo_url
        ),
        tax:taxes (
          id,
          name,
          rate
        ),
        variant_images:product_images!variant_id (
          id,
          image_url,
          display_order
        )
      `)
      .eq('id', variantId)
      .eq('company_id', req.companyId)
      .single();

    if (variantError || !variant) {
      throw new ApiError(
        404,
        `Variant with ID '${variantId}' not found for product '${variant?.product?.name || 'unknown'}'. Ensure variant belongs to the product and your company.`
      );
    }

    res.status(200).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching variant',
          code: 500,
        },
      });
    }
  }
};

// Create a new variant for a product
export const createVariant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // product_id
    const {
      name,
      sku,
      sale_price,
      mrp_price,
      image_url,
      is_featured,
      is_active,
      unit,
      unit_type,
      best_before,
      tax_id,
      hsn,
      badge,
      brand_id,
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (!name || name.trim() === '') {
      throw new ApiError(400, 'Variant name is required');
    }

    // Validate pricing if provided
    if (sale_price !== undefined && mrp_price !== undefined) {
      if (sale_price > mrp_price) {
        throw new ApiError(
          400,
          `Invalid pricing for variant '${name}': sale_price (${sale_price}) cannot be greater than mrp_price (${mrp_price}). MRP must be equal to or greater than sale price.`
        );
      }
    }

    const productService = new ProductService(req.companyId);
    const variant = await productService.createVariant(id, {
      name,
      sku: sku === '' ? null : sku,
      sale_price,
      mrp_price,
      image_url: image_url === '' ? null : image_url,
      is_featured,
      is_active,
      unit,
      unit_type,
      best_before: best_before === '' ? null : best_before,
      tax_id: tax_id === '' ? null : tax_id,
      hsn: hsn === '' ? null : hsn,
      badge: badge === '' ? null : badge,
      brand_id: brand_id === '' ? null : brand_id,
    });

    res.status(201).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while creating variant',
          code: 500,
        },
      });
    }
  }
};

// Update a variant
export const updateVariant = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const {
      name,
      sku,
      sale_price,
      mrp_price,
      image_url,
      is_featured,
      is_active,
      unit,
      unit_type,
      best_before,
      tax_id,
      hsn,
      badge,
      brand_id,
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Validate pricing if both provided
    if (sale_price !== undefined && mrp_price !== undefined) {
      if (sale_price > mrp_price) {
        throw new ApiError(
          400,
          `Invalid pricing: sale_price (${sale_price}) cannot be greater than mrp_price (${mrp_price}). MRP must be equal to or greater than sale price.`
        );
      }
    }

    const productService = new ProductService(req.companyId);
    const variant = await productService.updateVariant(variantId, {
      name,
      sku: sku === '' ? null : sku,
      sale_price,
      mrp_price,
      image_url: image_url === '' ? null : image_url,
      is_featured,
      is_active,
      unit,
      unit_type,
      best_before: best_before === '' ? null : best_before,
      tax_id: tax_id === '' ? null : tax_id,
      hsn: hsn === '' ? null : hsn,
      badge: badge === '' ? null : badge,
      brand_id: brand_id === '' ? null : brand_id,
    });

    res.status(200).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while updating variant',
          code: 500,
        },
      });
    }
  }
};

// Delete a variant
export const deleteVariant = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const productService = new ProductService(req.companyId);
    await productService.deleteVariant(variantId);

    res.status(200).json({
      success: true,
      message: 'Variant deleted successfully',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while deleting variant',
          code: 500,
        },
      });
    }
  }
};