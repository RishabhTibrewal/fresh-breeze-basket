import { SidebarMenuItem, SidebarGroup } from '@/config/sidebar';

/**
 * Filters menu items based on user roles
 * Admin role grants access to all items automatically
 */
export function filterMenuItems(
  items: SidebarMenuItem[],
  userRoles: string[],
  isAdmin: boolean
): SidebarMenuItem[] {
  if (isAdmin) {
    // Admin sees everything, but still filter children recursively
    return items.map(item => ({
      ...item,
      children: item.children ? filterMenuItems(item.children, userRoles, isAdmin) : undefined
    }));
  }

  return items
    .filter(item => {
      // If item has no role requirement, allow it
      if (!item.roles || item.roles.length === 0) {
        return true;
      }

      // Check if user has any of the required roles
      const hasAccess = item.roles.some(role => userRoles.includes(role));
      
      // If item has children, check if any child is accessible
      if (item.children && item.children.length > 0) {
        const accessibleChildren = filterMenuItems(item.children, userRoles, isAdmin);
        return hasAccess || accessibleChildren.length > 0;
      }

      return hasAccess;
    })
    .map(item => ({
      ...item,
      children: item.children ? filterMenuItems(item.children, userRoles, isAdmin) : undefined
    }));
}

/**
 * Filters sidebar groups based on user roles
 */
export function filterSidebarGroups(
  groups: SidebarGroup[],
  userRoles: string[],
  isAdmin: boolean
): SidebarGroup[] {
  if (isAdmin) {
    // Admin sees all groups, but filter items within groups
    return groups.map(group => ({
      ...group,
      items: filterMenuItems(group.items, userRoles, isAdmin)
    })).filter(group => group.items.length > 0);
  }

  return groups
    .filter(group => {
      // If group has no role requirement, check items
      if (!group.roles || group.roles.length === 0) {
        const filteredItems = filterMenuItems(group.items, userRoles, isAdmin);
        return filteredItems.length > 0;
      }

      // Check if user has any of the required roles for the group
      const hasGroupAccess = group.roles.some(role => userRoles.includes(role));
      if (!hasGroupAccess) {
        return false;
      }

      // Filter items within the group
      const filteredItems = filterMenuItems(group.items, userRoles, isAdmin);
      return filteredItems.length > 0;
    })
    .map(group => ({
      ...group,
      items: filterMenuItems(group.items, userRoles, isAdmin)
    }));
}

/**
 * Checks if a user has access to a specific menu item
 */
export function hasMenuItemAccess(
  item: SidebarMenuItem,
  userRoles: string[],
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some(role => userRoles.includes(role));
}
