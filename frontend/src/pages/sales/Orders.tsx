import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Edit, Calendar, DollarSign, User, CreditCard } from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';

export default function Orders() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  
  // Get all orders for sales staff's customers
  const { 
    data: orders = [], 
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: async () => {
      try {
        console.log('Fetching sales orders...');
        const response = await apiClient.get('/orders/sales');
        console.log('Sales orders response:', response.data);
        
        // Log credit details for debugging
        response.data.forEach((order: any) => {
          console.log('Order:', order.id, {
            payment_status: order.payment_status,
            has_credit_details: !!order.credit_details,
            credit_details: order.credit_details
          });
        });
        
        return response.data;
      } catch (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }
    },
  });
  
  useEffect(() => {
    if (isError) {
      console.error('Orders page error:', error);
      toast.error(`Failed to load orders: ${(error as Error).message}`);
    }
  }, [isError, error]);
  
  // Filter orders based on search and filters
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.order_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (order.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (order.status?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    
    return matchesSearch && matchesStatus && matchesPayment;
  });
  
  // Log filtered orders when they change
  useEffect(() => {
    console.log('Filtered orders:', {
      total: filteredOrders.length,
      searchQuery,
      statusFilter,
      paymentFilter,
      orders: filteredOrders
    });
  }, [filteredOrders, searchQuery, statusFilter, paymentFilter]);
  
  // Helper for status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      case 'shipped':
        return <Badge variant="default">Shipped</Badge>;
      case 'delivered':
        return <Badge className="bg-green-600">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Helper for payment status badge
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'full_payment':
        return <Badge className="bg-green-600">Full Payment</Badge>;
      case 'partial_payment':
        return <Badge className="bg-yellow-500">Partial Payment</Badge>;
      case 'full_credit':
        return <Badge className="bg-blue-500">Full Credit</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Helper for payment method display
  const formatPaymentMethod = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'cheque':
        return 'Cheque';
      default:
        return method || 'N/A';
    }
  };
  
  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined, formatStr = 'MMM d, yyyy') => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), formatStr);
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Helper function to check if date is valid
  const isValidDate = (dateString: string | null | undefined) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };
  
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl lg:text-3xl break-words">Order Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1 break-words">
                View and manage all orders from your customers
              </CardDescription>
            </div>
            <Button 
              onClick={() => navigate('/sales/customers')}
              className="w-full sm:w-auto text-sm sm:text-base flex-shrink-0"
            >
              <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Create New Order
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mb-3 sm:mb-4 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-8 text-sm sm:text-base h-9 sm:h-10 w-full min-w-0"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] lg:w-[180px] text-sm sm:text-base h-9 sm:h-10 min-w-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">All Statuses</SelectItem>
                <SelectItem value="pending" className="text-sm">Pending</SelectItem>
                <SelectItem value="processing" className="text-sm">Processing</SelectItem>
                <SelectItem value="shipped" className="text-sm">Shipped</SelectItem>
                <SelectItem value="delivered" className="text-sm">Delivered</SelectItem>
                <SelectItem value="cancelled" className="text-sm">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[140px] lg:w-[180px] text-sm sm:text-base h-9 sm:h-10 min-w-0">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">All Payments</SelectItem>
                <SelectItem value="full_payment" className="text-sm">Full Payment</SelectItem>
                <SelectItem value="partial_payment" className="text-sm">Partial Payment</SelectItem>
                <SelectItem value="full_credit" className="text-sm">Full Credit</SelectItem>
                <SelectItem value="pending" className="text-sm">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No orders found</div>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id} className="p-3 w-full min-w-0 overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/sales/orders/${order.id}`)}>
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-1 break-words">
                          Order #{order.order_number}
                        </div>
                        <div className="text-base font-bold text-green-600 mb-2">
                          ${parseFloat(order.total_amount).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {getStatusBadge(order.status)}
                        {getPaymentStatusBadge(order.payment_status)}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs min-w-0">
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{order.customer?.name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{formatDate(order.created_at)}</span>
                      </div>
                      {order.payment_method && (
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <span className="text-xs">Method: {formatPaymentMethod(order.payment_method)}</span>
                        </div>
                      )}
                      {order.credit_details && (
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 pt-1 border-t">
                          <CreditCard className="h-3 w-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs">
                              ${order.credit_details.amount?.toFixed(2) || parseFloat(order.credit_details.amount).toFixed(2)}
                            </div>
                            <div className="text-xs">
                              Due: {formatDate(order.credit_details.end_date || order.credit_details.due_date, 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs mt-0.5">
                              {order.credit_details.description === 'Order Cancelled' ? (
                                <span className="font-semibold text-gray-600">Cancelled</span>
                              ) : new Date() > new Date(order.credit_details.end_date || order.credit_details.due_date) ? (
                                <span className="font-semibold text-red-600">Overdue</span>
                              ) : (
                                <span className="font-semibold text-green-600">Active</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1.5 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/orders/${order.id}`);
                        }}
                        className="flex-1 text-xs h-8"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/orders/${order.id}/edit`);
                        }}
                        className="flex-1 text-xs h-8"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Update
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block w-full min-w-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2">Order #</TableHead>
                  <TableHead className="px-2">Customer</TableHead>
                  <TableHead className="px-2">Date</TableHead>
                  <TableHead className="px-2">Total</TableHead>
                  <TableHead className="px-2">Status</TableHead>
                  <TableHead className="px-2">Payment</TableHead>
                  <TableHead className="px-2">Credit</TableHead>
                  <TableHead className="px-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm">Loading...</TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="px-2 py-2 font-medium text-sm">{order.order_number}</TableCell>
                      <TableCell className="px-2 py-2 text-sm">{order.customer?.name || 'N/A'}</TableCell>
                      <TableCell className="px-2 py-2 text-sm">{formatDate(order.created_at)}</TableCell>
                      <TableCell className="px-2 py-2 text-sm font-medium">${parseFloat(order.total_amount).toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-2">{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="space-y-1">
                          <div>{getPaymentStatusBadge(order.payment_status)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPaymentMethod(order.payment_method)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        {order.credit_details ? (
                          <div className="text-xs sm:text-sm">
                            <div className="font-medium">${order.credit_details.amount?.toFixed(2) || parseFloat(order.credit_details.amount).toFixed(2)}</div>
                            <div className="text-muted-foreground">
                              Due: {formatDate(order.credit_details.end_date || order.credit_details.due_date, 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs">
                              {order.credit_details.description === 'Order Cancelled' ? (
                                <span className="text-xs font-semibold text-gray-600">Cancelled</span>
                              ) : new Date() > new Date(order.credit_details.end_date || order.credit_details.due_date) ? (
                                <span className="text-xs font-semibold text-red-600">Overdue</span>
                              ) : (
                                <span className="text-xs font-semibold text-green-600">Active</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No credit</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}`)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}/edit`)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 