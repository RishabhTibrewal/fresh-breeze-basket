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
import { Search, ArrowLeft, Plus, Eye, Edit, Calendar, DollarSign, CreditCard } from "lucide-react";
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
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <Button 
        variant="outline" 
        className="mb-3 sm:mb-4 w-full sm:w-auto text-sm sm:text-base"
        onClick={() => navigate('/sales/customers')}
      >
        <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
        Back to Customers
      </Button>
      
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl lg:text-3xl break-words">
                Orders for {customer?.name || 'Customer'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1 break-words">
                Manage orders for this customer
              </CardDescription>
            </div>
            <Button 
              onClick={() => navigate(`/sales/orders/create?customerId=${customerId}`)}
              className="w-full sm:w-auto text-sm sm:text-base flex-shrink-0"
            >
              <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Create New Order
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-8 text-sm sm:text-base h-9 sm:h-10 w-full min-w-0"
              />
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No orders found</div>
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
                          ${parseFloat(order.total_amount.toString()).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {getStatusBadge(order.status)}
                        {getPaymentStatusBadge(order.payment_status)}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs min-w-0">
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
                              ${order.credit_details.amount?.toFixed(2) || parseFloat(order.credit_details.amount.toString()).toFixed(2)}
                            </div>
                            <div className="text-xs">
                              Due: {formatDate(order.credit_details.end_date || (order.credit_details as any).due_date, 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs mt-0.5">
                              {(() => {
                                const isCancelled = order.status === 'cancelled' || order.credit_details.status === 'cancelled';
                                const isOverdue = !isCancelled && new Date() > new Date(order.credit_details.end_date || (order.credit_details as any).due_date);
                                return isCancelled 
                                  ? <span className="font-semibold text-gray-600">Inactive</span>
                                  : isOverdue
                                    ? <span className="font-semibold text-red-600">Overdue</span>
                                    : <span className="font-semibold text-green-600">Active</span>;
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Period: {order.credit_details.period || "N/A"} days
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
                    <TableCell colSpan={7} className="text-center text-sm">Loading...</TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="px-2 py-2 font-medium text-sm">{order.order_number}</TableCell>
                      <TableCell className="px-2 py-2 text-sm">{formatDate(order.created_at)}</TableCell>
                      <TableCell className="px-2 py-2 text-sm font-medium">${parseFloat(order.total_amount.toString()).toFixed(2)}</TableCell>
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
                          (() => {
                            const isCancelled = order.status === 'cancelled' || order.credit_details.status === 'cancelled';
                            const isOverdue = !isCancelled && new Date() > new Date(order.credit_details.end_date || (order.credit_details as any).due_date);
                            
                            return (
                              <div className="text-xs sm:text-sm">
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
        
        {customer && (
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 sm:gap-0 px-3 sm:px-6 py-3 sm:py-6 border-t">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium mb-1">Customer Information</p>
              <p className="text-xs sm:text-sm break-words">Email: {customer.email}</p>
              <p className="text-xs sm:text-sm break-words">Phone: {customer.phone}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium mb-1">Credit Information</p>
              <p className="text-xs sm:text-sm">Credit Limit: ${(customer.credit_limit || 0).toFixed(2)}</p>
              <p className="text-xs sm:text-sm">Current Credit: ${(customer.current_credit || 0).toFixed(2)}</p>
              <p className="text-xs sm:text-sm">Allowed Credit Period: {customer.credit_period_days || 0} days</p>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
} 