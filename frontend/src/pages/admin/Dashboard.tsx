import React, { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  SidebarProvider, 
  SidebarInset,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ERPSidebar } from '@/components/navigation/ERPSidebar';
import { ERPSidebarMobile } from '@/components/navigation/ERPSidebarMobile';

const MobileMenuTrigger = () => {
  const { setOpenMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpenMobile(true)}
      className="md:hidden"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
};

const AdminDashboard = () => {
  const { isAdmin, isAccounts, profile, signOut, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Enhanced debugging logs
    console.log('Admin Dashboard - Auth Check:', { 
      isAdmin,
      profileData: profile,
      userId: user?.id,
      userRole: role,
      isAdminFunction: typeof isAdmin === 'function' ? 'function' : 'value',
      isAdminValue: isAdmin
    });
    
    // Double-check admin status with a delay to ensure all data is loaded
    setTimeout(() => {
      console.log('Delayed Admin Check:', {
        isAdmin,
        role,
        hasProfile: !!profile
      });
      
      if (!isAdmin && !isAccounts) {
        toast.error('You do not have administrator privileges');
        navigate('/', { replace: true });
      }
    }, 500);
  }, [isAdmin, profile, role, navigate, user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <MobileMenuTrigger />
              <Link to="/admin" className="text-xl font-bold text-primary flex items-center">
                <span className="font-playfair">Fresh</span>
                <span className="text-primary-light">Basket</span>
                <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-md">Admin</span>
              </Link>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <ERPSidebar onSignOut={signOut} />

        {/* Mobile Sidebar Drawer */}
        <ERPSidebarMobile onSignOut={signOut} />

        <SidebarInset className="overflow-x-hidden">
          <header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="w-full max-w-full min-w-0 px-2 sm:px-4 lg:px-6 mx-auto pt-16 md:pt-0 pb-4 overflow-x-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
