import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  CreditCard,
  Settings,
  LogOut
} from 'lucide-react';

const SalesLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const menuItems = [
    {
      path: '/sales',
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboard'
    },
    {
      path: '/sales/customers',
      icon: <Users className="w-5 h-5" />,
      label: 'Customers'
    },
    {
      path: '/sales/orders',
      icon: <ShoppingCart className="w-5 h-5" />,
      label: 'Orders'
    },
    {
      path: '/sales/credit',
      icon: <CreditCard className="w-5 h-5" />,
      label: 'Credit Management'
    },
    {
      path: '/sales/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b">
            <Link to="/sales" className="text-xl font-bold text-primary">
              <span className="font-playfair">Fresh</span>
              <span className="text-primary-light">Basket</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  isActive(item.path)
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SalesLayout; 