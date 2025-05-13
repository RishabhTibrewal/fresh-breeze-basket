import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/api/auth';
import {
  Users,
  ShoppingCart,
  CreditCard,
  TrendingUp
} from 'lucide-react';

// TODO: Replace with actual API calls
const mockData = {
  totalCustomers: 150,
  totalOrders: 45,
  totalCredit: 25000,
  recentOrders: [
    { id: 1, customer: 'John Doe', amount: 1200, status: 'pending' },
    { id: 2, customer: 'Jane Smith', amount: 800, status: 'completed' },
    { id: 3, customer: 'Bob Johnson', amount: 1500, status: 'processing' }
  ]
};

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

  // TODO: Replace with actual API calls
  const { data, isLoading } = useQuery({
    queryKey: ['salesDashboard'],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockData;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sales Dashboard</h1>
        {profile?.role !== 'sales' && (
          <Button onClick={handleUpdateRole}>
            Update Role to Sales
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="text-2xl font-bold">${data?.totalCredit.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.5%</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.recentOrders.map((order) => (
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