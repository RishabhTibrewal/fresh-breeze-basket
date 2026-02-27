import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

export const addProductImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    const { image_url, is_primary = false, display_order = 0, variant_id } = req.body;

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    if (!image_url) {
      throw new ValidationError('Image URL is required');
    }

    // At least one of product_id or variant_id must be provided
    if (!product_id && !variant_id) {
      throw new ValidationError('Either product_id or variant_id must be provided');
    }

    // If variant_id is provided, verify it exists and belongs to the company
    if (variant_id) {
      const { data: variant, error: variantError } = await (supabaseAdmin || supabase)
        .from('product_variants')
        .select('id, product_id')
        .eq('id', variant_id)
        .eq('company_id', req.companyId)
        .single();

      if (variantError || !variant) {
        throw new ApiError(
          404,
          `Variant with ID '${variant_id}' not found. Cannot assign image to non-existent variant. Ensure variant exists and belongs to your company.`
        );
      }

      // If product_id is also provided, ensure it matches the variant's product_id
      if (product_id && variant.product_id !== product_id) {
        throw new ApiError(
          400,
          `Product ID mismatch: Variant '${variant_id}' belongs to product '${variant.product_id}', not '${product_id}'.`
        );
      }
    }

    // If is_primary is true, unset other primary images for the same product/variant
    if (is_primary === true) {
      let unsetPrimaryQuery = (supabaseAdmin || supabase)
        .from('product_images')
        .update({ is_primary: false })
        .eq('company_id', req.companyId);

      if (product_id) {
        unsetPrimaryQuery = unsetPrimaryQuery.eq('product_id', product_id);
      } else {
        unsetPrimaryQuery = unsetPrimaryQuery.is('product_id', null);
      }

      if (variant_id) {
        unsetPrimaryQuery = unsetPrimaryQuery.eq('variant_id', variant_id);
      } else {
        unsetPrimaryQuery = unsetPrimaryQuery.is('variant_id', null);
      }

      await unsetPrimaryQuery;
    }

    const { data, error } = await (supabaseAdmin || supabase)
      .from('product_images')
      .insert([
        {
          product_id: product_id || null,
          variant_id: variant_id || null,
          company_id: req.companyId,
          image_url,
          is_primary,
          display_order
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product image:', error);
      throw new ApiError(500, `Error adding product image: ${error.message}`);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const getProductImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    const { variant_id } = req.query; // Optional variant_id query parameter

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Normalize variant_id: treat 'null', null, undefined, or empty string as null
    const normalizedVariantId = variant_id && variant_id !== 'null' && variant_id !== '' 
      ? variant_id 
      : null;

    let query = (supabaseAdmin || supabase)
      .from('product_images')
      .select('*')
      .eq('company_id', req.companyId);

    // Filter by product_id if provided
    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    // Filter by variant_id if provided (and not null)
    if (normalizedVariantId) {
      query = query.eq('variant_id', normalizedVariantId);
    } else if (product_id) {
      // If product_id is provided but variant_id is null, get images for the product only (not variant-specific)
      query = query.is('variant_id', null);
    }

    // If neither product_id nor variant_id provided, return error
    if (!product_id && !normalizedVariantId) {
      throw new ApiError(400, 'Either product_id or variant_id must be provided');
    }

    query = query.order('display_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new ApiError(500, 'Error fetching product images');
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const updateProductImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { image_url, is_primary, display_order, variant_id } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // First get the current image to check if display_order is changing
    const { data: currentImage, error: fetchError } = await (supabaseAdmin || supabase)
      .from('product_images')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError) {
      throw new ApiError(404, 'Image not found');
    }

    // Determine target product_id and variant_id (use updated values if provided, otherwise current)
    const targetProductId = currentImage.product_id;
    const targetVariantId = variant_id !== undefined ? variant_id : currentImage.variant_id;

    // Validate: At least one of product_id or variant_id must be present
    if (!targetProductId && !targetVariantId) {
      throw new ApiError(400, 'Image must be associated with either a product or a variant');
    }

    // If display_order is changing, we need to update other images for the same product/variant
    if (display_order !== undefined && display_order !== currentImage.display_order) {
      // Build query to get all images for the same product/variant combination
      let imagesQuery = (supabaseAdmin || supabase)
        .from('product_images')
        .select('*')
        .eq('company_id', req.companyId)
        .order('display_order', { ascending: true });

      // Filter by product_id if present
      if (targetProductId) {
        imagesQuery = imagesQuery.eq('product_id', targetProductId);
      } else {
        imagesQuery = imagesQuery.is('product_id', null);
      }

      // Filter by variant_id if present
      if (targetVariantId) {
        imagesQuery = imagesQuery.eq('variant_id', targetVariantId);
      } else {
        imagesQuery = imagesQuery.is('variant_id', null);
      }

      const { data: allImages, error: allImagesError } = await imagesQuery;

      if (allImagesError) {
        throw new ApiError(500, 'Error fetching product images');
      }

      // Update display orders
      const updates = allImages.map(async (image) => {
        let newOrder = image.display_order;
        
        if (image.id === id) {
          newOrder = display_order;
        } else if (display_order < currentImage.display_order) {
          // Moving image up in order
          if (image.display_order >= display_order && image.display_order < currentImage.display_order) {
            newOrder = image.display_order + 1;
          }
        } else if (display_order > currentImage.display_order) {
          // Moving image down in order
          if (image.display_order <= display_order && image.display_order > currentImage.display_order) {
            newOrder = image.display_order - 1;
          }
        }

        // Ensure display orders are unique
        if (newOrder === display_order && image.id !== id) {
          // If there's a conflict, move this image to the end
          newOrder = Math.max(...allImages.map(img => img.display_order)) + 1;
        }

        if (newOrder !== image.display_order) {
          await (supabaseAdmin || supabase)
            .from('product_images')
            .update({ display_order: newOrder })
            .eq('id', image.id)
            .eq('company_id', req.companyId);
        }
      });

      await Promise.all(updates);
    }

    // If is_primary is changing to true, update other images for the same product/variant
    if (is_primary === true) {
      // Build query to unset primary for other images
      let unsetPrimaryQuery = (supabaseAdmin || supabase)
        .from('product_images')
        .update({ is_primary: false })
        .eq('company_id', req.companyId)
        .neq('id', id);

      // Filter by product_id if present
      if (targetProductId) {
        unsetPrimaryQuery = unsetPrimaryQuery.eq('product_id', targetProductId);
      } else {
        unsetPrimaryQuery = unsetPrimaryQuery.is('product_id', null);
      }

      // Filter by variant_id if present
      if (targetVariantId) {
        unsetPrimaryQuery = unsetPrimaryQuery.eq('variant_id', targetVariantId);
      } else {
        unsetPrimaryQuery = unsetPrimaryQuery.is('variant_id', null);
      }

      await unsetPrimaryQuery;
    }

    // Prepare update data
    const updateData: any = {};
    
    if (image_url !== undefined) {
      updateData.image_url = image_url;
    }
    if (is_primary !== undefined) {
      updateData.is_primary = is_primary;
    }
    if (display_order !== undefined) {
      updateData.display_order = display_order;
    }
    if (variant_id !== undefined) {
      updateData.variant_id = variant_id || null;
    }

    // Update the target image
    const { data, error } = await (supabaseAdmin || supabase)
      .from('product_images')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product image:', error);
      throw new ApiError(500, `Error updating product image: ${error.message}`);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { error } = await (supabaseAdmin || supabase)
      .from('product_images')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) {
      throw new ApiError(500, 'Error deleting product image');
    }

    res.json({
      success: true,
      message: 'Product image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const bulkAddProductImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    const { images, variant_id } = req.body; // variant_id can be provided in body

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    if (!Array.isArray(images) || images.length === 0) {
      throw new ValidationError('Images array is required');
    }

    // At least one of product_id or variant_id must be provided
    if (!product_id && !variant_id) {
      throw new ValidationError('Either product_id or variant_id must be provided');
    }

    // Validate variant_ids if provided in individual images
    const variantIds = images
      .map(img => img.variant_id || variant_id)
      .filter(Boolean);
    
    if (variantIds.length > 0) {
      const uniqueVariantIds = [...new Set(variantIds)];
      const { data: variants, error: variantError } = await (supabaseAdmin || supabase)
        .from('product_variants')
        .select('id, product_id')
        .in('id', uniqueVariantIds)
        .eq('company_id', req.companyId);

      if (variantError) {
        throw new ApiError(500, `Error validating variants: ${variantError.message}`);
      }

      if (variants.length !== uniqueVariantIds.length) {
        const foundIds = variants.map(v => v.id);
        const missingIds = uniqueVariantIds.filter(id => !foundIds.includes(id));
        throw new ApiError(
          404,
          `Variant(s) with ID(s) '${missingIds.join(', ')}' not found. Ensure variants exist and belong to your company.`
        );
      }

      // If product_id is provided, ensure all variants belong to it
      if (product_id) {
        const mismatchedVariants = variants.filter(v => v.product_id !== product_id);
        if (mismatchedVariants.length > 0) {
          throw new ApiError(
            400,
            `Product ID mismatch: Variant(s) '${mismatchedVariants.map(v => v.id).join(', ')}' do not belong to product '${product_id}'.`
          );
        }
      }
    }

    // Format the images with the product_id and/or variant_id
    const imagesData = images.map((img, index) => ({
      product_id: product_id || null,
      variant_id: img.variant_id || variant_id || null,
      company_id: req.companyId,
      image_url: img.image_url,
      is_primary: img.is_primary || false,
      display_order: img.display_order !== undefined ? img.display_order : index
    }));

    // Check if any image is marked as primary
    const hasPrimary = imagesData.some(img => img.is_primary === true);
    
    // If any image is primary, unset other primary images for the same product/variant combinations
    if (hasPrimary) {
      const productVariantPairs = imagesData
        .filter(img => img.is_primary === true)
        .map(img => ({ product_id: img.product_id, variant_id: img.variant_id }));

      for (const pair of productVariantPairs) {
        let unsetPrimaryQuery = (supabaseAdmin || supabase)
          .from('product_images')
          .update({ is_primary: false })
          .eq('company_id', req.companyId);

        if (pair.product_id) {
          unsetPrimaryQuery = unsetPrimaryQuery.eq('product_id', pair.product_id);
        } else {
          unsetPrimaryQuery = unsetPrimaryQuery.is('product_id', null);
        }

        if (pair.variant_id) {
          unsetPrimaryQuery = unsetPrimaryQuery.eq('variant_id', pair.variant_id);
        } else {
          unsetPrimaryQuery = unsetPrimaryQuery.is('variant_id', null);
        }

        await unsetPrimaryQuery;
      }
    }

    // Insert all images in a batch
    const { data, error } = await (supabaseAdmin || supabase)
      .from('product_images')
      .insert(imagesData)
      .select();

    if (error) {
      console.error('Error adding product images:', error);
      throw new ApiError(500, `Error adding product images: ${error.message}`);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}; 