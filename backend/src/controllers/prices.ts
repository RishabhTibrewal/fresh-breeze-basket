import { Request, Response } from 'express';
import { supabaseAdmin, supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all prices for a variant
export const getVariantPrices = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const { price_type, outlet_id } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;

    // Verify variant exists
    const { data: variant, error: variantError } = await client
      .from('product_variants')
      .select('id, name, product:products(name)')
      .eq('id', variantId)
      .eq('company_id', req.companyId)
      .single();

    if (variantError || !variant) {
      throw new ApiError(
        404,
        `Variant with ID '${variantId}' not found. Ensure variant belongs to your company.`
      );
    }

    let query = client
      .from('product_prices')
      .select('*')
      .eq('variant_id', variantId)
      .eq('company_id', req.companyId)
      .order('price_type', { ascending: true })
      .order('valid_from', { ascending: false });

    if (price_type) {
      query = query.eq('price_type', price_type);
    }

    if (outlet_id) {
      query = query.or(`outlet_id.is.null,outlet_id.eq.${outlet_id}`);
    } else {
      query = query.is('outlet_id', null);
    }

    const { data: prices, error: pricesError } = await query;

    if (pricesError) {
      throw new ApiError(500, `Failed to fetch prices: ${pricesError.message}`);
    }

    res.status(200).json({
      success: true,
      data: prices || [],
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
          message: 'An unexpected error occurred while fetching prices',
          code: 500,
        },
      });
    }
  }
};

