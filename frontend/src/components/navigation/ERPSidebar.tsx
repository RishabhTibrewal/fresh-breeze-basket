import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarConfig, dashboardItem } from '@/config/sidebar';
import { filterSidebarGroups, hasMenuItemAccess } from '@/utils/sidebarFilter';
import { useSidebarState } from '@/hooks/useSidebarState';
import { LogOut } from 'lucide-react';

interface ERPSidebarProps {
  onSignOut?: () => void;
}

export const ERPSidebar: React.FC<ERPSidebarProps> = ({ onSignOut }) => {
  const { roles, isAdmin, signOut } = useAuth();
  const { isRouteActive, isMenuExpanded, toggleMenuExpansion } = useSidebarState();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Filter groups based on user roles
  const filteredGroups = filterSidebarGroups(sidebarConfig.groups, roles, isAdmin);
  const filteredSettingsGroup = sidebarConfig.bottomAnchored && 
    filterSidebarGroups([sidebarConfig.bottomAnchored], roles, isAdmin)[0];

  // Check if dashboard item is accessible
  const hasDashboardAccess = hasMenuItemAccess(dashboardItem, roles, isAdmin);

  const handleSignOut = () => {
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
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            onClick={() => toggleMenuExpansion(item.id)}
            isActive={isActive}
            tooltip={item.label}
            className={isCollapsed ? "justify-center" : ""}
          >
            <item.icon className="h-4 w-4 shrink-0 flex-shrink-0" style={{ display: 'block' }} />
            {!isCollapsed && <span>{item.label}</span>}
            {!isCollapsed && item.badge && (
              <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {item.badge}
              </span>
            )}
            {!isCollapsed && (
              <ChevronRight
                className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            )}
          </SidebarMenuButton>
          {isExpanded && (
            <SidebarMenuSub>
              {item.children?.map(child => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isRouteActive(child.path)}
                  >
                    <Link to={child.path || '#'}>
                      <child.icon className="h-4 w-4" />
                      <span>{child.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.label}
          className={isCollapsed ? "justify-center" : ""}
        >
          <Link to={item.path || '#'} className={`flex items-center w-full ${isCollapsed ? "justify-center" : ""}`}>
            <item.icon className="h-4 w-4 shrink-0 flex-shrink-0" style={{ display: 'block' }} />
            {!isCollapsed && <span>{item.label}</span>}
            {!isCollapsed && item.badge && (
              <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {item.badge}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="hidden md:flex" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link to="/admin" className={`flex items-center ${isCollapsed ? "justify-center w-full" : ""}`}>
            {isCollapsed ? (
              <div className="flex items-center justify-center w-8 h-8">
                <span className="text-lg font-bold text-primary">FB</span>
              </div>
            ) : (
              <div className="text-xl font-bold text-primary flex items-center">
                <span className="font-playfair">Fresh</span>
                <span className="text-primary-light">Basket</span>
                <span className="ml-2 text-sm bg-primary text-white px-2 py-0.5 rounded-md">Admin</span>
              </div>
            )}
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Dashboard Item */}
        {hasDashboardAccess && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItem(dashboardItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Main Groups */}
        {filteredGroups.map(group => (
          <SidebarGroup key={group.id}>
            {!isCollapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => renderMenuItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Settings Group (Bottom Anchored) */}
        {filteredSettingsGroup && (
          <SidebarGroup className="mt-auto">
            {!isCollapsed && <SidebarGroupLabel>{filteredSettingsGroup.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSettingsGroup.items.map(item => renderMenuItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log Out"
              onClick={handleSignOut}
              className={isCollapsed ? "justify-center" : ""}
            >
              <LogOut className="h-4 w-4 shrink-0 flex-shrink-0" style={{ display: 'block' }} />
              {!isCollapsed && <span>Log Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
