import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Calendar,
  User
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { formatCurrency } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

interface SalesExecutive {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface SalesAnalytics {
  revenue: {
    total: number;
    paid: number;
    credit: number;
    daily: Array<{ date: string; amount: number }>;
    monthly: Array<{ month: string; amount: number }>;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byPaymentMethod: Record<string, number>;
    daily: Array<{ date: string; count: number }>;
  };
  customers: {
    total: number;
    topCustomers: Array<{ id: string; name: string; revenue: number; orderCount: number }>;
    creditSummary: {
      totalCredit: number;
      totalLimit: number;
      utilizationRate: number;
    };
  };
  products: {
    topProducts: Array<{ id: string; name: string; revenue: number; quantity: number }>;
  };
  trends: {
    revenueGrowth: number;
    orderGrowth: number;
  };
  salesExecutives: Array<{
    executive: SalesExecutive;
    revenue: number;
    orders: number;
    customers: number;
  }>;
}

export default function SalesAnalysis() {
  const [period, setPeriod] = useState(30);

  const { data: analytics, isLoading, error } = useQuery<SalesAnalytics>({
    queryKey: ['adminSalesAnalytics', period],
    queryFn: async () => {
      // First get all sales executives
      const execResponse = await apiClient.get('/admin/sales-executives');
      const executives: SalesExecutive[] = execResponse.data.data || [];

      // Get all orders for the period to calculate aggregate analytics
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      
      const ordersResponse = await apiClient.get('/orders', {
        params: {
          from_date: startDate.toISOString(),
          to_date: endDate.toISOString(),
          limit: 10000
        }
      });
      const allOrders = ordersResponse.data.data || [];

      // Get per-executive breakdown
      const executiveBreakdown = await Promise.all(
        executives.map(async (exec) => {
          try {
            // Get customers for this executive
            const customersResponse = await apiClient.get('/customers', {
              params: { sales_executive_id: exec.id }
            });
            const customers = customersResponse.data.data || [];
            const customerUserIds = customers.map((c: any) => c.user_id);
            
            // Get orders for these customers
            const execOrders = allOrders.filter((order: any) => 
              customerUserIds.includes(order.user_id)
            );
            
            const revenue = execOrders.reduce((sum: number, order: any) => 
              sum + parseFloat(order.total_amount || '0'), 0
            );
            
            return {
              executive: exec,
              revenue,
              orders: execOrders.length,
              customers: customers.length,
            };
          } catch (err) {
            console.error(`Error fetching data for executive ${exec.id}:`, err);
            return {
              executive: exec,
              revenue: 0,
              orders: 0,
              customers: 0,
            };
          }
        })
      );

      // Calculate aggregate metrics
      const filteredOrders = allOrders.filter((o: any) => o.status !== 'cancelled');
      const totalRevenue = filteredOrders.reduce((sum: number, o: any) => 
        sum + parseFloat(o.total_amount || '0'), 0
      );
      
      // Group by date for daily revenue
      const dailyRevenueMap = new Map<string, number>();
      filteredOrders.forEach((order: any) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        dailyRevenueMap.set(date, (dailyRevenueMap.get(date) || 0) + parseFloat(order.total_amount || '0'));
      });
      const daily = Array.from(dailyRevenueMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Group by month
      const monthlyMap = new Map<string, number>();
      filteredOrders.forEach((order: any) => {
        const date = new Date(order.created_at);
        const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + parseFloat(order.total_amount || '0'));
      });
      const monthly = Array.from(monthlyMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        });

      // Calculate trends (compare first half vs second half)
      const midPoint = Math.floor(filteredOrders.length / 2);
      const firstHalf = filteredOrders.slice(0, midPoint);
      const secondHalf = filteredOrders.slice(midPoint);
      const firstHalfRevenue = firstHalf.reduce((sum: number, o: any) => 
        sum + parseFloat(o.total_amount || '0'), 0
      );
      const secondHalfRevenue = secondHalf.reduce((sum: number, o: any) => 
        sum + parseFloat(o.total_amount || '0'), 0
      );
      const revenueGrowth = firstHalfRevenue > 0 
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
        : 0;
      const orderGrowth = firstHalf.length > 0 
        ? ((secondHalf.length - firstHalf.length) / firstHalf.length) * 100 
        : 0;

      // Get all customers
      const customersResponse = await apiClient.get('/customers');
      const allCustomers = customersResponse.data.data || [];

      return {
        revenue: {
          total: totalRevenue,
          paid: totalRevenue, // Simplified - would need payment status to calculate properly
          credit: 0,
          daily,
          monthly,
        },
        orders: {
          total: filteredOrders.length,
          byStatus: {},
          byPaymentMethod: {},
          daily: [],
        },
        customers: {
          total: allCustomers.length,
          topCustomers: [],
          creditSummary: {
            totalCredit: 0,
            totalLimit: 0,
            utilizationRate: 0,
          },
        },
        products: {
          topProducts: [],
        },
        trends: {
          revenueGrowth,
          orderGrowth,
        },
        salesExecutives: executiveBreakdown,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
        <Skeleton className="h-6 sm:h-8 w-1/2 sm:w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
        <div className="p-4 sm:p-6 bg-destructive/10 border border-destructive rounded-lg text-center">
          <h3 className="text-base sm:text-lg font-semibold text-destructive">Error Loading Analytics</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">Failed to load analytics data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const revenue = analytics?.revenue || { total: 0, paid: 0, credit: 0, daily: [], monthly: [] };
  const orders = analytics?.orders || { total: 0, byStatus: {}, byPaymentMethod: {}, daily: [] };
  const customers = analytics?.customers || { total: 0, topCustomers: [], creditSummary: { totalCredit: 0, totalLimit: 0, utilizationRate: 0 } };
  const products = analytics?.products || { topProducts: [] };
  const trends = analytics?.trends || { revenueGrowth: 0, orderGrowth: 0 };
  const salesExecutives = analytics?.salesExecutives || [];

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Sales Analysis</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
            Comprehensive sales insights across all sales executives
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Select
            value={period.toString()}
            onValueChange={(value) => setPeriod(parseInt(value, 10))}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10 text-sm sm:text-base">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{formatCurrency(revenue.total)}</div>
            <div className="flex items-center mt-2">
              {trends.revenueGrowth >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 mr-1 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 mr-1 flex-shrink-0" />
              )}
              <span className={`text-xs ${trends.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trends.revenueGrowth >= 0 ? '+' : ''}{trends.revenueGrowth.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{orders.total}</div>
            <div className="flex items-center mt-2">
              {trends.orderGrowth >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 mr-1 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 mr-1 flex-shrink-0" />
              )}
              <span className={`text-xs ${trends.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trends.orderGrowth >= 0 ? '+' : ''}{trends.orderGrowth.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{customers.total}</div>
            <p className="text-xs text-muted-foreground mt-2">Active customers</p>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Sales Executives</CardTitle>
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{salesExecutives.length}</div>
            <p className="text-xs text-muted-foreground mt-2">Active sales team</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Executives Performance */}
      <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-lg">Sales Executives Performance</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Performance breakdown by sales executive</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {salesExecutives.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">No sales executive data available</div>
          ) : (
            <div className="rounded-md border w-full min-w-0 overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm">Sales Executive</TableHead>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm">Customers</TableHead>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm">Orders</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs sm:text-sm">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesExecutives
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((item) => (
                      <TableRow key={item.executive.id}>
                        <TableCell className="px-2 py-2 font-medium text-xs sm:text-sm">
                          {item.executive.first_name} {item.executive.last_name}
                          <div className="text-xs text-muted-foreground">{item.executive.email}</div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs sm:text-sm">{item.customers}</TableCell>
                        <TableCell className="px-2 py-2 text-xs sm:text-sm">{item.orders}</TableCell>
                        <TableCell className="text-right px-2 py-2 font-medium text-xs sm:text-sm">
                          {formatCurrency(item.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg">Daily Revenue Trend</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Revenue breakdown by day</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {revenue.daily.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <div className="space-y-2">
                {revenue.daily.slice(-7).map((day: any) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-medium">{formatCurrency(day.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg">Monthly Revenue Trend</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Revenue breakdown by month</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {revenue.monthly.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <div className="space-y-2">
                {revenue.monthly.map((month: any) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{month.month}</span>
                    <span className="font-medium">{formatCurrency(month.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-lg">Top Customers by Revenue</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Highest value customers across all sales</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {customers.topCustomers.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">No customer data available</div>
          ) : (
            <div className="rounded-md border w-full min-w-0 overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm">Customer Name</TableHead>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm w-20">Orders</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs sm:text-sm">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.topCustomers.map((customer: any) => (
                    <TableRow key={customer.id}>
                      <TableCell className="px-2 py-2 font-medium text-xs sm:text-sm break-words">{customer.name}</TableCell>
                      <TableCell className="px-2 py-2 text-xs sm:text-sm">{customer.orderCount}</TableCell>
                      <TableCell className="text-right px-2 py-2 font-medium text-xs sm:text-sm">
                        {formatCurrency(customer.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-lg">Top Products by Revenue</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Best performing products</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {products.topProducts.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">No product data available</div>
          ) : (
            <div className="rounded-md border w-full min-w-0 overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm">Product Name</TableHead>
                    <TableHead className="px-2 py-2 text-xs sm:text-sm w-24">Quantity Sold</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs sm:text-sm">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.topProducts.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="px-2 py-2 font-medium text-xs sm:text-sm break-words">{product.name}</TableCell>
                      <TableCell className="px-2 py-2 text-xs sm:text-sm">{product.quantity}</TableCell>
                      <TableCell className="text-right px-2 py-2 font-medium text-xs sm:text-sm">
                        {formatCurrency(product.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
