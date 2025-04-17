
import React, { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  LogOut
} from 'lucide-react';
import { 
  SidebarProvider, 
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
  SidebarInset
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { isAdmin, profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Enhanced debugging logs
    console.log('Admin Dashboard - Auth Check:', { 
      isAdmin,
      profileData: profile,
      userId: user?.id,
      userRole: profile?.role,
      isAdminFunction: typeof isAdmin === 'function' ? 'function' : 'value',
      isAdminValue: isAdmin
    });
    
    // Double-check admin status with a delay to ensure all data is loaded
    setTimeout(() => {
      console.log('Delayed Admin Check:', {
        isAdmin,
        role: profile?.role,
        hasProfile: !!profile
      });
      
      if (!isAdmin) {
        toast.error('You do not have administrator privileges');
        navigate('/', { replace: true });
      }
    }, 500);
  }, [isAdmin, profile, navigate, user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-border">
            <Link to="/admin" className="flex items-center">
              <div className="text-xl font-bold text-primary flex items-center">
                <span className="font-playfair">Fresh</span>
                <span className="text-primary-light">Basket</span>
                <span className="ml-2 text-sm bg-primary text-white px-2 py-0.5 rounded-md">Admin</span>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {/* Display admin info for debugging */}
            <div className="px-4 py-2 text-sm text-muted-foreground">
              <p>User: {user?.email}</p>
              <p>Role: {profile?.role || 'Unknown'}</p>
              <p>Admin: {isAdmin ? 'Yes' : 'No'}</p>
              <p>Profile ID: {profile?.id || 'Not loaded'}</p>
            </div>
            
            <SidebarGroup>
              <SidebarGroupLabel>General</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Dashboard">
                      <Link to="/admin">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Products">
                      <Link to="/admin/products">
                        <Package className="h-4 w-4" />
                        <span>Products</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Orders">
                      <Link to="/admin/orders">
                        <ShoppingCart className="h-4 w-4" />
                        <span>Orders</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Customers">
                      <Link to="/admin/customers">
                        <Users className="h-4 w-4" />
                        <span>Customers</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Settings">
                      <Link to="/admin/settings">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Log Out" onClick={signOut}>
                  <button className="flex items-center w-full">
                    <LogOut className="h-4 w-4" />
                    <span>Log Out</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div className="container p-4 mx-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
