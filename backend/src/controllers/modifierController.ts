import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// --- Modifier Groups ---

export const getModifierGroups = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data, error } = await supabase
      .from('modifier_groups')
      .select('*, modifiers(*)')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(400, error.message);

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error fetching modifier groups');
  }
};

export const createModifierGroup = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { name, description, min_select, max_select, is_active } = req.body;

    if (!name) {
      throw new ApiError(400, 'Name is required');
    }

    const { data, error } = await supabase
      .from('modifier_groups')
      .insert([{
        company_id: req.companyId,
        name,
        description,
        min_select: min_select || 0,
        max_select,
        is_active: is_active ?? true
      }])
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error creating modifier group');
  }
};

export const updateModifierGroup = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { id } = req.params;
    const { name, description, min_select, max_select, is_active } = req.body;

    const { data, error } = await supabase
      .from('modifier_groups')
      .update({
        name,
        description,
        min_select,
        max_select,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);
    if (!data) throw new ApiError(404, 'Modifier group not found');

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error updating modifier group');
  }
};

export const deleteModifierGroup = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { id } = req.params;

    const { error } = await supabase
      .from('modifier_groups')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) throw new ApiError(400, error.message);

    res.status(200).json({ success: true, message: 'Modifier group deleted successfully' });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error deleting modifier group');
  }
};

// --- Modifiers (Items within Groups) ---

export const getModifiersByGroup = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { groupId } = req.params;

    const { data, error } = await supabase
      .from('modifiers')
      .select('*')
      .eq('modifier_group_id', groupId)
      .eq('company_id', req.companyId)
      .order('display_order', { ascending: true });

    if (error) throw new ApiError(400, error.message);

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error fetching modifiers');
  }
};

export const createModifier = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { modifier_group_id, name, price_adjust, is_active, display_order } = req.body;

    if (!modifier_group_id || !name) {
      throw new ApiError(400, 'Modifier group ID and name are required');
    }

    const { data, error } = await supabase
      .from('modifiers')
      .insert([{
        company_id: req.companyId,
        modifier_group_id,
        name,
        price_adjust: price_adjust || 0,
        is_active: is_active ?? true,
        display_order: display_order || 0
      }])
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error creating modifier');
  }
};

export const updateModifier = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { id } = req.params;
    const { name, price_adjust, is_active, display_order } = req.body;

    const { data, error } = await supabase
      .from('modifiers')
      .update({
        name,
        price_adjust,
        is_active,
        display_order,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);
    if (!data) throw new ApiError(404, 'Modifier not found');

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error updating modifier');
  }
};

export const deleteModifier = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    const { id } = req.params;

    const { error } = await supabase
      .from('modifiers')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) throw new ApiError(400, error.message);

    res.status(200).json({ success: true, message: 'Modifier deleted successfully' });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error deleting modifier');
  }
};
