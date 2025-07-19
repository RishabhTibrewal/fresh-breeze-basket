import { ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { User, Package, CreditCard, Settings, LogOut, ChevronLeft, Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user/UserNav';
import { useAuth } from '@/contexts/AuthContext';

const AccountLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navigation = [
    { 
      name: 'Profile', 
      href: '/account', 
      icon: User, 
      active: pathname === '/account' 
    },
    { 
      name: 'Address',
      href: '/account/address',
      icon: User, // You may want to use a different icon
      active: pathname === '/account/address'
    },
    { 
      name: 'Orders', 
      href: '/account/orders', 
      icon: Package, 
      active: pathname === '/account/orders' || pathname.startsWith('/account/orders/') 
    },
    { 
      name: 'Payment History', 
      href: '/account/payments', 
      icon: Receipt, 
      active: pathname === '/account/payments' 
    },
    { 
      name: 'Payment Methods', 
      href: '/account/payment', 
      icon: CreditCard, 
      active: pathname === '/account/payment' 
    },
    { 
      name: 'Settings', 
      href: '/account/settings', 
      icon: Settings, 
      active: pathname === '/account/settings' 
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Button 
        variant="outline"
        onClick={() => navigate('/')}
        className="mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Home
      </Button>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Account</h1>
        <UserNav />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center p-3 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 mr-3 ${item.active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              {item.name}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="flex items-center w-full p-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3 text-red-600" />
            Sign Out
          </button>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AccountLayout; 