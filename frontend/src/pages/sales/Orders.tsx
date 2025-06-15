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
import { Search, Plus, Eye, Edit } from "lucide-react";
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
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Order Management</CardTitle>
              <CardDescription>
                View and manage all orders from your customers
              </CardDescription>
            </div>
            <Button onClick={() => navigate('/sales/customers')}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Order
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by order number, customer, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="full_payment">Full Payment</SelectItem>
                <SelectItem value="partial_payment">Partial Payment</SelectItem>
                <SelectItem value="full_credit">Full Credit</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.customer?.name || 'N/A'}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>${parseFloat(order.total_amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{getPaymentStatusBadge(order.payment_status)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPaymentMethod(order.payment_method)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.credit_details ? (
                          <div className="text-sm">
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
                          <span className="text-muted-foreground">No credit</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Update
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