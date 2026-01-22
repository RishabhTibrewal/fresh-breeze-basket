import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', req.companyId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      throw new ApiError(500, 'Failed to fetch categories');
    }
    
    res.status(200).json({
      success: true,
      data
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
          message: 'An unexpected error occurred while fetching categories',
          code: 500
        }
      });
    }
  }
};

// Get single category by ID
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(*)')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Category not found');
      }
      console.error('Error fetching category:', error);
      throw new ApiError(500, 'Failed to fetch category');
    }
    
    res.status(200).json({
      success: true,
      data
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
          message: 'An unexpected error occurred while fetching category',
          code: 500
        }
      });
    }
  }
};

// Create a new category (admin only)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, image_url, slug } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Validate required fields
    if (!name) {
      throw new ApiError(400, 'Category name is required');
    }
    
    // Generate a slug if not provided
    const categorySlug = slug || name.toLowerCase().replace(/\s+/g, '-');
    
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        description: description || null,
        image_url: image_url || null,
        slug: categorySlug,
        company_id: req.companyId
      })
      .select();
    
    if (error) {
      console.error('Error creating category:', error);
      if (error.code === '23505') { // Unique violation
        throw new ApiError(409, 'A category with this name or slug already exists');
      }
      if (error.message.includes('permission denied')) {
        throw new ApiError(403, 'You do not have permission to create categories');
      }
      throw new ApiError(500, 'Failed to create category');
    }
    
    res.status(201).json({
      success: true,
      data: data[0]
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
          message: 'An unexpected error occurred while creating category',
          code: 500
        }
      });
    }
  }
};

// Update a category (admin only)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, slug } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, 'Category not found');
      }
      console.error('Error fetching category:', fetchError);
      throw new ApiError(500, 'Failed to fetch category');
    }
    
    // Update category
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: name || existingCategory.name,
        description: description !== undefined ? description : existingCategory.description,
        image_url: image_url !== undefined ? image_url : existingCategory.image_url,
        slug: slug || existingCategory.slug,
        updated_at: new Date()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select();
    
    if (error) {
      console.error('Error updating category:', error);
      if (error.code === '23505') { // Unique violation
        throw new ApiError(409, 'A category with this name or slug already exists');
      }
      if (error.message.includes('permission denied')) {
        throw new ApiError(403, 'You do not have permission to update categories');
      }
      throw new ApiError(500, 'Failed to update category');
    }
    
    res.status(200).json({
      success: true,
      data: data[0]
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
          message: 'An unexpected error occurred while updating category',
          code: 500
        }
      });
    }
  }
};

// Delete a category (admin only)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, 'Category not found');
      }
      console.error('Error fetching category:', fetchError);
      throw new ApiError(500, 'Failed to fetch category');
    }
    
    // Delete category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);
    
    if (error) {
      console.error('Error deleting category:', error);
      if (error.message.includes('permission denied')) {
        throw new ApiError(403, 'You do not have permission to delete categories');
      }
      throw new ApiError(500, 'Failed to delete category');
    }
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
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
          message: 'An unexpected error occurred while deleting category',
          code: 500
        }
      });
    }
  }
}; 