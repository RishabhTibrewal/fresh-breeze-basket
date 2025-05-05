import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { 
  ShoppingBag, 
  PackageCheck, 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  Timer
} from "lucide-react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";

import { ordersService, Order } from "@/api/orders";

// Status badge components
const StatusBadge = React.memo(({ status }: { status: Order['status'] }) => {
  const statusConfig = {
    pending: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
    processing: { color: "bg-blue-100 text-blue-800", icon: <PackageCheck className="w-3 h-3" /> },
    shipped: { color: "bg-purple-100 text-purple-800", icon: <Truck className="w-3 h-3" /> },
    delivered: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { color: "bg-red-100 text-red-800", icon: <XCircle className="w-3 h-3" /> },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      <span className="capitalize">{status}</span>
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// Timer component to show remaining time for order cancellation
const CancellationTimer = React.memo(({ order }: { order: Order }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const orderDate = new Date(order.created_at);
      const currentTime = new Date();
      const timeDifferenceMs = currentTime.getTime() - orderDate.getTime();
      const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
      
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
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center">
          <Timer className="h-3 w-3 mr-1" />
          Time to cancel:
        </span>
        <span className="font-medium">{formattedTime}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
});
CancellationTimer.displayName = 'CancellationTimer';

// Memoize the order card component to prevent re-renders when other orders' timers update
const OrderCard = React.memo(({ 
  order, 
  onCancelOrder 
}: { 
  order: Order, 
  onCancelOrder: (order: Order) => void 
}) => {
  const canBeCancelled = ordersService.canBeCancelled(order);
  
  return (
    <Card key={order.id} className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Order #{order.id.substring(0, 8)}</CardTitle>
            <CardDescription>
              Placed on {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
            </CardDescription>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Items:</div>
            <div className="text-sm text-muted-foreground">
              {order.items && order.items.length > 0 
                ? `${order.items.length} item${order.items.length > 1 ? 's' : ''}`
                : 'No items found'}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Total:</div>
            <div className="text-sm">AED {order.total_amount.toFixed(2)}</div>
          </div>
          
          {canBeCancelled && (
            <CancellationTimer order={order} />
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-1 flex justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/account/orders/${order.id}`}>
            View Details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
        
        {canBeCancelled && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onCancelOrder(order)}
          >
            Cancel Order
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});
OrderCard.displayName = 'OrderCard';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // State to trigger re-render for timer updates
  const [tick, setTick] = useState(0);

  // Set up a ticker to update timers - increase interval to reduce updates
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 30000); // Update every 30 seconds instead of 10
    
    return () => clearInterval(timer);
  }, []);

  // Fetch orders
  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ["my-orders", tick],
    queryFn: async () => {
      console.log("Fetching orders...");
      const orders = await ordersService.getMyOrders();
      console.log("Fetched orders:", orders);
      
      // Log details of each order to better understand the structure
      if (orders && orders.length > 0) {
        console.log("First order structure:", {
          id: orders[0].id,
          status: orders[0].status,
          totalAmount: orders[0].total_amount,
          items: orders[0].items,
          createdAt: orders[0].created_at,
          raw: orders[0] // Log the raw object to see all properties
        });
        
        // Log item structure if available
        if (orders[0].items && orders[0].items.length > 0) {
          console.log("First order's first item structure:", orders[0].items[0]);
        }
      }
      
      return orders;
    },
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchInterval: 60000, // Increase refresh interval to 60 seconds
  });

  // When orders change, log if empty or present 
  useEffect(() => {
    if (orders) {
      console.log(`Loaded ${orders.length} orders`);
      if (orders.length === 0) {
        console.log("No orders found");
      }
    }
  }, [orders]);

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: ordersService.cancel,
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      setCancelOrderId(null);
      setOrderToCancel(null);
    },
    onError: (error) => {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order. Please try again.");
    }
  });

  // Handler for initiating order cancellation - memoize with useCallback
  const handleCancelOrder = useCallback((order: Order) => {
    setOrderToCancel(order);
    setCancelOrderId(order.id);
  }, []);

  // Handler for confirming order cancellation - memoize with useCallback
  const confirmCancelOrder = useCallback(async () => {
    if (cancelOrderId) {
      await cancelOrderMutation.mutateAsync(cancelOrderId);
    }
  }, [cancelOrderId, cancelOrderMutation]);

  // Memoize sorted orders to prevent unnecessary resorting on every render
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [orders, sortOrder]);

  // Toggle sort order - memoize with useCallback
  const toggleSortOrder = useCallback(() => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  }, [sortOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
        <p className="mb-4">Failed to load your orders. Please try again later.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["my-orders"] })}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">My Orders</h2>
          <Button variant="outline" size="sm" onClick={toggleSortOrder}>
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </div>

        {sortedOrders.length === 0 ? (
          <div className="text-center py-12 border rounded-md bg-muted/20">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-4">
              You haven't placed any orders yet. Start shopping to see your orders here!
            </p>
            <Button asChild>
              <Link to="/shop">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <div>
            {sortedOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onCancelOrder={handleCancelOrder} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrderId(null)}>
              Keep Order
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmCancelOrder}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? (
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
    </>
  );
} 