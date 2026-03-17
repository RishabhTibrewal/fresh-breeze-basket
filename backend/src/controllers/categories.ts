import { Request, Response } from 'express';
import { createAuthClient, supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';

const getAuthClient = (req: Request) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new ApiError(401, 'Authentication token is required');
  }
  return createAuthClient(token);
};

// Get all categories — top-level with nested subcategories
export const getCategories = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;

    // If ?topLevel=true, return only parent categories (no subcategories)
    const topLevelOnly = req.query.topLevel === 'true';

    if (topLevelOnly) {
      const { data, error } = await client
        .from('categories')
        .select('*')
        .eq('company_id', req.companyId)
        .is('parent_id', null)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        throw new ApiError(500, 'Failed to fetch categories');
      }

      return res.status(200).json({ success: true, data });
    }

    // Default: fetch all categories, then build tree
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('company_id', req.companyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      throw new ApiError(500, 'Failed to fetch categories');
    }

    // Build tree: top-level categories with nested subcategories array
    const allCategories = data || [];
    const topLevel = allCategories
      .filter((c: any) => !c.parent_id)
      .map((parent: any) => ({
        ...parent,
        subcategories: allCategories.filter((c: any) => c.parent_id === parent.id),
      }));

    res.status(200).json({ success: true, data: topLevel });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while fetching categories', code: 500 } });
    }
  }
};

// Get subcategories of a specific category
export const getSubcategories = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('parent_id', id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching subcategories:', error);
      throw new ApiError(500, 'Failed to fetch subcategories');
    }

    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while fetching subcategories', code: 500 } });
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
    
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
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
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while fetching category', code: 500 } });
    }
  }
};

// Create a new category (admin only)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, image_url, slug, parent_id } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const authClient = getAuthClient(req);
    
    if (!name) {
      throw new ApiError(400, 'Category name is required');
    }
    
    // If parent_id is provided, verify the parent belongs to the same company
    if (parent_id) {
      const { data: parent, error: parentError } = await (supabaseAdmin || supabase)
        .from('categories')
        .select('id')
        .eq('id', parent_id)
        .eq('company_id', req.companyId)
        .single();

      if (parentError || !parent) {
        throw new ApiError(400, 'Parent category not found or does not belong to this company');
      }

      // Prevent nesting more than 1 level deep
      const { data: grandParent } = await (supabaseAdmin || supabase)
        .from('categories')
        .select('parent_id')
        .eq('id', parent_id)
        .single();

      if (grandParent?.parent_id) {
        throw new ApiError(400, 'Cannot create a subcategory of a subcategory. Only one level of nesting is supported.');
      }
    }
    
    const categorySlug = slug || name.toLowerCase().replace(/\s+/g, '-');
    
    const { data, error } = await authClient
      .from('categories')
      .insert({
        name,
        description: description || null,
        image_url: image_url || null,
        slug: categorySlug,
        company_id: req.companyId,
        parent_id: parent_id || null,
      })
      .select();
    
    if (error) {
      console.error('Error creating category:', error);
      if (error.code === '23505') {
        throw new ApiError(409, 'A category with this name or slug already exists');
      }
      if (error.message.includes('permission denied')) {
        throw new ApiError(403, 'You do not have permission to create categories');
      }
      throw new ApiError(500, 'Failed to create category');
    }
    
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while creating category', code: 500 } });
    }
  }
};

// Update a category (admin only)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, slug, parent_id } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const authClient = getAuthClient(req);
    
    const { data: existingCategory, error: fetchError } = await authClient
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

    // If setting a parent_id, validate it
    const newParentId = parent_id !== undefined ? (parent_id || null) : existingCategory.parent_id;
    if (newParentId) {
      // Can't make a category a subcategory of itself
      if (newParentId === id) {
        throw new ApiError(400, 'A category cannot be its own parent');
      }

      const { data: parent } = await (supabaseAdmin || supabase)
        .from('categories')
        .select('id, parent_id')
        .eq('id', newParentId)
        .eq('company_id', req.companyId)
        .single();

      if (!parent) {
        throw new ApiError(400, 'Parent category not found');
      }
      if (parent.parent_id) {
        throw new ApiError(400, 'Cannot create a subcategory of a subcategory');
      }
    }
    
    const { data, error } = await authClient
      .from('categories')
      .update({
        name: name || existingCategory.name,
        description: description !== undefined ? description : existingCategory.description,
        image_url: image_url !== undefined ? image_url : existingCategory.image_url,
        slug: slug || existingCategory.slug,
        parent_id: newParentId,
        updated_at: new Date()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select();
    
    if (error) {
      console.error('Error updating category:', error);
      if (error.code === '23505') {
        throw new ApiError(409, 'A category with this name or slug already exists');
      }
      if (error.message.includes('permission denied')) {
        throw new ApiError(403, 'You do not have permission to update categories');
      }
      throw new ApiError(500, 'Failed to update category');
    }
    
    res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while updating category', code: 500 } });
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

    const authClient = getAuthClient(req);
    
    const { data: existingCategory, error: fetchError } = await authClient
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

    // If deleting a parent, first clear parent_id on its subcategories
    if (!existingCategory.parent_id) {
      await (supabaseAdmin || supabase)
        .from('categories')
        .update({ parent_id: null })
        .eq('parent_id', id)
        .eq('company_id', req.companyId);
    }
    
    const { error } = await authClient
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
    
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: { message: error.message, code: error.statusCode } });
    } else {
      res.status(500).json({ success: false, error: { message: 'An unexpected error occurred while deleting category', code: 500 } });
    }
  }
};