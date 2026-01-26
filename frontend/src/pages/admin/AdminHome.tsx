import React, { useEffect, useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminService, DashboardStats } from '@/api/admin';
import { warehousesService } from '@/api/warehouses';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

const AdminHome = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await adminService.getDashboardStats();
        setStats(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError("Failed to load dashboard statistics. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Fetch bulk stock data for low inventory items
  const productIdsForStock = stats?.low_inventory?.map(item => item.id) || [];
  const { data: lowInventoryStockData = {}, isLoading: isLoadingStock, error: stockError } = useQuery({
    queryKey: ['bulk-product-stock-low-inventory', productIdsForStock.join(',')],
    queryFn: async () => {
      if (!stats?.low_inventory || stats.low_inventory.length === 0) return {};
      const productIds = stats.low_inventory.map(item => item.id);
      if (productIds.length === 0) return {};
      try {
        const result = await warehousesService.getBulkProductStock(productIds);
        console.log('Bulk stock data fetched:', result);
        return result;
      } catch (error) {
        console.error('Error fetching bulk stock:', error);
        return {};
      }
    },
    enabled: !loading && productIdsForStock.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Debug logging
  useEffect(() => {
    if (stats?.low_inventory && lowInventoryStockData) {
      console.log('Low inventory items:', stats.low_inventory.map(item => ({ id: item.id, name: item.name })));
      console.log('Stock data:', lowInventoryStockData);
    }
  }, [stats?.low_inventory, lowInventoryStockData]);

  // Format customer name helper
  const formatCustomerName = (order: any) => {
    if (!order.profiles) return 'Unknown User';
    
    const { first_name, last_name, email } = order.profiles;
    
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    } else if (first_name) {
      return first_name;
    } else {
      return email.split('@')[0];
    }
  };

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive rounded-lg text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-destructive">Error Loading Dashboard</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-primary text-white px-4 py-2 rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to the admin panel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.product_stats.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{stats?.product_stats.new_this_week || 0} added this week
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.sales_stats.total || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {parseFloat(stats?.sales_stats.percent_change || '0') >= 0 ? '+' : ''}
                  {stats?.sales_stats.percent_change || '0'}% from last month
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.order_stats.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.order_stats.total || 0} total orders
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.user_stats.total || 0}</div>
                <p className="text-xs text-muted-foreground">&nbsp;</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recent_orders && stats.recent_orders.length > 0 ? (
              <div className="space-y-4">
                {stats.recent_orders.map((order, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">#{order.id.split('-')[0]}</div>
                      <div className="text-sm text-muted-foreground">{formatCustomerName(order)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(order.total_amount)}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No orders found
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Low Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.low_inventory && stats.low_inventory.length > 0 ? (
              <div className="space-y-4">
                {isLoadingStock ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading stock data...</div>
                ) : stockError ? (
                  <div className="text-center py-4 text-red-500 text-sm">Error loading stock data</div>
                ) : (
                  stats.low_inventory.map((item, i) => {
                    // Use ONLY warehouse inventory stock - no fallback to product.stock_count
                    const stockData = lowInventoryStockData[item.id] as { warehouses: any[], total_stock: number } | undefined;
                    const actualStock = stockData?.total_stock ?? 0;
                    
                    // Debug: Log if stock is 0 but we expect it to have stock
                    if (actualStock === 0 && stockData === undefined) {
                      console.warn(`Product ${item.name} (${item.id}) has no warehouse inventory data`);
                    }
                    
                    return (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">{item.categories?.name || 'Uncategorized'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{actualStock} units</div>
                          <div className={`text-sm ${actualStock === 0 ? 'text-red-500' : actualStock <= 5 ? 'text-orange-500' : 'text-green-500'}`}>
                            {actualStock === 0 ? 'Out of Stock' : actualStock <= 5 ? 'Low Stock' : 'In Stock'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No low inventory items
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHome;
