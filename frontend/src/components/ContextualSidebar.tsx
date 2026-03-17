import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PanelLeft, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getModuleByRoute } from '@/config/modules.config';
import { usePermissions } from '@/hooks/usePermissions';
import type { SidebarItem } from '@/config/modules.config';

interface ContextualSidebarProps {
  onToggle?: (isOpen: boolean) => void;
}

// ---------------------------------------------------------------------------
// Collapsible section component (renders a parent + its children)
// ---------------------------------------------------------------------------
function SidebarSection({
  item,
  pathname,
  isExpanded: isSidebarExpanded,
}: {
  item: SidebarItem;
  pathname: string;
  isExpanded: boolean;
}) {
  // Auto-open if any child is the active route
  const anyChildActive = item.children?.some((c) => pathname.startsWith(c.route)) ?? false;
  const [open, setOpen] = useState(anyChildActive);

  // parent acts as group header — clicking toggles the sub-menu
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all
          ${anyChildActive ? 'text-primary' : 'text-gray-600 hover:bg-gray-100'}
          ${isSidebarExpanded ? 'justify-between' : 'justify-center'}`}
        title={!isSidebarExpanded ? item.label : undefined}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <item.icon className="h-5 w-5 shrink-0" />
          {isSidebarExpanded && (
            <span className="truncate">{item.label}</span>
          )}
        </span>
        {isSidebarExpanded && (
          open
            ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* Children */}
      {open && isSidebarExpanded && item.children && (
        <div className="ml-4 mt-0.5 border-l border-gray-200 pl-3 space-y-0.5">
          {item.children.map((child) => {
            const isActive = pathname === child.route || pathname.startsWith(child.route + '/');
            return (
              <Link
                key={child.route}
                to={child.route}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-all
                  ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <child.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flat link (no children)
// ---------------------------------------------------------------------------
function SidebarLink({
  item,
  pathname,
  isExpanded,
}: {
  item: SidebarItem;
  pathname: string;
  isExpanded: boolean;
}) {
  const isActive = pathname === item.route || pathname.startsWith(item.route + '/');

  return (
    <Link
      to={item.route}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all
        ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}
        ${isExpanded ? '' : 'justify-center'}`}
      title={!isExpanded ? item.label : undefined}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {isExpanded && <span className="ml-2.5 truncate">{item.label}</span>}
      {isExpanded && item.badge && (
        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shrink-0">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const ContextualSidebar: React.FC<ContextualSidebarProps> = ({ onToggle }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const { permissions } = usePermissions();

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  // Detect current module from route
  const currentModule = getModuleByRoute(location.pathname);

  // Don't show sidebar on dashboard or if no module detected
  if (!currentModule || location.pathname === '/dashboard') {
    return null;
  }

  const sidebarItems = currentModule.sidebarItems || [];

  // Create a set of permission codes for quick lookup
  const permissionCodes = useMemo(
    () => new Set(permissions.map((p) => p.permission_code)),
    [permissions]
  );

  // Filter top-level items (and recursively children) by permissions
  const filteredItems = useMemo(() => {
    return sidebarItems
      .filter((item) => !item.permission || permissionCodes.has(item.permission))
      .map((item) => ({
        ...item,
        children: item.children?.filter(
          (c) => !c.permission || permissionCodes.has(c.permission)
        ),
      }));
  }, [sidebarItems, permissionCodes]);

  // Shared nav renderer
  const renderDesktopNav = () =>
    filteredItems.map((item) =>
      item.children && item.children.length > 0 ? (
        <SidebarSection
          key={item.route}
          item={item}
          pathname={location.pathname}
          isExpanded={isOpen}
        />
      ) : (
        <SidebarLink
          key={item.route}
          item={item}
          pathname={location.pathname}
          isExpanded={isOpen}
        />
      )
    );

  // Mobile: flatten groups for the bottom bar
  const flatForMobile = useMemo(() => {
    const out: SidebarItem[] = [];
    filteredItems.forEach((item) => {
      if (item.children && item.children.length > 0) {
        // Show the group parent as a header in mobile too
        out.push({ ...item, children: undefined });
      } else {
        out.push(item);
      }
    });
    return out;
  }, [filteredItems]);

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <div
        className={`hidden lg:block fixed inset-y-0 left-0 bg-white border-r transition-all duration-200 z-30 ${
          isOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between h-16 border-b px-4 shrink-0">
            {isOpen ? (
              <div className="flex items-center gap-2 min-w-0">
                <currentModule.icon className={`h-6 w-6 shrink-0 ${currentModule.iconColor}`} />
                <span className="font-semibold truncate">{currentModule.label}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <currentModule.icon className={`h-6 w-6 ${currentModule.iconColor}`} />
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleToggle} className="h-7 w-7 shrink-0">
              {isOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">{renderDesktopNav()}</nav>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <nav className="flex flex-nowrap gap-1 overflow-x-auto px-2 py-2">
          {flatForMobile.map((item) => {
            const isActive =
              location.pathname === item.route ||
              location.pathname.startsWith(item.route + '/');
            return (
              <Link
                key={item.route}
                to={item.route}
                className={`flex shrink-0 flex-col items-center justify-center min-w-[64px] px-2 py-1 rounded-md touch-manipulation ${
                  isActive ? 'text-primary bg-primary/10' : 'text-gray-600'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] mt-0.5 text-center leading-tight max-w-[64px] truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default ContextualSidebar;
