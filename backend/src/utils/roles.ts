import { supabase, supabaseAdmin } from '../config/supabase';
import { Role } from '../types/database';

// In-memory role cache to avoid fetching roles on every request
const roleCache = new Map<string, { roles: string[]; expiresAt: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

const getRoleCacheKey = (userId: string, companyId?: string) =>
  `${userId}:${companyId || 'default'}`;

/**
 * Get all roles for a user in a specific company
 */
export async function getUserRoles(userId: string, companyId?: string): Promise<string[]> {
  const cacheKey = getRoleCacheKey(userId, companyId);
  const cached = roleCache.get(cacheKey);
  const now = Date.now();

  // Check cache first
  if (cached && now < cached.expiresAt) {
    return cached.roles;
  }

  try {
    const client = supabaseAdmin || supabase;
    
    // Use database function to get roles
    const { data, error } = await client.rpc('get_user_roles', {
      p_user_id: userId,
      p_company_id: companyId || null
    });

    if (error) {
      console.error(`Error fetching roles for user ${userId}:`, error);
      return ['user']; // Default role on error
    }

    const roles = (data as string[]) || ['user'];
    
    // Cache the roles
    roleCache.set(cacheKey, {
      roles,
      expiresAt: now + ROLE_CACHE_TTL
    });

    return roles;
  } catch (error) {
    console.error(`Error fetching roles for user ${userId}:`, error);
    return ['user']; // Default role on error
  }
}

/**
 * Check if user has a specific role (with admin override)
 */
export async function hasRole(
  userId: string,
  companyId: string | undefined,
  roleName: string
): Promise<boolean> {
  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client.rpc('has_role', {
      p_user_id: userId,
      p_role_name: roleName,
      p_company_id: companyId || null
    });

    if (error) {
      console.error(`Error checking role ${roleName} for user ${userId}:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Error checking role ${roleName} for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if user has any of the specified roles (with admin override)
 */
export async function hasAnyRole(
  userId: string,
  companyId: string | undefined,
  roleNames: string[]
): Promise<boolean> {
  if (roleNames.length === 0) {
    return true; // No roles required means access granted
  }

  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client.rpc('has_any_role', {
      p_user_id: userId,
      p_role_names: roleNames,
      p_company_id: companyId || null
    });

    if (error) {
      console.error(`Error checking roles ${roleNames.join(', ')} for user ${userId}:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Error checking roles ${roleNames.join(', ')} for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if user has all of the specified roles (with admin override)
 */
export async function hasAllRoles(
  userId: string,
  companyId: string | undefined,
  roleNames: string[]
): Promise<boolean> {
  if (roleNames.length === 0) {
    return true; // No roles required means access granted
  }

  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client.rpc('has_all_roles', {
      p_user_id: userId,
      p_role_names: roleNames,
      p_company_id: companyId || null
    });

    if (error) {
      console.error(`Error checking all roles ${roleNames.join(', ')} for user ${userId}:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Error checking all roles ${roleNames.join(', ')} for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all available roles from the database
 */
export async function getAllRoles(): Promise<Role[]> {
  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client
      .from('roles')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching all roles:', error);
      return [];
    }

    return (data as Role[]) || [];
  } catch (error) {
    console.error('Error fetching all roles:', error);
    return [];
  }
}

/**
 * Assign roles to a user in a company
 * Replaces all existing roles for the user in that company
 */
export async function assignUserRoles(
  userId: string,
  companyId: string,
  roleNames: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = supabaseAdmin || supabase;

    // Validate that all role names exist
    const { data: roles, error: rolesError } = await client
      .from('roles')
      .select('id, name')
      .in('name', roleNames);

    if (rolesError) {
      console.error('Error validating roles:', rolesError);
      return { success: false, error: 'Failed to validate roles' };
    }

    const validRoleNames = (roles as { id: string; name: string }[]).map(r => r.name);
    const invalidRoles = roleNames.filter(name => !validRoleNames.includes(name));

    if (invalidRoles.length > 0) {
      return {
        success: false,
        error: `Invalid roles: ${invalidRoles.join(', ')}`
      };
    }

    // Delete existing roles for this user-company combination
    const { error: deleteError } = await client
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('Error deleting existing roles:', deleteError);
      return { success: false, error: 'Failed to remove existing roles' };
    }

    // Insert new roles
    if (validRoleNames.length > 0) {
      const roleMap = new Map((roles as { id: string; name: string }[]).map(r => [r.name, r.id]));
      
      const userRolesToInsert = validRoleNames.map(roleName => ({
        user_id: userId,
        company_id: companyId,
        role_id: roleMap.get(roleName)!
      }));

      const { error: insertError } = await client
        .from('user_roles')
        .insert(userRolesToInsert);

      if (insertError) {
        console.error('Error inserting new roles:', insertError);
        return { success: false, error: 'Failed to assign roles' };
      }
    }

    // Invalidate cache
    invalidateRoleCache(userId);

    return { success: true };
  } catch (error) {
    console.error('Error assigning roles:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Invalidate role cache for a user
 */
export function invalidateRoleCache(userId: string): void {
  roleCache.forEach((_value, key) => {
    if (key.startsWith(`${userId}:`)) {
      roleCache.delete(key);
    }
  });
  console.log(`Role cache invalidated for user ${userId}`);
}

/**
 * Check if user has access to a specific warehouse
 */
export async function hasWarehouseAccess(
  userId: string,
  companyId: string,
  warehouseId: string
): Promise<boolean> {
  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client.rpc('has_warehouse_access', {
      p_user_id: userId,
      p_warehouse_id: warehouseId,
      p_company_id: companyId
    });

    if (error) {
      console.error(`Error checking warehouse access for user ${userId}:`, error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(`Error checking warehouse access for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all warehouses assigned to a user
 */
export async function getUserWarehouses(
  userId: string,
  companyId: string
): Promise<string[]> {
  try {
    const client = supabaseAdmin || supabase;
    
    const { data, error } = await client
      .from('warehouse_managers')
      .select('warehouse_id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) {
      console.error(`Error fetching warehouses for user ${userId}:`, error);
      return [];
    }

    return (data as { warehouse_id: string }[]).map(w => w.warehouse_id);
  } catch (error) {
    console.error(`Error fetching warehouses for user ${userId}:`, error);
    return [];
  }
}

