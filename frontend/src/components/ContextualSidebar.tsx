import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PanelLeft, X } from 'lucide-react';
import { getModuleByRoute } from '@/config/modules.config';
import { usePermissions } from '@/hooks/usePermissions';

interface ContextualSidebarProps {
  onToggle?: (isOpen: boolean) => void;
}

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
  const permissionCodes = useMemo(() => {
    return new Set(permissions.map(p => p.permission_code));
  }, [permissions]);

  // Filter sidebar items by permissions
  const filteredSidebarItems = useMemo(() => {
    return sidebarItems.filter(item => {
      if (!item.permission) return true;
      return permissionCodes.has(item.permission);
    });
  }, [sidebarItems, permissionCodes]);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden lg:block fixed inset-y-0 left-0 bg-white border-r transition-all duration-200 ${
        isOpen ? 'w-64' : 'w-16'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between h-16 border-b px-4">
            {isOpen ? (
              <div className="flex items-center gap-2">
                <currentModule.icon className={`h-6 w-6 ${currentModule.iconColor}`} />
                <span className="font-semibold">{currentModule.label}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <currentModule.icon className={`h-6 w-6 ${currentModule.iconColor}`} />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="h-7 w-7"
            >
              {isOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredSidebarItems.map((item) => {
              const isActive = location.pathname === item.route;

              return (
                <Link
                  key={item.route}
                  to={item.route}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  } ${isOpen ? '' : 'justify-center'}`}
                  title={!isOpen ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0 flex-shrink-0" style={{ display: 'block' }} />
                  {isOpen && <span className="ml-3">{item.label}</span>}
                  {isOpen && item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <nav className="flex justify-around px-2 py-2">
          {filteredSidebarItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.route;

            return (
              <Link
                key={item.route}
                to={item.route}
                className={`flex flex-col items-center px-2 py-1 rounded-md ${
                  isActive ? 'text-primary' : 'text-gray-600'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default ContextualSidebar;
