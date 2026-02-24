import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'sidebar:collapsed';

/**
 * Custom hook for managing sidebar state
 * Handles collapse state persistence and active route detection
 */
export function useSidebarState() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    // Load initial state from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      return stored === 'true';
    }
    return false;
  });

  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Persist collapse state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(isCollapsed));
    }
  }, [isCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  const toggleMenuExpansion = useCallback((menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }, []);

  const isMenuExpanded = useCallback((menuId: string) => {
    return expandedMenus.has(menuId);
  }, [expandedMenus]);

  const setMenuExpanded = useCallback((menuId: string, expanded: boolean) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(menuId);
      } else {
        next.delete(menuId);
      }
      return next;
    });
  }, []);

  /**
   * Checks if a route path is active
   */
  const isRouteActive = useCallback((path?: string): boolean => {
    if (!path) return false;
    
    // Exact match for dashboard
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    
    // Prefix match for other routes
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
    expandedMenus,
    toggleMenuExpansion,
    isMenuExpanded,
    setMenuExpanded,
    isRouteActive,
    currentPath: location.pathname
  };
}
