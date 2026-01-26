import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Assign warehouse manager to warehouse
 */
export const assignWarehouseManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, warehouse_id } = req.body;

    if (!user_id) {
      throw new ValidationError('User ID is required');
    }

    if (!warehouse_id) {
      throw new ValidationError('Warehouse ID is required');
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
      throw new ApiError(404, 'Warehouse not found');
    }

    // Check if assignment already exists
    const { data: existing } = await adminClient
      .from('warehouse_managers')
      .select('id')
      .eq('user_id', user_id)
      .eq('warehouse_id', warehouse_id)
      .eq('company_id', req.companyId)
      .maybeSingle();

    if (existing) {
      // Update to active if exists but inactive
      const { data: updated, error: updateError } = await adminClient
        .from('warehouse_managers')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new ApiError(500, `Failed to update warehouse manager assignment: ${updateError.message}`);
      }

      return res.status(200).json({
        success: true,
        message: 'Warehouse manager assignment updated',
        data: updated
      });
    }

    // Create new assignment
    const { data: assignment, error: insertError } = await adminClient
      .from('warehouse_managers')
      .insert({
        user_id,
        warehouse_id,
        company_id: req.companyId,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error assigning warehouse manager:', insertError);
      throw new ApiError(500, `Failed to assign warehouse manager: ${insertError.message}`);
    }

    res.status(201).json({
      success: true,
      message: 'Warehouse manager assigned successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove warehouse manager assignment
 */
export const removeWarehouseManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, warehouseId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!warehouseId) {
      throw new ValidationError('Warehouse ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    const { error: deleteError } = await adminClient
      .from('warehouse_managers')
      .delete()
      .eq('user_id', userId)
      .eq('warehouse_id', warehouseId)
      .eq('company_id', req.companyId);

    if (deleteError) {
      console.error('Error removing warehouse manager:', deleteError);
      throw new ApiError(500, `Failed to remove warehouse manager: ${deleteError.message}`);
    }

    res.json({
      success: true,
      message: 'Warehouse manager assignment removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all warehouse managers for a warehouse
 */
export const getWarehouseManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId } = req.params;

    if (!warehouseId) {
      throw new ValidationError('Warehouse ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    // First, fetch warehouse managers
    const { data: managers, error } = await adminClient
      .from('warehouse_managers')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('company_id', req.companyId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching warehouse managers:', error);
      throw new ApiError(500, 'Failed to fetch warehouse managers');
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
      // Continue without profiles if there's an error
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
 * Get all warehouses assigned to a user
 */
export const getUserWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    const { data: warehouses, error } = await adminClient
      .from('warehouse_managers')
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
      console.error('Error fetching user warehouses:', error);
      throw new ApiError(500, 'Failed to fetch user warehouses');
    }

    res.json({
      success: true,
      data: warehouses || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all warehouse manager assignments
 */
export const getAllWarehouseManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;

    // Fetch warehouse manager assignments
    const { data: assignments, error } = await adminClient
      .from('warehouse_managers')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching warehouse managers:', error);
      throw new ApiError(500, 'Failed to fetch warehouse managers');
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

