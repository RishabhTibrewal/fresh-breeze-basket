import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CardFooter,
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
import { Search, ArrowLeft, Plus, Eye, Edit } from "lucide-react";
import { format } from 'date-fns';
import { customerService, CustomerOrder } from '@/api/customer';
import { toast } from 'sonner';

export default function CustomerOrders() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Store current customer ID in localStorage
  useEffect(() => {
    if (customerId) {
      localStorage.setItem('currentCustomerId', customerId);
    }
    
    // Clean up on unmount
    return () => {
      // Don't remove it when navigating to order details
      if (!window.location.pathname.includes('/orders/')) {
        localStorage.removeItem('currentCustomerId');
      }
    };
  }, [customerId]);
  
  // Get customer details
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerService.getCustomerById(customerId!),
    enabled: !!customerId,
  });
  
  // Get customer orders
  const { 
    data: orders = [], 
    isLoading: ordersLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['customerOrders', customerId],
    queryFn: () => customerService.getCustomerOrders(customerId!),
    enabled: !!customerId,
  });
  
  // Log orders data for debugging
  useEffect(() => {
    if (orders && orders.length > 0) {
      console.log('Customer orders loaded:', orders.length);
      console.log('First order details:', orders[0]);
      
      // Log credit details specifically
      orders.forEach(order => {
        if (order.credit_details) {
          console.log(`Order ${order.order_number} credit details:`, {
            amount: order.credit_details.amount,
            period: order.credit_details.period,
            start_date: order.credit_details.start_date,
            end_date: order.credit_details.end_date,
            due_date: (order.credit_details as any).due_date,
            date_used: order.credit_details.end_date || (order.credit_details as any).due_date
          });
        }
      });
    }
  }, [orders]);
  
  const isLoading = customerLoading || ordersLoading;
  
  useEffect(() => {
    if (isError) {
      toast.error(`Failed to load orders: ${(error as Error).message}`);
    }
  }, [isError, error]);
  
  // Add this function to check credit details in orders
  const addCreditDetailsFromPaymentInfo = (orders: any[]) => {
    console.log('Processing orders to add credit details:', orders.length);
    
    return orders.map(order => {
      // If order already has credit_details, just return it
      if (order.credit_details) {
        console.log(`Order ${order.order_number} already has credit_details:`, order.credit_details);
        return order;
      }
      
      // Check payment status to determine if we should create virtual credit details
      if (order.payment_status === 'partial' || order.payment_status === 'credit' || 
          order.payment_method === 'partial_payment' || order.payment_method === 'full_credit') {
        
        console.log(`Creating virtual credit_details for order ${order.order_number}`);
        // Create virtual credit details based on order information
        const creditAmount = order.total_amount;
        const startDate = order.created_at;
        
        // Calculate default end date (30 days from creation)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (customer?.credit_period_days || 30));
        
        const virtualCreditDetails = {
          amount: creditAmount,
          period: customer?.credit_period_days || 30,
          start_date: startDate,
          end_date: endDate.toISOString(),
          type: 'credit',
          description: 'Auto-generated credit details'
        };
        
        console.log(`Virtual credit details for order ${order.order_number}:`, virtualCreditDetails);
        
        return {
          ...order,
          credit_details: virtualCreditDetails
        };
      }
      
      return order;
    });
  };
  
  // Process orders to add credit details if missing
  const processedOrders = orders.length > 0 ? addCreditDetailsFromPaymentInfo(orders) : [];
  
  // Filter orders based on search
  const filteredOrders = processedOrders.filter(order => 
    (order.order_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (order.status?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );
  
  // Log the final filtered orders
  useEffect(() => {
    console.log('Filtered orders after processing:', filteredOrders.length);
    if (filteredOrders.length > 0) {
      console.log('First filtered order example:', filteredOrders[0]);
    }
  }, [filteredOrders]);
  
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

  // Helper for payment method
  const formatPaymentMethod = (method: string) => {
    if (!method) return 'N/A';
    
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'cheque':
        return 'Cheque';
      default:
        return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate('/sales/customers')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Button>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Orders for {customer?.name || 'Customer'}</CardTitle>
              <CardDescription>
                Manage orders for this customer
              </CardDescription>
            </div>
            <Button onClick={() => navigate(`/sales/orders/create?customerId=${customerId}`)}>
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
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
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
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>${parseFloat(order.total_amount.toString()).toFixed(2)}</TableCell>
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
                          (() => {
                            // Log credit details when rendering
                            console.log(`Rendering credit cell for order ${order.order_number}:`, {
                              order_id: order.id,
                              amount: order.credit_details.amount,
                              end_date: order.credit_details.end_date,
                              due_date: (order.credit_details as any).due_date, 
                              date_to_display: order.credit_details.end_date || (order.credit_details as any).due_date,
                              is_overdue: new Date() > new Date(order.credit_details.end_date || (order.credit_details as any).due_date),
                              order_status: order.status,
                              credit_status: order.credit_details.status
                            });
                            
                            // Determine credit status based on both order status and credit period status
                            const isCancelled = order.status === 'cancelled' || order.credit_details.status === 'cancelled';
                            const isOverdue = !isCancelled && new Date() > new Date(order.credit_details.end_date || (order.credit_details as any).due_date);
                            
                            return (
                              <div className="text-sm">
                                <div className="font-medium">${order.credit_details.amount?.toFixed(2) || parseFloat(order.credit_details.amount.toString()).toFixed(2)}</div>
                                <div className="text-muted-foreground">
                                  Due: {formatDate(order.credit_details.end_date || (order.credit_details as any).due_date, 'MMM d, yyyy')}
                                </div>
                                <div className="text-xs">
                                  {isCancelled 
                                    ? <span className="text-gray-600">Inactive</span>
                                    : isOverdue
                                      ? <span className="text-red-600">Overdue</span>
                                      : <span className="text-green-600">Active</span>
                                  }
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Period: {order.credit_details.period || "N/A"} days
                                </div>
                              </div>
                            );
                          })()
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
        
        {customer && (
          <CardFooter className="flex justify-between">
            <div>
              <p className="text-sm font-medium">Customer Information</p>
              <p className="text-sm">Email: {customer.email}</p>
              <p className="text-sm">Phone: {customer.phone}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Credit Information</p>
              <p className="text-sm">Credit Limit: ${(customer.credit_limit || 0).toFixed(2)}</p>
              <p className="text-sm">Current Credit: ${(customer.current_credit || 0).toFixed(2)}</p>
              <p className="text-sm">Allowed Credit Period: {customer.credit_period_days || 0} days</p>
              {/* {customer.active_credit && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-primary">Active Credit</p>
                  <p className="text-sm">Amount: ${customer.active_credit.amount.toFixed(2)}</p>
                  <p className="text-sm">Period: {customer.active_credit.period} days</p>
                  <p className="text-sm">Start: {new Date(customer.active_credit.start_date).toLocaleDateString()}</p>
                  <p className="text-sm">Due: {new Date(customer.active_credit.end_date).toLocaleDateString()}</p>
                </div>
              )} */}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
} 