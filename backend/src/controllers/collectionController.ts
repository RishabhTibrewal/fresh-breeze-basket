import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all collections for a company
 */
export const getCollections = async (req: Request, res: Response) => {
  try {
    const { include_items } = req.query;
    const client = supabaseAdmin || supabase;

    let query = client
      .from('collections')
      .select('*')
      .eq('company_id', req.companyId)
      .order('display_order', { ascending: true });

    const { data: collections, error } = await query;

    if (error) {
      throw new ApiError(500, `Failed to fetch collections: ${error.message}`);
    }

    // If include_items is true, we could optionally fetch the variants.
    // However, it's usually better to fetch products for a specific collection separately 
    // using the products endpoint with a collection_slug filter.

    res.status(200).json({
      success: true,
      count: collections?.length || 0,
      data: collections || []
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred while fetching collections', code: 500 }
      });
    }
  }
};

/**
 * Get a single collection by ID or Slug
 */
export const getCollection = async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Check if it's a UUID or a slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug as string);
    const client = supabaseAdmin || supabase;

    let query = client
      .from('collections')
      .select('*')
      .eq('company_id', req.companyId);

    if (isUuid) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data: collection, error } = await query.single();

    if (error || !collection) {
      throw new ApiError(404, `Collection not found`);
    }

    res.status(200).json({
      success: true,
      data: collection
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred', code: 500 }
      });
    }
  }
};

/**
 * Create a new collection
 */
export const createCollection = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, image_url, is_active, display_order } = req.body;

    if (!name) {
      throw new ApiError(400, 'Collection name is required');
    }

    // Generate a slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    const client = supabaseAdmin || supabase;

    // Check slug uniqueness within company
    const { data: existingCollection, error: checkError } = await client
      .from('collections')
      .select('id')
      .eq('slug', finalSlug)
      .eq('company_id', req.companyId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
       throw new ApiError(500, `Failed to check for existing collection: ${checkError.message}`);
    }

    if (existingCollection) {
      throw new ApiError(400, `A collection with the slug '${finalSlug}' already exists`);
    }

    const newCollection = {
      id: uuidv4(),
      company_id: req.companyId,
      name,
      slug: finalSlug,
      description: description || null,
      image_url: image_url || null,
      is_active: is_active !== undefined ? is_active : true,
      display_order: display_order || 0
    };

    const { data: createdCollection, error } = await client
      .from('collections')
      .insert(newCollection)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Failed to create collection: ${error.message}`);
    }

    res.status(201).json({
      success: true,
      data: createdCollection,
      message: 'Collection created successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred while creating collection', code: 500 }
      });
    }
  }
};

/**
 * Update an existing collection
 */
export const updateCollection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url, is_active, display_order } = req.body;
    const client = supabaseAdmin || supabase;

    // Check existing
    const { data: existing, error: fetchError } = await client
      .from('collections')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, 'Collection not found');
    }

    // Verify slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const { data: slugCheck } = await client
        .from('collections')
        .select('id')
        .eq('slug', slug)
        .eq('company_id', req.companyId)
        .neq('id', id)
        .maybeSingle();

      if (slugCheck) {
        throw new ApiError(400, `A collection with the slug '${slug}' already exists`);
      }
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (image_url !== undefined) updates.image_url = image_url;
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_order !== undefined) updates.display_order = display_order;
    
    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await client
      .from('collections')
      .update(updates)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      throw new ApiError(500, `Failed to update collection: ${updateError.message}`);
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Collection updated successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred while updating collection', code: 500 }
      });
    }
  }
};

/**
 * Delete a collection
 */
export const deleteCollection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = supabaseAdmin || supabase;

    // Verify ownership
    const { data: existing, error: fetchError } = await client
      .from('collections')
      .select('id')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, 'Collection not found');
    }

    // Delete mapping entries first (though DB cascade might handle this)
    await client
      .from('variant_collections')
      .delete()
      .eq('collection_id', id);

    const { error: deleteError } = await client
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (deleteError) {
      throw new ApiError(500, `Failed to delete collection: ${deleteError.message}`);
    }

    res.status(200).json({
      success: true,
      data: {},
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred while deleting collection', code: 500 }
      });
    }
  }
};

/**
 * Assign variants to a collection
 */
export const assignVariantsToCollection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body; 
    // assignments should be Array<{variant_id: string, display_order?: number}>

    if (!Array.isArray(assignments)) {
      throw new ApiError(400, 'Assignments must be an array');
    }
    const client = supabaseAdmin || supabase;

    // Verify collection ownership
    const { data: existing, error: fetchError } = await client
      .from('collections')
      .select('id')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, 'Collection not found');
    }

    // For simplicity, we could delete existing and insert new, or perform targeted upserts.
    // Assuming 'assignments' contains the full new list of variations for this collection.
    
    // 1. Clear existing assignments for this collection
    const { error: deleteError } = await client
      .from('variant_collections')
      .delete()
      .eq('collection_id', id);

    if (deleteError) {
      throw new ApiError(500, `Failed to update variants: ${deleteError.message}`);
    }

    if (assignments.length > 0) {
      // 2. Insert new assignments
      const insertData = assignments.map((a, index) => ({
        collection_id: id,
        variant_id: a.variant_id,
        display_order: a.display_order !== undefined ? a.display_order : index
      }));

      const { error: insertError } = await client
        .from('variant_collections')
        .insert(insertData);

      if (insertError) {
        throw new ApiError(500, `Failed to assign variants: ${insertError.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Variants assigned to collection successfully'
    });

  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: { message: error.message, code: error.statusCode }
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: 'An unexpected error occurred while assigning variants', code: 500 }
      });
    }
  }
};
