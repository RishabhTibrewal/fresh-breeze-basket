import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to get current user role information
 */
export const useRole = () => {
  const { roles, role, isAdmin, isSales, isAccounts, isWarehouseManager, isPosManager } = useAuth();

  return {
    roles,
    role, // Primary role (backward compatibility)
    isAdmin,
    isSales,
    isAccounts,
    isWarehouseManager,
    isPosManager,
  };
};

/**
 * Hook to check if user has a specific role
 */
export const useHasRole = (roleName: string): boolean => {
  const { roles, isAdmin, isSales, isAccounts, isWarehouseManager, isPosManager } = useAuth();

  switch (roleName.toLowerCase()) {
    case 'admin':
      return isAdmin;
    case 'sales':
      return isSales;
    case 'accounts':
      return isAccounts;
    case 'warehouse_manager':
      return isWarehouseManager;
    case 'pos_manager':
      return isPosManager;
    default:
      return roles.includes(roleName);
  }
};

/**
 * Hook to check if user can access a feature
 * Features are mapped to roles
 */
export const useCanAccess = (feature: string): boolean => {
  const { isAdmin, isSales, isPosManager } = useAuth();

  // Feature to role mapping
  const featurePermissions: Record<string, string[]> = {
    // Admin-only features
    'products.create': ['admin'],
    'products.edit': ['admin'],
    'products.delete': ['admin'],
    'variants.manage': ['admin'],
    'brands.manage': ['admin'],
    'prices.manage': ['admin'],
    'inventory.adjust': ['admin'],
    'inventory.transfer': ['admin'],
    'warehouses.manage': ['admin'],
    
    // POS Manager features
    'pos.manage': ['admin', 'pos_manager'],
    'pos.access': ['admin', 'sales', 'pos_manager'],
    
    // Admin and Sales features
    'products.view': ['admin', 'sales'],
    'inventory.view': ['admin', 'sales'],
    'orders.view': ['admin', 'sales'],
    'orders.create': ['admin', 'sales'],
    'customers.view': ['admin', 'sales'],
    'customers.manage': ['admin', 'sales'],
    
    // Public features
    'products.browse': ['admin', 'sales', 'user'],
    'cart.manage': ['admin', 'sales', 'user'],
  };

  const allowedRoles = featurePermissions[feature] || [];
  
  if (allowedRoles.includes('admin') && isAdmin) return true;
  if (allowedRoles.includes('sales') && isSales) return true;
  if (allowedRoles.includes('pos_manager') && isPosManager) return true;
  if (allowedRoles.includes('user')) return true; // All authenticated users
  
  return false;
};

