import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CreditCard,
  LogOut,
  BarChart3,
  Target,
  Store,
  PanelLeft,
  X,
} from 'lucide-react';

const SalesLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/sales',
      icon: <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'Orders',
      path: '/sales/orders',
      icon: <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'Customers',
      path: '/sales/customers',
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'Credit Management',
      path: '/sales/credit-management',
      icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'Sales Analytics',
      path: '/sales/analytics',
      icon: <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'Leads',
      path: '/sales/leads',
      icon: <Target className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
    {
      label: 'POS',
      path: '/sales/pos',
      icon: <Store className="h-4 w-4 sm:h-5 sm:w-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="flex items-center justify-between p-4">
          <Link to="/sales" className="text-xl font-bold text-primary">
            <span className="font-playfair">Fresh</span>
            <span className="text-primary-light">Basket</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-red-600"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className={`hidden lg:block fixed inset-y-0 left-0 bg-white border-r transition-all duration-200 ease-linear ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 border-b px-4">
            {sidebarOpen ? (
              <Link to="/sales" className="text-xl font-bold text-primary">
                <span className="font-playfair">Fresh</span>
                <span className="text-primary-light">Basket</span>
              </Link>
            ) : (
              <Link to="/sales" className="text-xl font-bold text-primary">
                <span className="font-playfair">FB</span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7"
            >
              {sidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  isActive(item.path)
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${sidebarOpen ? '' : 'justify-center'}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                {item.icon}
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
              </Link>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className={`w-full text-red-600 hover:text-red-700 hover:bg-red-50 ${
                sidebarOpen ? 'justify-start' : 'justify-center'
              }`}
              onClick={handleSignOut}
              title={!sidebarOpen ? 'Sign Out' : undefined}
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="ml-3">Sign Out</span>}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 shadow-lg">
        <nav className="flex justify-around items-center px-0.5 py-1.5">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center px-1 py-1 rounded-md min-w-[50px] max-w-[60px] flex-1 ${
                isActive(item.path)
                  ? 'text-primary bg-primary/10'
                  : 'text-gray-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] sm:text-xs mt-0.5 text-center leading-tight break-words">
                {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen overflow-y-auto transition-all duration-200 ease-linear ${
        sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
      }`}>
        <header className="hidden lg:flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </header>
        <main className="p-4 lg:p-8 min-h-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SalesLayout; 