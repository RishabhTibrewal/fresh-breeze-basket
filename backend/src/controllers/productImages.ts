import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config';
import { ApiError, ValidationError } from '../middleware/error';

export const addProductImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    const { image_url, is_primary = false, display_order = 0 } = req.body;

    if (!image_url) {
      throw new ValidationError('Image URL is required');
    }

    const { data, error } = await supabase
      .from('product_images')
      .insert([
        {
          product_id,
          image_url,
          is_primary,
          display_order
        }
      ])
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Error adding product image');
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

    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product_id)
      .order('display_order', { ascending: true });

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
    const { image_url, is_primary, display_order } = req.body;

    // First get the current image to check if display_order is changing
    const { data: currentImage, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new ApiError(404, 'Image not found');
    }

    // If display_order is changing, we need to update other images
    if (display_order !== undefined && display_order !== currentImage.display_order) {
      // Get all images for this product
      const { data: allImages, error: allImagesError } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', currentImage.product_id)
        .order('display_order', { ascending: true });

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
          await supabase
            .from('product_images')
            .update({ display_order: newOrder })
            .eq('id', image.id);
        }
      });

      await Promise.all(updates);
    }

    // If is_primary is changing to true, update other images
    if (is_primary === true) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', currentImage.product_id)
        .neq('id', id);
    }

    // Update the target image
    const { data, error } = await supabase
      .from('product_images')
      .update({
        image_url,
        is_primary,
        display_order
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Error updating product image');
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

    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', id);

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