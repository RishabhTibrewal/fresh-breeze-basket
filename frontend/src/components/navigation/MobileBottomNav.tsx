import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Warehouse, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[]; // Roles that can see this item
  badge?: number; // Badge count
}

export const MobileBottomNav: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { roles, isAdmin, isSales } = useAuth();
  const { state: cartState } = useCart();

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  // Define navigation items based on role
  const navItems: NavItem[] = [
    {
      path: '/',
      icon: <Home className="h-5 w-5" />,
      label: 'Home',
      roles: ['admin', 'sales', 'user'],
    },
    {
      path: '/products',
      icon: <Package className="h-5 w-5" />,
      label: 'Products',
      roles: ['admin', 'sales', 'user'],
    },
    {
      path: '/admin/warehouses',
      icon: <Warehouse className="h-5 w-5" />,
      label: 'Inventory',
      roles: ['admin'],
    },
    {
      path: '/cart',
      icon: <ShoppingCart className="h-5 w-5" />,
      label: 'Cart',
      roles: ['user'],
      badge: cartState.totalItems > 0 ? cartState.totalItems : undefined,
    },
    {
      path: '/account',
      icon: <User className="h-5 w-5" />,
      label: 'Account',
      roles: ['admin', 'sales', 'user'],
    },
  ];

  // Filter items based on user role
  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.some(role => {
      if (role === 'admin') return isAdmin;
      if (role === 'sales') return isSales;
      if (role === 'user') return true; // All authenticated users
      return roles.includes(role);
    });
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

