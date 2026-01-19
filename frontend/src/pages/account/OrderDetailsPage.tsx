import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ordersService, Order } from '@/api/orders';
import { productsService, Product } from '@/api/products';
import { addressApi } from '@/api/addresses';
import { format } from 'date-fns';
import { Truck, MapPin, Timer, AlertTriangle, Loader2 } from 'lucide-react';
import { Address } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Cancellation timer component
const CancellationTimer = React.memo(({ order }: { order: Order }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const orderDate = new Date(order.created_at);
      const currentTime = new Date();
      const timeDifferenceMs = currentTime.getTime() - orderDate.getTime();
      
      // The cancellation window is 5 minutes
      const timeLeftSeconds = Math.max(0, 5 * 60 - timeDifferenceMs / 1000);
      setTimeLeft(Math.round(timeLeftSeconds));
      
      // Calculate percentage for progress bar (0-100)
      const progressPercentage = 100 - (timeLeftSeconds / (5 * 60) * 100);
      setPercentage(Math.min(100, Math.max(0, progressPercentage)));
      
      return timeLeftSeconds > 0;
    };
    
    // Initial calculation
    const hasTimeLeft = calculateTimeLeft();
    
    // Set up interval for countdown
    if (hasTimeLeft) {
      const timerId = setInterval(() => {
        const stillHasTime = calculateTimeLeft();
        if (!stillHasTime) {
          clearInterval(timerId);
        }
      }, 1000);
      
      return () => clearInterval(timerId);
    }
  }, [order.created_at]);
  
  if (timeLeft <= 0) {
    return null;
  }
  
  // Format time remaining as mm:ss
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  return (
    <div className="space-y-2 mt-4 border rounded-lg p-4 bg-yellow-50">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Timer className="h-4 w-4" />
        Order Cancellation Window
      </h3>
      
      <div className="text-sm text-muted-foreground">
        You can cancel this order within 5 minutes of placing it.
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm">
          <span>Time remaining:</span>
          <span className="font-bold">{formattedTime}</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    </div>
  );
});
CancellationTimer.displayName = 'CancellationTimer';

