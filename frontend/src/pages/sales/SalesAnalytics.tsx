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
  Calendar
} from 'lucide-react';
import { ordersService } from '@/api/orders';
import { formatCurrency } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

export default function SalesAnalytics() {
  const [period, setPeriod] = useState(30);

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['salesAnalytics', period],
    queryFn: () => ordersService.getSalesAnalytics(period),
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

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Sales Analytics</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
            Comprehensive insights into your sales performance
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

      {/* Sales Target Progress */}
      {analytics?.target && (
        <Card className="border-primary w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-base sm:text-lg lg:text-xl">
              <span>Sales Target Progress</span>
              <Badge variant="outline" className="capitalize text-xs sm:text-sm">
                {analytics.target.periodType}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {new Date(analytics.target.periodStart).toLocaleDateString()} - {new Date(analytics.target.periodEnd).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Current Revenue</p>
                  <p className="text-xl sm:text-2xl font-bold break-words">{formatCurrency(analytics.target.currentRevenue)}</p>
                </div>
                <div className="text-left sm:text-right min-w-0 flex-1 sm:flex-initial">
                  <p className="text-xs sm:text-sm text-muted-foreground">Target</p>
                  <p className="text-xl sm:text-2xl font-bold break-words">{formatCurrency(analytics.target.targetAmount)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{analytics.target.progressPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                  <div
                    className={`h-2.5 sm:h-3 rounded-full transition-all ${
                      analytics.target.progressPercentage >= 100
                        ? 'bg-green-600'
                        : analytics.target.progressPercentage >= 75
                        ? 'bg-blue-600'
                        : analytics.target.progressPercentage >= 50
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(analytics.target.progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
              {analytics.target.remaining > 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="font-medium">{formatCurrency(analytics.target.remaining)}</span> remaining to reach target
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-green-600 font-medium">
                  🎉 Target exceeded by {formatCurrency(Math.abs(analytics.target.remaining))}!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-xs sm:text-sm font-medium">Paid Revenue</CardTitle>
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{formatCurrency(revenue.paid)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {revenue.total > 0 ? ((revenue.paid / revenue.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Credit Revenue</CardTitle>
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{formatCurrency(revenue.credit)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {revenue.total > 0 ? ((revenue.credit / revenue.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

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

      {/* Orders Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg">Orders by Status</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Distribution of order statuses</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {Object.keys(orders.byStatus).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(orders.byStatus).map(([status, count]: [string, any]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {status}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg">Orders by Payment Method</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Payment method distribution</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {Object.keys(orders.byPaymentMethod).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(orders.byPaymentMethod).map(([method, count]: [string, any]) => (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {method}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
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
          <CardDescription className="text-xs sm:text-sm">Your highest value customers</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {customers.topCustomers.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">No customer data available</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {customers.topCustomers.map((customer: any) => (
                  <Card key={customer.id} className="w-full min-w-0 overflow-hidden">
                    <CardContent className="px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm break-words">{customer.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{customer.orderCount} orders</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium text-sm">{formatCurrency(customer.revenue)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border w-full min-w-0 overflow-x-auto">
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
            </>
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
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {products.topProducts.map((product: any) => (
                  <Card key={product.id} className="w-full min-w-0 overflow-hidden">
                    <CardContent className="px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm break-words">{product.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{product.quantity} sold</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium text-sm">{formatCurrency(product.revenue)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border w-full min-w-0 overflow-x-auto">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Summary */}
      <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-lg">Credit Summary</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Credit utilization and limits</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Credit Limit</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 break-words">{formatCurrency(customers.creditSummary.totalLimit)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Current Credit Used</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 break-words">{formatCurrency(customers.creditSummary.totalCredit)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Utilization Rate</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">{customers.creditSummary.utilizationRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2 sm:h-2.5">
              <div
                className="bg-primary h-2 sm:h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(customers.creditSummary.utilizationRate, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
