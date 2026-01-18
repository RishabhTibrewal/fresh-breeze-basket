import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { invoicesService } from '@/api/invoices';
import { Printer, Download } from 'lucide-react';
import { ArrowLeft, Truck, AlertTriangle, Clipboard, Package, Package2, CreditCard, ChevronRight, Edit } from "lucide-react";
import { customerService } from '@/api/customer';
import { creditPeriodService } from '@/api/creditPeriod';
import { warehousesService } from '@/api/warehouses';
import apiClient from '@/lib/apiClient';

// Order detail component
export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Modals state
  const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const [viewCreditOpen, setViewCreditOpen] = useState(false);
  
  // Form state
  const [newStatus, setNewStatus] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  
  // Get warehouses for displaying warehouse info
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Get order details
  const { 
    data: order, 
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      try {
        console.log('Fetching order details for ID:', orderId);
        console.log('Current user role:', localStorage.getItem('userRole'));
        console.log('API URL to fetch order:', `/orders/${orderId}`);
        
        // First try getting the order directly
        try {
          const response = await apiClient.get(`/orders/${orderId}`);
          console.log('Order details response:', response.data);
          return response.data;
        } catch (directError) {
          console.error('Direct order fetch failed:', directError);
          
          // If direct fetch fails, try customer orders endpoint
          const customerId = localStorage.getItem('currentCustomerId');
          if (customerId) {
            console.log('Attempting to find order in customer orders:', customerId);
            const customerOrdersResponse = await apiClient.get(`/customer/${customerId}/orders`);
            console.log('Customer orders response:', customerOrdersResponse.data);
            
            // Find the specific order
            const foundOrder = customerOrdersResponse.data.find(
              (order: any) => order.id === orderId
            );
            
            if (foundOrder) {
              console.log('Found order in customer orders:', foundOrder);
              return foundOrder;
            }
          }
          
          // If we get here, rethrow the original error
          throw directError;
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
        if ((error as any).response) {
          console.error('Error status:', (error as any).response.status);
          console.error('Error data:', (error as any).response.data);
        }
        throw error;
      }
    },
    enabled: !!orderId,
  });
  
  // Get customer details if order has a customer
  const { data: customer } = useQuery({
    queryKey: ['customer', order?.customer?.id],
    queryFn: () => customerService.getCustomerById(order?.customer?.id),
    enabled: !!order?.customer?.id,
  });

  // Get credit period details from credit_periods table using the order ID
  // Only fetch if order has credit payment method (full_credit or partial_payment)
  const { 
    data: creditPeriodData,
    isLoading: isLoadingCreditPeriod 
  } = useQuery({
    queryKey: ['creditPeriod', orderId],
    queryFn: () => creditPeriodService.getCreditPeriodByOrderId(orderId!),
    enabled: !!orderId && !!order && (
      order.payment_status === 'full_credit' || 
      order.payment_status === 'partial_payment' || 
      order.payment_status === 'partial'
    ),
  });

  // Log order data when it changes
  useEffect(() => {
    if (order) {
      console.log('Order details updated:', {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total_amount: order.total_amount,
        credit_details: order.credit_details
      });
    }
  }, [order]);

  // Log customer data when it changes
  useEffect(() => {
    if (customer) {
      console.log('Customer details updated:', {
        id: customer.id,
        name: customer.name,
        credit_limit: customer.credit_limit,
        current_credit: customer.current_credit,
        active_credit: customer.active_credit
      });
    }
  }, [customer]);

  // Log credit period data from the table
  useEffect(() => {
    if (creditPeriodData) {
      console.log('Credit period data from credit_periods table:', creditPeriodData);
    }
  }, [creditPeriodData]);

  // Handle error
  useEffect(() => {
    if (isError) {
      console.error('Order detail page error:', error);
      toast.error(`Failed to load order: ${(error as Error).message}`);
    }
  }, [isError, error]);
  
  // Get credit details with priority from creditPeriodData, falling back to order.credit_details
  const creditDetails = creditPeriodData || order?.credit_details || null;

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      console.log('Updating order status:', { orderId, newStatus: status });
      const response = await apiClient.put(`/orders/${orderId}/status`, { status });
      console.log('Status update response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      console.log('Order status updated successfully');
      toast.success(`Order status updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setUpdateStatusOpen(false);
    },
    onError: (error: any) => {
      console.error('Failed to update order status:', error);
      toast.error(`Failed to update order status: ${error.message}`);
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      console.log('Cancelling order:', { orderId, reason: cancelReason });
      const response = await apiClient.put(`/orders/${orderId}/cancel`, { reason: cancelReason });
      console.log('Cancel order response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      console.log('Order cancelled successfully');
      toast.success('Order cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setCancelOrderOpen(false);
    },
    onError: (error: any) => {
      console.error('Failed to cancel order:', error);
      toast.error(`Failed to cancel order: ${error.message}`);
    },
  });

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
      case 'partial':
        return <Badge className="bg-yellow-500">Partial Payment</Badge>;
      case 'full_credit':
        return <Badge className="bg-blue-500">Full Credit</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Format payment status for display
  const formatPaymentStatus = (status: string) => {
    switch (status) {
      case 'full_payment':
        return 'Full Payment';
      case 'partial_payment':
      case 'partial':
        return 'Partial Payment';
      case 'full_credit':
        return 'Full Credit';
      case 'pending':
        return 'Pending Payment';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };
  
  // Format payment method
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
  
  // Helper function to format dates
  const formatDate = (dateStr: string | undefined | null, formatStr: string = 'MMM d, yyyy') => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), formatStr);
    } catch (error) {
      console.error('Date format error:', error);
      return 'Invalid Date';
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  // If order not found
  if (!order) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <Card>
          <CardContent className="pt-6 px-3 sm:px-6">
            <div className="text-center py-8 sm:py-10">
              <h3 className="text-base sm:text-lg font-semibold">Order not found</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">The order you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button onClick={() => navigate(-1)} className="mt-4 w-full sm:w-auto text-sm sm:text-base">
                <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden overflow-y-visible px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <Button 
        variant="outline" 
        className="mb-3 sm:mb-4 w-full sm:w-auto text-sm sm:text-base"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
        Back
      </Button>
      
      <div className="grid gap-3 sm:gap-6 lg:grid-cols-3 w-full min-w-0 max-w-full">
        {/* Main order information */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-6 min-w-0 w-full max-w-full">
          <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg lg:text-xl break-words">
                    Order #{order.order_number || order.id.substring(0, 8)}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1 break-words">
                    Created on {format(new Date(order.created_at), 'MMM d, yyyy, h:mm a')}
                  </CardDescription>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap flex-shrink-0">
                  {getStatusBadge(order.status)}
                  {getPaymentStatusBadge(order.payment_status)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-3 sm:space-y-6">
              {/* Order Items */}
              <div className="min-w-0 w-full">
                <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3">Order Items</h3>
                <div className="rounded-md border w-full min-w-0 max-w-full overflow-x-auto">
                  <Table className="w-full min-w-[300px] sm:min-w-[400px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2 py-2 min-w-[120px] sm:min-w-[150px]">Product</TableHead>
                        <TableHead className="text-right px-2 py-2 w-16 sm:w-20">Qty</TableHead>
                        <TableHead className="px-2 py-2 w-24 sm:w-32 hidden sm:table-cell">Warehouse</TableHead>
                        <TableHead className="text-right px-2 py-2 w-20 sm:w-24">Price</TableHead>
                        <TableHead className="text-right px-2 py-2 w-24 sm:w-28">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.order_items?.map((item: any) => {
                        const warehouse = warehouses.find(w => w.id === item.warehouse_id);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="px-2 py-2 font-medium text-xs sm:text-sm min-w-0 max-w-[150px] sm:max-w-[200px]">
                              <div className="truncate" title={item.product?.name || `Product ID: ${item.product_id}`}>
                              {item.product?.name || `Product ID: ${item.product_id}`}
                              </div>
                              {item.warehouse_id && (
                                <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                                  {warehouse ? `${warehouse.code} - ${warehouse.name}` : 'Warehouse N/A'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right px-2 py-2 text-xs sm:text-sm">{item.quantity}</TableCell>
                            <TableCell className="px-2 py-2 text-xs sm:text-sm hidden sm:table-cell">
                              {warehouse ? (
                                <div className="text-xs">
                                  <div className="font-medium">{warehouse.code}</div>
                                  <div className="text-muted-foreground">{warehouse.name}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right px-2 py-2 text-xs sm:text-sm">${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right px-2 py-2 text-xs sm:text-sm font-medium">${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium px-2 py-2 text-xs sm:text-sm">Total</TableCell>
                        <TableCell className="text-right font-bold px-2 py-2 text-xs sm:text-sm md:text-base">
                          ${parseFloat(order.total_amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            
              {/* Order Actions */}
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3">Order Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Update Order Button */}
                  <Button
                    variant="outline" 
                    className="gap-2 text-xs sm:text-sm h-9 sm:h-10"
                    onClick={() => navigate(`/sales/orders/${orderId}/edit`)}
                  >
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Update Order
                  </Button>
                  
                  {/* Print Invoice Button */}
                  <Button
                    variant="outline"
                    className="gap-2 text-xs sm:text-sm h-9 sm:h-10"
                    onClick={async () => {
                      try {
                        const invoiceUrl = `${import.meta.env.VITE_API_URL || ''}/api/invoices/pos/${orderId}`;
                        window.open(invoiceUrl, '_blank');
                      } catch (error) {
                        toast.error('Failed to open invoice');
                      }
                    }}
                  >
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Print Invoice
                  </Button>
                  
                  {/* Download Bill Button */}
                  <Button
                    variant="outline"
                    className="gap-2 text-xs sm:text-sm h-9 sm:h-10"
                    onClick={async () => {
                      try {
                        await invoicesService.downloadCustomerBill(orderId!);
                      } catch (error) {
                        toast.error('Failed to download bill');
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Download Bill
                  </Button>
                  
                  {/* Update Status Dialog
                  <Dialog open={updateStatusOpen} onOpenChange={setUpdateStatusOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Package2 className="h-4 w-4" />
                        Update Status
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Order Status</DialogTitle>
                        <DialogDescription>
                          Change the current status of this order.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Select 
                          value={newStatus} 
                          onValueChange={setNewStatus}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select new status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button 
                          onClick={() => updateStatusMutation.mutate(newStatus)}
                          disabled={!newStatus || updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog> */}
                  
                  {/* Cancel Order Dialog */}
                  <Dialog open={cancelOrderOpen} onOpenChange={setCancelOrderOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/10 text-xs sm:text-sm h-9 sm:h-10">
                        <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Cancel Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">Cancel Order</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                          Are you sure you want to cancel this order? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-3 sm:py-4">
                        <Input 
                          placeholder="Reason for cancellation" 
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <DialogFooter className="flex-col sm:flex-row gap-2">
                        <DialogClose asChild>
                          <Button variant="outline" className="w-full sm:w-auto text-sm">Go Back</Button>
                        </DialogClose>
                        <Button 
                          variant="destructive"
                          onClick={() => cancelOrderMutation.mutate()}
                          disabled={cancelOrderMutation.isPending}
                          className="w-full sm:w-auto text-sm"
                        >
                          {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* View Credit Dialog */}
                  {creditDetails && (
                    <Dialog open={viewCreditOpen} onOpenChange={setViewCreditOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 text-xs sm:text-sm h-9 sm:h-10">
                          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          View Credit Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Credit Information</DialogTitle>
                          <DialogDescription>
                            Details about the credit associated with this order.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          {creditDetails ? (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Credit Amount</p>
                                  <p className="font-medium">${parseFloat(creditDetails.amount.toString()).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Credit Period</p>
                                  <p className="font-medium">{creditDetails.period || Math.ceil((new Date(creditDetails.due_date || creditDetails.end_date).getTime() - new Date(creditDetails.start_date).getTime()) / (1000 * 60 * 60 * 24))} days</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Start Date</p>
                                  <p className="font-medium">{format(new Date(creditDetails.start_date), 'MMM d, yyyy')}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Due Date</p>
                                  <p className="font-medium">{format(new Date(creditDetails.due_date || creditDetails.end_date), 'MMM d, yyyy')}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Status</p>
                                  <p className="font-medium">
                                    {creditDetails.description === 'Order Cancelled' ? (
                                      <Badge variant="outline" className="bg-gray-400 text-white">Cancelled</Badge>
                                    ) : new Date() > new Date(creditDetails.due_date || creditDetails.end_date) ? (
                                      <Badge variant="destructive">Overdue</Badge>
                                    ) : (
                                      <Badge className="bg-green-600">Active</Badge>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                                  <p className="font-medium">
                                    {new Date() > new Date(creditDetails.due_date || creditDetails.end_date) 
                                      ? <span className="text-red-600">Overdue</span>
                                      : <span className="text-blue-600">
                                          {Math.ceil((new Date(creditDetails.due_date || creditDetails.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                                        </span>
                                    }
                                  </p>
                                </div>
                              </div>
                              {creditDetails.interest_rate && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Interest Rate</p>
                                  <p className="font-medium">{creditDetails.interest_rate}%</p>
                                </div>
                              )}
                              {creditDetails.description && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Description</p>
                                  <p className="font-medium">{creditDetails.description}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p>No credit details available for this order.</p>
                          )}
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button>Close</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {order.shipping_address ? (
                <div className="space-y-1.5 sm:space-y-2 text-sm sm:text-base break-words">
                  <p>{order.shipping_address.address_line1}</p>
                  {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                  <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</p>
                  <p>{order.shipping_address.country}</p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">No shipping information available.</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Customer and Payment Information */}
        <div className="space-y-3 sm:space-y-6 min-w-0 w-full">
          <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {customer ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm sm:text-base break-words">{customer.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">{customer.email}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">{customer.phone}</p>
                  </div>
                  
                  <Separator />
                  
                  <div className="min-w-0">
                    <h3 className="font-medium mb-2 text-sm sm:text-base">Credit Information</h3>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <p className="text-muted-foreground">Credit Limit:</p>
                        <p className="font-medium">${(customer.credit_limit || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <p className="text-muted-foreground">Current Credit:</p>
                        <p className="font-medium">${(customer.current_credit || 0).toFixed(2)}</p>
                      </div>
                      {customer.active_credit && (
                        <>
                          <Separator className="my-2" />
                          <div className="flex justify-between text-xs sm:text-sm">
                            <p className="text-muted-foreground">Active Credit:</p>
                            <p className="font-medium">${customer.active_credit.amount.toFixed(2)}</p>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <p className="text-muted-foreground">Due Date:</p>
                            <p className="font-medium break-words">{format(new Date(customer.active_credit.end_date), 'MMM d, yyyy')}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">No customer information available.</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Payment Type</p>
                    <p className="font-medium text-sm sm:text-base break-words">{formatPaymentStatus(order.payment_status)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Payment Status</p>
                    <div className="mt-1">{getPaymentStatusBadge(order.payment_status)}</div>
                  </div>
                </div>
                
                {(order.payment_status === 'full_payment' || order.payment_status === 'partial_payment' || order.payment_status === 'partial') && order.payment_method && (
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium text-sm sm:text-base break-words">{formatPaymentMethod(order.payment_method)}</p>
                  </div>
                )}
                
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-base sm:text-lg">${parseFloat(order.total_amount).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Credit Period Information */}
          {creditDetails && (
            <Card className="mt-3 sm:mt-4 w-full min-w-0 max-w-full overflow-x-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Credit Information</CardTitle>
                {creditPeriodData && (
                  <CardDescription className="text-xs sm:text-sm">
                    Credit Period ID: {creditPeriodData.id.substring(0, 8)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Credit Amount</p>
                      <p className="font-medium text-sm sm:text-base">${parseFloat(creditDetails.amount.toString()).toFixed(2)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Credit Status</p>
                      <p className="font-medium text-sm sm:text-base">
                        {creditDetails.description === 'Order Cancelled' ? (
                          <Badge variant="outline" className="bg-gray-400 text-white text-xs">Cancelled</Badge>
                        ) : new Date() > new Date(creditDetails.due_date || creditDetails.end_date) ? (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-xs">Active</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium text-sm sm:text-base break-words">
                        {format(new Date(creditDetails.start_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium text-sm sm:text-base break-words">
                        {format(new Date(creditDetails.due_date || creditDetails.end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Period</p>
                      <p className="font-medium text-sm sm:text-base break-words">
                        {creditDetails.period 
                          ? `${creditDetails.period} days`
                          : Math.ceil((new Date(creditDetails.due_date || creditDetails.end_date).getTime() - new Date(creditDetails.start_date).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                        }
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Days Remaining</p>
                      <p className="font-medium text-sm sm:text-base">
                        {new Date() > new Date(creditDetails.due_date || creditDetails.end_date) 
                          ? <span className="text-red-600">Overdue</span>
                          : <span className="text-blue-600">
                              {Math.ceil((new Date(creditDetails.due_date || creditDetails.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                            </span>
                        }
                      </p>
                    </div>
                  </div>

                  {creditDetails.interest_rate && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Interest Rate</p>
                      <p className="font-medium text-sm sm:text-base">{creditDetails.interest_rate}%</p>
                    </div>
                  )}
                  
                  {creditDetails.description && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Description</p>
                      <p className="font-medium text-sm sm:text-base break-words">{creditDetails.description}</p>
                    </div>
                  )}

                  {creditDetails.status && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Payment Status</p>
                      <p className="font-medium text-sm sm:text-base">
                        {creditDetails.status === 'paid' 
                          ? <Badge className="bg-green-600 text-xs">Paid</Badge>
                          : creditDetails.status === 'partial' 
                            ? <Badge className="bg-yellow-500 text-xs">Partially Paid</Badge>
                            : <Badge variant="outline" className="text-xs">Unpaid</Badge>
                        }
                      </p>
                    </div>
                  )}
                  
                  {/* Display credit_periods table specific information */}
                  {creditPeriodData && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Created At</p>
                      <p className="font-medium text-sm sm:text-base break-words">{format(new Date(creditPeriodData.created_at), 'MMM d, yyyy, h:mm a')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Order Notes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {order.notes ? (
                <p className="text-sm sm:text-base break-words whitespace-pre-line">{order.notes}</p>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">No notes for this order.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}