// Memoized OrderItem component
const OrderItem = React.memo(({ 
  item, 
  productDetails 
}: { 
  item: any, 
  productDetails: Record<string, Product> 
}) => {
  const product = productDetails[item.product_id];
  
  return (
    <div className="border-b pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <div className="flex items-center gap-4">
        {product?.image_url ? (
          <Link 
            to={`/products/${item.product_id}`} 
            className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-full object-cover"
            />
          </Link>
        ) : (
          <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400 text-xs">No image</span>
          </div>
        )}
        
        <div className="flex-1">
          <h4 className="font-medium">
            {product ? (
              <Link 
                to={`/products/${item.product_id}`}
                className="hover:text-primary transition-colors"
              >
                {product.name}
              </Link>
            ) : (
              `Product (${item.product_id.substring(0, 8)})`
            )}
          </h4>
          <div className="text-sm text-muted-foreground mt-1">
            Quantity: {item.quantity} × ₹ {item.unit_price.toFixed(2)}
          </div>
        </div>
        
        <div className="text-right">
          <div className="font-medium">
            ₹ {(item.quantity * item.unit_price).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
});
OrderItem.displayName = 'OrderItem';

// Memoized Address component
const AddressDisplay = React.memo(({ address, title }: { address: Address | null, title: string }) => {
  if (!address) return null;
  
  return (
    <div className="space-y-1">
      <div className="font-medium text-sm">{title}</div>
      <div className="text-sm text-muted-foreground">
        <div>{address.address_line1}</div>
        {address.address_line2 && <div>{address.address_line2}</div>}
        <div>
          {address.city}{address.state ? `, ${address.state}` : ''} {address.postal_code || ''}
        </div>
        <div>{address.country}</div>
      </div>
    </div>
  );
});
AddressDisplay.displayName = 'AddressDisplay';

export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [shippingAddress, setShippingAddress] = useState<Address | null>(null);
  const [billingAddress, setBillingAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State to trigger re-render for timer updates - increase the interval
  const [tick, setTick] = useState(0);

  // Set up a ticker to update the timer - only if cancellable
  useEffect(() => {
    if (order && ordersService.canBeCancelled(order)) {
      const timer = setInterval(() => {
        setTick(prev => prev + 1);
      }, 5000); // Update every 5 seconds instead of every second
      
      return () => clearInterval(timer);
    }
  }, [order]);

  // Fetch the order
  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await ordersService.getById(id!);
        console.log("Order data:", data);
        
        // Process the data to match our expected format
        const apiResponse = data as any;
        
        const processedData = {
          ...apiResponse,
          id: apiResponse.id,
          status: apiResponse.status,
          total_amount: apiResponse.total_amount,
          payment_status: apiResponse.payment_status,
          payment_method: apiResponse.payment_method,
          items: apiResponse.order_items || apiResponse.items || [],
          created_at: apiResponse.created_at
        };
        
        setOrder(processedData as Order);
      } catch (err: any) {
        console.error("Error fetching order:", err);
        setError(err.message || 'Failed to load order');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  // Fetch product details for each item
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!order?.items?.length) return;
      
      setIsLoadingProducts(true);
      try {
        const productIds = order.items.map((item: any) => item.product_id).filter(Boolean);
        
        const productDetailsMap: Record<string, Product> = {};
        await Promise.all(
          productIds.map(async (productId) => {
            try {
              const product = await productsService.getById(productId);
              productDetailsMap[productId] = product;
            } catch (err) {
              console.error(`Error fetching product ${productId}:`, err);
            }
          })
        );
        
        setProductDetails(productDetailsMap);
      } catch (err) {
        console.error("Error fetching product details:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    
    fetchProductDetails();
  }, [order?.items]);

  // Fetch addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!order) return;
      
      setIsLoadingAddresses(true);
      try {
        // Try to get addresses from order first
        if (order.shipping_address_id) {
          try {
            const address = await addressApi.getAddressById(order.shipping_address_id);
            setShippingAddress(address);
          } catch (error) {
            console.error("Error fetching shipping address:", error);
          }
        }
        
        if (order.billing_address_id && order.billing_address_id !== order.shipping_address_id) {
          try {
            const address = await addressApi.getAddressById(order.billing_address_id);
            setBillingAddress(address);
          } catch (error) {
            console.error("Error fetching billing address:", error);
          }
        }
      } catch (err) {
        console.error("Error fetching addresses:", err);
      } finally {
        setIsLoadingAddresses(false);
      }
    };
    
    fetchAddresses();
  }, [order]);

  // Cancel order handler
  const handleCancelOrder = useCallback(async () => {
    if (!order || isCancelling) return;
    
    try {
      setIsCancelling(true);
      await ordersService.cancel(order.id);
      setShowCancelDialog(false);
      toast.success("Order cancelled successfully");
      
      // Refresh order data
      const updatedOrder = await ordersService.getById(order.id);
      setOrder(updatedOrder);
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast.error(error.message || "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  }, [order, isCancelling]);

  // Memoize order summary calculations
  const orderSummary = useMemo(() => {
    if (!order) return { subtotal: 0, total: 0, tax: 0 };
    
    const subtotal = order.items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);
    
    // Calculate tax - either use the tax_amount from the API or calculate 5%
    const tax = order.tax_amount || subtotal * 0.05;
    
    return {
      subtotal,
      tax,
      total: order.total_amount
    };
  }, [order]);

  // Memoize the formatted order date
  const formattedOrderDate = useMemo(() => {
    if (!order?.created_at) return 'Unknown date';
    return formatOrderDate(order.created_at);
  }, [order?.created_at]);

  // Determine if order can be cancelled - memoized
  const canBeCancelled = useMemo(() => {
    return order ? ordersService.canBeCancelled(order) : false;
  }, [order, tick]); // Include tick to re-evaluate as time passes

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
        <p className="mb-4">{error}</p>
        <Button onClick={() => navigate('/account/orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
        <p className="mb-4">The order you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button onClick={() => navigate('/account/orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Order Details
        </h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/account/orders')}>
          Back to Orders
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Header */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Order #{order.id.substring(0, 8)}</CardTitle>
              <CardDescription>
                Placed on {formattedOrderDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-medium text-sm">Status</div>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(order.status)}
                    <span className="capitalize">{order.status}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="font-medium text-sm">Payment Method</div>
                  <div className="capitalize">
                    {order.payment_method || 'Card'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="font-medium text-sm">Payment Status</div>
                  <div className="capitalize">
                    {order.payment_status || 'Pending'}
                  </div>
                </div>
                
                {order.tracking_number && (
                  <div className="space-y-1">
                    <div className="font-medium text-sm">Tracking Number</div>
                    <div>{order.tracking_number}</div>
                  </div>
                )}
                
                {order.estimated_delivery && (
                  <div className="space-y-1">
                    <div className="font-medium text-sm">Estimated Delivery</div>
                    <div>{formatDate(order.estimated_delivery)}</div>
                  </div>
                )}
              </div>
              
              {canBeCancelled && (
                <CancellationTimer order={order} />
              )}
            </CardContent>
            {canBeCancelled && (
              <CardFooter className="border-t pt-4">
                <Button 
                  variant="destructive" 
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel Order'
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="py-4 flex justify-center">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : order.items && order.items.length > 0 ? (
                <div>
                  {order.items.map((item: any) => (
                    <OrderItem 
                      key={item.id || item.product_id} 
                      item={item} 
                      productDetails={productDetails} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No items found for this order
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAddresses ? (
                <div className="py-4 flex justify-center">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  <AddressDisplay 
                    address={shippingAddress} 
                    title="Shipping Address" 
                  />
                  
                  {billingAddress && (
                    <AddressDisplay 
                      address={billingAddress} 
                      title="Billing Address" 
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹ {orderSummary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (5%)</span>
                  <span>₹ {orderSummary.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {orderSummary.subtotal >= 100 ? 
                      'Free' : 
                      `₹ ${(orderSummary.total - orderSummary.subtotal - orderSummary.tax).toFixed(2)}`
                    }
                  </span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>₹ {orderSummary.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Order
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to get the appropriate icon for an order status
function getStatusIcon(status: Order['status']) {
  switch (status) {
    case 'processing':
      return <div className="h-2 w-2 rounded-full bg-blue-500 mr-1.5" />;
    case 'shipped':
      return <div className="h-2 w-2 rounded-full bg-purple-500 mr-1.5" />;
    case 'delivered':
      return <div className="h-2 w-2 rounded-full bg-green-500 mr-1.5" />;
    case 'cancelled':
      return <div className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-yellow-500 mr-1.5" />;
  }
}

function formatOrderDate(dateString: string) {
  try {
    // If the string is already in ISO format
    if (dateString.includes('T') || dateString.includes('Z')) {
      return format(new Date(dateString), 'MMMM d, yyyy h:mm a');
    }
    
    // If it's in a database timestamp format (e.g., "2023-01-01 12:00:00")
    if (dateString.includes(' ')) {
      const parts = dateString.split(' ');
      if (parts.length === 2) {
        const datePart = parts[0];
        const timePart = parts[1];
        return format(new Date(`${datePart}T${timePart}`), 'MMMM d, yyyy h:mm a');
      }
    }
    
    // Fallback if none of the above formats match
    const timestamp = Date.parse(dateString);
    if (!isNaN(timestamp)) {
      return format(new Date(timestamp), 'MMMM d, yyyy h:mm a');
    }
    
    return 'Unknown date';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), 'MMMM d, yyyy');
  } catch {
    return dateString;
  }
}