// Get single price by ID
export const getPriceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;

    const { data: price, error: priceError } = await client
      .from('product_prices')
      .select(`
        *,
        variant:product_variants (
          id,
          name,
          sku
        ),
        product:products (
          id,
          name
        ),
        outlet:outlets (
          id,
          name,
          code
        )
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (priceError || !price) {
      throw new ApiError(
        404,
        `Price with ID '${id}' not found or does not belong to your company.`
      );
    }

    res.status(200).json({
      success: true,
      data: price,
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
          message: 'An unexpected error occurred while fetching price',
          code: 500,
        },
      });
    }
  }
};

// Create a new price entry for a variant
export const createPrice = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const {
      price_type = 'standard',
      sale_price,
      mrp_price,
      outlet_id,
      brand_id,
      valid_from,
      valid_until,
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (!sale_price || sale_price < 0) {
      throw new ApiError(400, 'sale_price is required and must be non-negative');
    }

    const mrp = mrp_price !== undefined ? mrp_price : sale_price;

    // Validate: sale_price <= mrp_price
    if (sale_price > mrp) {
      throw new ApiError(
        400,
        `Invalid pricing: sale_price (${sale_price}) cannot be greater than mrp_price (${mrp}). MRP must be equal to or greater than sale price.`
      );
    }

    const client = supabaseAdmin || supabase;

    // Verify variant exists
    const { data: variant, error: variantError } = await client
      .from('product_variants')
      .select('id, name, product_id, product:products(name)')
      .eq('id', variantId)
      .eq('company_id', req.companyId)
      .single();

    if (variantError || !variant) {
      throw new ApiError(
        404,
        `Variant with ID '${variantId}' not found. Ensure variant belongs to your company.`
      );
    }

    const product = Array.isArray(variant.product)
      ? variant.product[0]
      : variant.product;

    // Check for existing price with same type and outlet
    if (price_type === 'standard' && !outlet_id) {
      // Standard prices should be unique per variant
      const { data: existingStandard, error: checkError } = await client
        .from('product_prices')
        .select('id')
        .eq('variant_id', variantId)
        .eq('price_type', 'standard')
        .is('outlet_id', null)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new ApiError(500, `Failed to check existing prices: ${checkError.message}`);
      }

      if (existingStandard) {
        throw new ApiError(
          409,
          `Variant '${variant.name}' already has a standard price entry. Update the existing price instead.`
        );
      }
    }

    // Create price entry
    const { data: price, error: priceError } = await client
      .from('product_prices')
      .insert({
        product_id: variant.product_id,
        variant_id: variantId,
        outlet_id: outlet_id || null,
        price_type: price_type,
        sale_price: sale_price,
        mrp_price: mrp,
        brand_id: brand_id || null,
        valid_from: valid_from || new Date().toISOString(),
        valid_until: valid_until || null,
        company_id: req.companyId,
      })
      .select()
      .single();

    if (priceError) {
      console.error('Error creating price:', priceError);
      if (priceError.code === '23505') {
        throw new ApiError(
          409,
          'A price entry with these parameters already exists. Please update the existing entry instead.'
        );
      }
      throw new ApiError(500, `Failed to create price: ${priceError.message}`);
    }

    // If this is a standard price and variant doesn't have a price_id, link it
    if (price_type === 'standard' && !outlet_id) {
      const { error: linkError } = await client
        .from('product_variants')
        .update({ price_id: price.id })
        .eq('id', variantId)
        .eq('company_id', req.companyId);

      if (linkError) {
        console.error('Error linking price to variant:', linkError);
        // Don't fail, just log - variant might already have a price_id
      }
    }

    res.status(201).json({
      success: true,
      data: price,
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
          message: 'An unexpected error occurred while creating price',
          code: 500,
        },
      });
    }
  }
};

// Update a price entry
export const updatePrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      sale_price,
      mrp_price,
      outlet_id,
      brand_id,
      valid_from,
      valid_until,
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Always use admin client to bypass RLS for backend operations
    const client = supabaseAdmin;
    if (!client) {
      throw new ApiError(500, 'Admin client not configured');
    }

    // Get existing price
    const { data: existingPrice, error: fetchError } = await client
      .from('product_prices')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existingPrice) {
      throw new ApiError(
        404,
        `Price with ID '${id}' not found or does not belong to your company.`
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (sale_price !== undefined) {
      if (sale_price < 0) {
        throw new ApiError(400, 'sale_price must be non-negative');
      }
      updateData.sale_price = sale_price;
    }

    if (mrp_price !== undefined) {
      if (mrp_price < 0) {
        throw new ApiError(400, 'mrp_price must be non-negative');
      }
      updateData.mrp_price = mrp_price;
    }

    // Validate: sale_price <= mrp_price
    const finalSalePrice = sale_price !== undefined ? sale_price : existingPrice.sale_price;
    const finalMrpPrice = mrp_price !== undefined ? mrp_price : existingPrice.mrp_price;

    if (finalSalePrice > finalMrpPrice) {
      throw new ApiError(
        400,
        `Invalid pricing: sale_price (${finalSalePrice}) cannot be greater than mrp_price (${finalMrpPrice}). MRP must be equal to or greater than sale price.`
      );
    }

    if (outlet_id !== undefined) {
      updateData.outlet_id = outlet_id || null;
    }

    if (brand_id !== undefined) {
      updateData.brand_id = brand_id || null;
    }

    if (valid_from !== undefined) {
      updateData.valid_from = valid_from || new Date().toISOString();
    }

    if (valid_until !== undefined) {
      updateData.valid_until = valid_until || null;
    }

    // Update price
    // Note: We already verified the price exists and belongs to the company above,
    // so we can safely update by id only. The company_id filter is redundant but
    // kept for defense-in-depth.
    const { data: updatedPrice, error: updateError } = await client
      .from('product_prices')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('Error updating price:', updateError);
      throw new ApiError(500, `Failed to update price: ${updateError.message}`);
    }

    if (!updatedPrice) {
      // This should not happen since we verified the price exists above,
      // but handle it gracefully in case of race conditions
      throw new ApiError(
        404,
        `Price with ID '${id}' was not found or could not be updated. It may have been deleted.`
      );
    }

    res.status(200).json({
      success: true,
      data: updatedPrice,
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
          message: 'An unexpected error occurred while updating price',
          code: 500,
        },
      });
    }
  }
};

// Delete a price entry
export const deletePrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;

    // Get existing price to check if it's a standard price
    const { data: existingPrice, error: fetchError } = await client
      .from('product_prices')
      .select('*, variant:product_variants(id, name, price_id)')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existingPrice) {
      throw new ApiError(
        404,
        `Price with ID '${id}' not found or does not belong to your company.`
      );
    }

    const variant = Array.isArray(existingPrice.variant)
      ? existingPrice.variant[0]
      : existingPrice.variant;

    // Prevent deletion of standard price if it's linked to variant
    if (existingPrice.price_type === 'standard' && variant?.price_id === id) {
      throw new ApiError(
        400,
        `Cannot delete standard price: This price is linked to variant '${variant.name}'. Update the variant's price_id first or set another price as standard.`
      );
    }

    // Delete price
    const { error: deleteError } = await client
      .from('product_prices')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (deleteError) {
      console.error('Error deleting price:', deleteError);
      throw new ApiError(500, `Failed to delete price: ${deleteError.message}`);
    }

    res.status(200).json({
      success: true,
      message: 'Price deleted successfully',
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
          message: 'An unexpected error occurred while deleting price',
          code: 500,
        },
      });
    }
  }
};

