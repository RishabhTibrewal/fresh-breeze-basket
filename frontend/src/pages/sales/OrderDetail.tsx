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
import { ArrowLeft, Truck, AlertTriangle, Clipboard, Package, Package2, CreditCard } from "lucide-react";
import { customerService } from '@/api/customer';
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
        const response = await apiClient.get(`/orders/${orderId}`);
        // API will return data with a customer property
        return response.data;
      } catch (error) {
        console.error('Error fetching order:', error);
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

  // Handle error
  useEffect(() => {
    if (isError) {
      toast.error(`Failed to load order: ${(error as Error).message}`);
    }
  }, [isError, error]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiClient.put(`/orders/${orderId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      toast.success(`Order status updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setUpdateStatusOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update order status: ${error.message}`);
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.put(`/orders/${orderId}/cancel`, { reason: cancelReason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Order cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setCancelOrderOpen(false);
    },
    onError: (error: any) => {
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
      case 'paid':
        return <Badge className="bg-green-600">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500">Partially Paid</Badge>;
      case 'credit':
        return <Badge className="bg-blue-500">Credit</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Format payment method
  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'full_payment':
        return 'Full Payment';
      case 'partial_payment':
        return 'Partial Payment';
      case 'full_credit':
        return 'Full Credit';
      default:
        return method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <h3 className="text-lg font-semibold">Order not found</h3>
              <p className="text-muted-foreground mt-2">The order you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main order information */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Order #{order.order_number || order.id.substring(0, 8)}</CardTitle>
                  <CardDescription>
                    Created on {format(new Date(order.created_at), 'MMM d, yyyy, h:mm a')}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(order.status)}
                  {getPaymentStatusBadge(order.payment_status)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Order Items */}
              <div>
                <h3 className="text-lg font-medium mb-3">Order Items</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.order_items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product?.name || `Product ID: ${item.product_id}`}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
                        <TableCell className="text-right font-bold">
                          ${parseFloat(order.total_amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            
              {/* Order Actions */}
              <div>
                <h3 className="text-lg font-medium mb-3">Order Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Update Status Dialog */}
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
                  </Dialog>
                  
                  {/* Cancel Order Dialog */}
                  <Dialog open={cancelOrderOpen} onOpenChange={setCancelOrderOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
                        <AlertTriangle className="h-4 w-4" />
                        Cancel Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Order</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to cancel this order? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input 
                          placeholder="Reason for cancellation" 
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Go Back</Button>
                        </DialogClose>
                        <Button 
                          variant="destructive"
                          onClick={() => cancelOrderMutation.mutate()}
                          disabled={cancelOrderMutation.isPending}
                        >
                          {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* View Credit Dialog */}
                  {(order.payment_method === 'full_credit' || order.payment_method === 'partial_payment') && (
                    <Dialog open={viewCreditOpen} onOpenChange={setViewCreditOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <CreditCard className="h-4 w-4" />
                          View Credit Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Credit Information</DialogTitle>
                          <DialogDescription>
                            Details about the credit associated with this order.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          {order.credit_details ? (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Credit Amount</p>
                                  <p className="font-medium">${parseFloat(order.credit_details.amount).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Credit Period</p>
                                  <p className="font-medium">{order.credit_details.period} days</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Start Date</p>
                                  <p className="font-medium">{format(new Date(order.credit_details.start_date), 'MMM d, yyyy')}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Due Date</p>
                                  <p className="font-medium">{format(new Date(order.credit_details.end_date), 'MMM d, yyyy')}</p>
                                </div>
                              </div>
                              {order.credit_details.description && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Description</p>
                                  <p className="font-medium">{order.credit_details.description}</p>
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
          
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent>
              {order.shipping_address ? (
                <div className="space-y-2">
                  <p>{order.shipping_address.address_line1}</p>
                  {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                  <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</p>
                  <p>{order.shipping_address.country}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No shipping information available.</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Customer and Payment Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              {customer ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Credit Information</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <p className="text-sm">Credit Limit:</p>
                        <p className="text-sm font-medium">${(customer.credit_limit || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-sm">Current Credit:</p>
                        <p className="text-sm font-medium">${(customer.current_credit || 0).toFixed(2)}</p>
                      </div>
                      {customer.active_credit && (
                        <>
                          <Separator className="my-2" />
                          <div className="flex justify-between">
                            <p className="text-sm">Active Credit:</p>
                            <p className="text-sm font-medium">${customer.active_credit.amount.toFixed(2)}</p>
                          </div>
                          <div className="flex justify-between">
                            <p className="text-sm">Due Date:</p>
                            <p className="text-sm font-medium">{format(new Date(customer.active_credit.end_date), 'MMM d, yyyy')}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No customer information available.</p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{formatPaymentMethod(order.payment_method)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <div className="mt-1">{getPaymentStatusBadge(order.payment_status)}</div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">${parseFloat(order.total_amount).toFixed(2)}</p>
                </div>
                
                {order.payment_method === 'partial_payment' && (
                  <div className="rounded-md bg-muted p-4">
                    <div className="flex justify-between mb-2">
                      <p className="text-sm">Amount Paid:</p>
                      <p className="text-sm font-medium">
                        ${(parseFloat(order.total_amount) - (order.credit_details?.amount || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm">Credit Amount:</p>
                      <p className="text-sm font-medium">${(order.credit_details?.amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Order Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {order.notes ? (
                <p>{order.notes}</p>
              ) : (
                <p className="text-muted-foreground">No notes for this order.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 