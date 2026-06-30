import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Assign POS manager to outlet (warehouse)
 */
export const assignPosManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, warehouse_id } = req.body;

    if (!user_id) {
      throw new ValidationError('User ID is required');
    }

    if (!warehouse_id) {
      throw new ValidationError('Warehouse ID (outlet) is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    // Verify warehouse exists
    const { data: warehouse, error: warehouseError } = await adminClient
      .from('warehouses')
      .select('id')
      .eq('id', warehouse_id)
      .eq('company_id', req.companyId)
      .single();

    if (warehouseError || !warehouse) {
      throw new ApiError(404, 'Warehouse (outlet) not found');
    }

    // Check if assignment already exists
    const { data: existing } = await adminClient
      .from('pos_managers')
      .select('id')
      .eq('user_id', user_id)
      .eq('warehouse_id', warehouse_id)
      .eq('company_id', req.companyId)
      .maybeSingle();

    if (existing) {
      // Update to active if exists but inactive
      const { data: updated, error: updateError } = await adminClient
        .from('pos_managers')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new ApiError(500, `Failed to update POS manager assignment: ${updateError.message}`);
      }

      return res.status(200).json({
        success: true,
        message: 'POS manager assignment updated',
        data: updated
      });
    }

    // Create new assignment
    const { data: assignment, error: insertError } = await adminClient
      .from('pos_managers')
      .insert({
        user_id,
        warehouse_id,
        company_id: req.companyId,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error assigning POS manager:', insertError);
      throw new ApiError(500, `Failed to assign POS manager: ${insertError.message}`);
    }

    res.status(201).json({
      success: true,
      message: 'POS manager assigned successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove POS manager assignment
 */
export const removePosManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, warehouseId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!warehouseId) {
      throw new ValidationError('Warehouse ID (outlet) is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    const { error: deleteError } = await adminClient
      .from('pos_managers')
      .delete()
      .eq('user_id', userId)
      .eq('warehouse_id', warehouseId)
      .eq('company_id', req.companyId);

    if (deleteError) {
      console.error('Error removing POS manager:', deleteError);
      throw new ApiError(500, `Failed to remove POS manager: ${deleteError.message}`);
    }

    res.json({
      success: true,
      message: 'POS manager assignment removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all POS managers for an outlet
 */
export const getPosManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId } = req.params;

    if (!warehouseId) {
      throw new ValidationError('Warehouse ID (outlet) is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    // Fetch POS managers
    const { data: managers, error } = await adminClient
      .from('pos_managers')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('company_id', req.companyId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching POS managers:', error);
      throw new ApiError(500, 'Failed to fetch POS managers');
    }

    if (!managers || managers.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Fetch user profiles for the managers
    const userIds = managers.map(m => m.user_id);
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Combine managers with their profiles
    const managersWithProfiles = managers.map(manager => ({
      ...manager,
      profiles: profiles?.find(p => p.id === manager.user_id) || null
    }));

    res.json({
      success: true,
      data: managersWithProfiles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all outlets assigned to a user
 */
export const getUserPosOutlets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    const { data: outlets, error } = await adminClient
      .from('pos_managers')
      .select(`
        *,
        warehouses:warehouse_id (
          id,
          name,
          code,
          address,
          city,
          state,
          country,
          is_active
        )
      `)
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user POS outlets:', error);
      throw new ApiError(500, 'Failed to fetch user POS outlets');
    }

    res.json({
      success: true,
      data: outlets || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all POS manager assignments
 */
export const getAllPosManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    // Fetch POS manager assignments
    const { data: assignments, error } = await adminClient
      .from('pos_managers')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching POS managers:', error);
      throw new ApiError(500, 'Failed to fetch POS managers');
    }

    if (!assignments || assignments.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Fetch user profiles and warehouses
    const userIds = [...new Set(assignments.map(a => a.user_id))];
    const warehouseIds = [...new Set(assignments.map(a => a.warehouse_id))];

    const [profilesResult, warehousesResult] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds),
      adminClient
        .from('warehouses')
        .select('id, name, code')
        .in('id', warehouseIds)
    ]);

    const profiles = profilesResult.data || [];
    const warehouses = warehousesResult.data || [];

    // Combine assignments with profiles and warehouses
    const assignmentsWithDetails = assignments.map(assignment => ({
      ...assignment,
      profiles: profiles.find(p => p.id === assignment.user_id) || null,
      warehouses: warehouses.find(w => w.id === assignment.warehouse_id) || null
    }));

    res.json({
      success: true,
      data: assignmentsWithDetails
    });
  } catch (error) {
    next(error);
  }
};
