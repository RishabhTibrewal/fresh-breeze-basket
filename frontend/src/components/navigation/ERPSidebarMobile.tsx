import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarConfig, dashboardItem } from '@/config/sidebar';
import { filterSidebarGroups, hasMenuItemAccess } from '@/utils/sidebarFilter';
import { useSidebarState } from '@/hooks/useSidebarState';
import { LogOut } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

interface ERPSidebarMobileProps {
  onSignOut?: () => void;
}

export const ERPSidebarMobile: React.FC<ERPSidebarMobileProps> = ({ onSignOut }) => {
  const { roles, isAdmin, signOut } = useAuth();
  const { isRouteActive, isMenuExpanded, toggleMenuExpansion } = useSidebarState();
  const { openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();

  // Auto-close drawer on route change
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  // Filter groups based on user roles
  const filteredGroups = filterSidebarGroups(sidebarConfig.groups, roles, isAdmin);
  const filteredSettingsGroup = sidebarConfig.bottomAnchored && 
    filterSidebarGroups([sidebarConfig.bottomAnchored], roles, isAdmin)[0];

  // Check if dashboard item is accessible
  const hasDashboardAccess = hasMenuItemAccess(dashboardItem, roles, isAdmin);

  const handleSignOut = () => {
    setOpenMobile(false);
    if (onSignOut) {
      onSignOut();
    } else {
      signOut();
    }
  };

  const renderMenuItem = (item: typeof dashboardItem, level: number = 0) => {
    const hasAccess = hasMenuItemAccess(item, roles, isAdmin);
    if (!hasAccess) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = hasChildren ? isMenuExpanded(item.id) : false;
    
    // Check if parent or any child is active
    const isParentActive = item.path ? isRouteActive(item.path) : false;
    const isChildActive = hasChildren && item.children?.some(child => 
      child.path && isRouteActive(child.path)
    ) || false;
    const isActive = isParentActive || isChildActive;

    if (hasChildren) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleMenuExpansion(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {item.badge}
              </span>
            )}
            <ChevronRight
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
          {isExpanded && (
            <div className="ml-4 space-y-1 border-l border-sidebar-border pl-2">
              {item.children?.map(child => (
                <Link
                  key={child.id}
                  to={child.path || '#'}
                  onClick={() => setOpenMobile(false)}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    isRouteActive(child.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <child.icon className="h-4 w-4" />
                    <span>{child.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.path || '#'}
        onClick={() => setOpenMobile(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`}
      >
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent side="left" className="w-[18rem] p-0 bg-sidebar text-sidebar-foreground">
        <SheetHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold text-primary flex items-center">
              <span className="font-playfair">Fresh</span>
              <span className="text-primary-light">Basket</span>
              <span className="ml-2 text-sm bg-primary text-white px-2 py-0.5 rounded-md">Admin</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenMobile(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto p-4 space-y-4">
          {/* Dashboard Item */}
          {hasDashboardAccess && (
            <div className="space-y-1">
              {renderMenuItem(dashboardItem)}
            </div>
          )}

          {/* Main Groups */}
          {filteredGroups.map(group => (
            <div key={group.id} className="space-y-2">
              <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.items.map(item => renderMenuItem(item))}
              </div>
            </div>
          ))}

          {/* Settings Group */}
          {filteredSettingsGroup && (
            <div className="space-y-2 mt-auto pt-4 border-t border-sidebar-border">
              <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                {filteredSettingsGroup.label}
              </h3>
              <div className="space-y-1">
                {filteredSettingsGroup.items.map(item => renderMenuItem(item))}
              </div>
            </div>
          )}

          {/* Log Out Button */}
          <div className="mt-auto pt-4 border-t border-sidebar-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
