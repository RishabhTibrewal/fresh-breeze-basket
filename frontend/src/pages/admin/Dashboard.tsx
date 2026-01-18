import React, { useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  LogOut,
  Grid,
  Target,
  UserCheck,
  Warehouse,
  FileText,
  Building2,
  Receipt,
  ReceiptText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const location = useLocation();

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/products', icon: Package, label: 'Products' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/admin/customers', icon: Users, label: 'Customers' },
    { path: '/admin/warehouses', icon: Warehouse, label: 'Warehouses' },
    { path: '/admin/purchase-orders', icon: FileText, label: 'Purchase Orders' },
    { path: '/admin/goods-receipts', icon: Receipt, label: 'Goods Receipts' },
    { path: '/admin/purchase-invoices', icon: ReceiptText, label: 'Purchase Invoices' },
    { path: '/admin/suppliers', icon: Building2, label: 'Suppliers' },
    { path: '/admin/leads', icon: UserCheck, label: 'Leads' },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };
  
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
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-50">
          <div className="flex items-center justify-between p-4">
            <Link to="/admin" className="text-xl font-bold text-primary flex items-center">
              <span className="font-playfair">Fresh</span>
              <span className="text-primary-light">Basket</span>
              <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-md">Admin</span>
            </Link>
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
        <Sidebar className="hidden md:flex">
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
                    <SidebarMenuButton asChild tooltip="Categories">
                      <Link to="/admin/categories">
                        <Grid className="h-4 w-4" />
                        <span>Categories</span>
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Sales Targets">
                      <Link to="/admin/sales-targets">
                        <Target className="h-4 w-4" />
                        <span>Sales Targets</span>
                      </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Leads">
                      <Link to="/admin/warehouses">
                        <UserCheck className="h-4 w-4" />
                        <span>Warehouses</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Leads">
                      <Link to="/admin/leads">
                        <UserCheck className="h-4 w-4" />
                        <span>Leads</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Procurement</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Purchase Orders">
                      <Link to="/admin/purchase-orders">
                        <FileText className="h-4 w-4" />
                        <span>Purchase Orders</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Goods Receipts">
                      <Link to="/admin/goods-receipts">
                        <Receipt className="h-4 w-4" />
                        <span>Goods Receipts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Purchase Invoices">
                      <Link to="/admin/purchase-invoices">
                        <ReceiptText className="h-4 w-4" />
                        <span>Purchase Invoices</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Suppliers">
                      <Link to="/admin/suppliers">
                        <Building2 className="h-4 w-4" />
                        <span>Suppliers</span>
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

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
          <nav className="flex justify-around items-center px-2 py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center px-2 py-2 rounded-md min-w-[60px] ${
                    isActive(item.path)
                      ? 'text-primary'
                      : 'text-gray-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs mt-1 text-center">{item.label.length > 8 ? item.label.substring(0, 8) : item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <SidebarInset className="overflow-x-hidden">
          <div className="w-full max-w-full min-w-0 px-2 sm:px-4 lg:px-6 mx-auto pt-16 md:pt-4 pb-20 md:pb-4 overflow-x-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
