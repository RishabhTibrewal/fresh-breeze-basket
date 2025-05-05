import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ordersService, Order } from '@/api/orders';
import { productsService } from '@/api/products';
import { addressApi } from '@/api/addresses';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  Banknote,
  MapPin,
  FileText,
  ShoppingCart
} from 'lucide-react';

export default function AdminOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusValue, setStatusValue] = useState<Order['status'] | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  
  // Fetch order details
  const { 
    data: order, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => {
      const orderData = await ordersService.getById(id!);
      console.log('Order details loaded:', orderData);
      console.log('Shipping address ID:', orderData.shipping_address_id);
      console.log('Billing address ID:', orderData.billing_address_id);
      return orderData;
    }
  });
  
  // Set form values when order data is loaded
  useEffect(() => {
    if (order) {
      setStatusValue(order.status);
      setTrackingNumber(order.tracking_number || '');
      setEstimatedDelivery(order.estimated_delivery || '');
      setNotes(order.notes || '');
    }
  }, [order]);
  
  // Fetch shipping address if order has a shipping_address_id
  const {
    data: shippingAddress,
    isLoading: isLoadingShipping,
    isError: isErrorShipping,
    error: errorShipping
  } = useQuery({
    queryKey: ['shipping-address', order?.shipping_address_id],
    queryFn: async () => {
      console.log('Fetching shipping address with ID:', order?.shipping_address_id);
      const address = await addressApi.getAddressById(order!.shipping_address_id!);
      console.log('Shipping address loaded:', address);
      return address;
    },
    enabled: !!order?.shipping_address_id,
    retry: 1
  });
  
  // Fetch billing address if order has a billing_address_id different from shipping_address_id
  const {
    data: billingAddress,
    isLoading: isLoadingBilling,
    isError: isErrorBilling,
    error: errorBilling
  } = useQuery({
    queryKey: ['billing-address', order?.billing_address_id],
    queryFn: async () => {
      console.log('Fetching billing address with ID:', order?.billing_address_id);
      const address = await addressApi.getAddressById(order!.billing_address_id!);
      console.log('Billing address loaded:', address);
      return address;
    },
    enabled: !!order?.billing_address_id && 
             order?.billing_address_id !== order?.shipping_address_id,
    retry: 1
  });
  
  // Update order status mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (data: { id: string, status: Order['status'], trackingNumber?: string, estimatedDelivery?: string, notes?: string }) => {
      return ordersService.updateStatus(
        data.id, 
        data.status, 
        data.trackingNumber, 
        data.estimatedDelivery, 
        data.notes
      );
    },
    onSuccess: () => {
      toast.success('Order updated successfully');
      setIsUpdating(false);
      queryClient.invalidateQueries({ queryKey: ['admin-order', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update order: ${error.message}`);
      setIsUpdating(false);
    }
  });
  
  // Handle update order
  const handleUpdateOrder = () => {
    if (!statusValue) {
      toast.error('Please select a status');
      return;
    }
    
    setIsUpdating(true);
    updateOrderMutation.mutate({
      id: id!,
      status: statusValue as Order['status'],
      trackingNumber,
      estimatedDelivery,
      notes
    });
  };
  
  // Function to safely format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    try {
      let date;
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else {
        date = new Date(dateString.replace(' ', 'T'));
      }
      
      return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM dd, yyyy, HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string, icon: React.ReactNode }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      processing: { color: 'bg-blue-100 text-blue-800', icon: <Package className="w-3 h-3" /> },
      shipped: { color: 'bg-purple-100 text-purple-800', icon: <Truck className="w-3 h-3" /> },
      delivered: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      cancelled: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span className="capitalize">{status}</span>
      </span>
    );
  };
  
  // Render the shipping address content
  const renderShippingAddress = () => {
    if (isLoadingShipping) {
      return <Spinner className="h-4 w-4 mx-auto" />;
    }
    
    if (isErrorShipping) {
      console.error('Shipping address error:', errorShipping);
      return (
        <div className="text-red-500 text-sm">
          <p>Error loading shipping address.</p>
          <p>ID: {order?.shipping_address_id}</p>
        </div>
      );
    }
    
    if (!order?.shipping_address_id) {
      return <p className="text-muted-foreground">No shipping address available</p>;
    }
    
    // Try to use fetched address first
    if (shippingAddress) {
      return (
        <div className="space-y-1">
          <p>{shippingAddress.address_line1}</p>
          {shippingAddress.address_line2 && (
            <p>{shippingAddress.address_line2}</p>
          )}
          <p>
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
          </p>
          <p>{shippingAddress.country}</p>
        </div>
      );
    }
    
    // Fallback to order.shipping_address if present (from the API)
    if (order.shipping_address) {
      return (
        <div className="space-y-1">
          <p>{order.shipping_address.address_line1}</p>
          {order.shipping_address.address_line2 && (
            <p>{order.shipping_address.address_line2}</p>
          )}
          <p>
            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
          </p>
          <p>{order.shipping_address.country}</p>
        </div>
      );
    }
    
    return <p className="text-muted-foreground">Address ID: {order.shipping_address_id} (data not available)</p>;
  };
  
  // Render the billing address content
  const renderBillingAddress = () => {
    // If billing is same as shipping, display shipping
    if (order?.billing_address_id === order?.shipping_address_id) {
      return (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Same as shipping address</p>
          {renderShippingAddress()}
        </div>
      );
    }
    
    if (isLoadingBilling) {
      return <Spinner className="h-4 w-4 mx-auto" />;
    }
    
    if (isErrorBilling) {
      console.error('Billing address error:', errorBilling);
      return (
        <div className="text-red-500 text-sm">
          <p>Error loading billing address.</p>
          <p>ID: {order?.billing_address_id}</p>
        </div>
      );
    }
    
    if (!order?.billing_address_id) {
      return <p className="text-muted-foreground">No billing address available</p>;
    }
    
    // Try to use fetched address first
    if (billingAddress) {
      return (
        <div className="space-y-1">
          <p>{billingAddress.address_line1}</p>
          {billingAddress.address_line2 && (
            <p>{billingAddress.address_line2}</p>
          )}
          <p>
            {billingAddress.city}, {billingAddress.state} {billingAddress.postal_code}
          </p>
          <p>{billingAddress.country}</p>
        </div>
      );
    }
    
    // Fallback to order.billing_address if present (from the API)
    if (order.billing_address) {
      return (
        <div className="space-y-1">
          <p>{order.billing_address.address_line1}</p>
          {order.billing_address.address_line2 && (
            <p>{order.billing_address.address_line2}</p>
          )}
          <p>
            {order.billing_address.city}, {order.billing_address.state} {order.billing_address.postal_code}
          </p>
          <p>{order.billing_address.country}</p>
        </div>
      );
    }
    
    return <p className="text-muted-foreground">Address ID: {order.billing_address_id} (data not available)</p>;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  
  if (isError || !order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
        <p className="mb-4">{(error as any)?.message || 'Failed to load order details'}</p>
        <Button onClick={() => navigate('/admin/orders')}>Back to Orders</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Order {order.id.split('-')[0] || order.id}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(order.created_at)}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/orders')}>
          Back to Orders
        </Button>
      </div>
      
      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
        </TabsList>
        
        {/* Order Details Tab */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Order ID</p>
                      <p className="font-medium">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p>{getStatusBadge(order.status)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Date Placed</p>
                      <p className="font-medium">{formatDate(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Updated</p>
                      <p className="font-medium">{formatDate(order.updated_at)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Method</p>
                      <p className="font-medium capitalize">{order.payment_method || 'Card'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Status</p>
                      <Badge variant={order.payment_status === 'paid' ? 'default' : 'outline'}>
                        {order.payment_status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                  
                  {order.tracking_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tracking Number</p>
                      <p className="font-medium">{order.tracking_number}</p>
                    </div>
                  )}
                  
                  {order.estimated_delivery && (
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                      <p className="font-medium">{formatDate(order.estimated_delivery)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="font-medium">AED {order.total_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shipping</p>
                    <p className="font-medium">AED 0.00</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax</p>
                    <p className="font-medium">AED 0.00</p>
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-medium text-lg">AED {order.total_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderShippingAddress()}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderBillingAddress()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Order Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Order Items
              </CardTitle>
              <CardDescription>
                Total items: {order.items?.length || 0}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item: any, idx) => (
                      <TableRow key={item.id || idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.products?.image_url && (
                              <div className="h-10 w-10 rounded bg-muted overflow-hidden">
                                <img
                                  src={item.products.image_url}
                                  alt={item.products?.name || 'Product'}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{item.products?.name || `Product ID: ${item.product_id}`}</p>
                              <p className="text-xs text-muted-foreground">{item.product_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>AED {item.unit_price?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          AED {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        No items found in this order
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-end border-t p-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total amount</p>
                <p className="text-xl font-bold">
                  AED {order.total_amount?.toFixed(2) || '0.00'}
                </p>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Customer Info Tab */}
        <TabsContent value="customer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-medium">{order.userId || order.user_id}</p>
                </div>
                {/* Additional customer information would go here if available from the API */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Manage Order Tab */}
        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Manage Order</CardTitle>
              <CardDescription>
                Update order status, tracking information, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Order Status</Label>
                  <Select
                    value={statusValue}
                    onValueChange={(value) => setStatusValue(value as Order['status'])}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="tracking">Tracking Number</Label>
                  <Input
                    id="tracking"
                    placeholder="Enter tracking number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="estimated-delivery">Estimated Delivery Date</Label>
                  <Input
                    id="estimated-delivery"
                    type="date"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    placeholder="Add notes about this order"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-4">
              <Button variant="outline" onClick={() => navigate('/admin/orders')}>
                Cancel
              </Button>
              
              {order.status !== 'cancelled' ? (
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Cancel Order</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this order? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, keep order</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setStatusValue('cancelled');
                            handleUpdateOrder();
                          }}
                        >
                          Yes, cancel order
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <Button 
                    onClick={handleUpdateOrder} 
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Spinner className="h-4 w-4 mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              ) : (
                <Button variant="outline" disabled>
                  Order has been cancelled
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 