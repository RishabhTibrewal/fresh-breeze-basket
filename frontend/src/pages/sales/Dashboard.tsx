import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/api/auth';
import { ordersService } from '@/api/orders';
import {
  Users,
  ShoppingCart,
  CreditCard,
  TrendingUp
} from 'lucide-react';

const SalesDashboard = () => {
  const { user, profile } = useAuth();

  const handleUpdateRole = async () => {
    try {
      const result = await authService.updateRole({ role: 'sales' });
      console.log('Role update result:', result);
      window.location.reload();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['salesDashboard'],
    queryFn: async () => {
      return await ordersService.getSalesDashboardStats();
    }
  });

  if (isLoading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
        <Skeleton className="h-6 sm:h-8 w-1/2 sm:w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="p-3 sm:p-6 bg-destructive/10 border border-destructive rounded-lg text-center">
          <h3 className="text-base sm:text-lg font-semibold text-destructive">Error Loading Dashboard</h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">Failed to load dashboard statistics. Please try again later.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-primary text-white px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">Sales Dashboard</h1>
        {profile?.role !== 'sales' && (
          <Button onClick={handleUpdateRole} className="w-full sm:w-auto text-sm sm:text-base">
            Update Role to Sales
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data?.totalCredit?.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">&nbsp;</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg lg:text-xl">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="space-y-4">
            {data?.recentOrders?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No recent orders</div>
            ) : data?.recentOrders?.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{order.customer}</div>
                  <div className="text-sm text-gray-500">Order #{order.id}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${order.amount}</div>
                  <div className={`text-sm ${
                    order.status === 'completed' ? 'text-green-600' :
                    order.status === 'processing' ? 'text-blue-600' :
                    'text-yellow-600'
                  }`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesDashboard; 