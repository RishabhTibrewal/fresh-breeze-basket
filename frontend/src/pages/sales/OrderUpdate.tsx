import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';
import { ordersService, Order } from '@/api/orders';
import apiClient from '@/lib/apiClient';
import { creditPeriodService } from '@/api/creditPeriod';
import { customerService, CustomerDetails } from '@/api/customer';

// Extended schema for order update with payment fields
const orderUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'], {
    required_error: "Status is required",
  }),
  tracking_number: z.string().optional(),
  estimated_delivery: z.string().optional(),
  notes: z.string().optional(),
  payment_status: z.enum(['pending', 'full_payment', 'partial_payment', 'full_credit', '']),
  payment_method: z.enum(['cash', 'card', 'cheque', '']).optional(),
  partial_payment_amount: z.number().optional(),
});

// Define a specific type for payment status to help with type checking
type PaymentStatusType = z.infer<typeof orderUpdateSchema.shape.payment_status>;

type OrderUpdateFormValues = z.infer<typeof orderUpdateSchema>;

export default function OrderUpdate() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalPaymentStatus, setOriginalPaymentStatus] = useState<PaymentStatusType>('');

  // Fetch existing order data
  const { data: order, isLoading: orderLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersService.getById(orderId!),
    enabled: !!orderId,
  });

  // Get credit period data
  const { data: creditPeriod, isLoading: creditPeriodLoading } = useQuery({
    queryKey: ['creditPeriod', orderId],
    queryFn: () => creditPeriodService.getCreditPeriodByOrderId(orderId!),
    enabled: !!orderId,
  });

  // Fetch customer data
  const { data: customer, isLoading: customerLoading, isError: customerError } = useQuery<CustomerDetails | null >({
    queryKey: ['customerDetails', creditPeriod?.customer_id],
    queryFn: async () => {
      if (!creditPeriod?.customer_id) return null;
      try {
        const response = await customerService.getCustomerById(creditPeriod.customer_id);
        return response.data || response;
      } catch (err) {
        console.error("Failed to fetch customer:", err);
        toast.error("Failed to load customer details for credit check.");
        return null;
      }
    },
    enabled: !!creditPeriod?.customer_id,
  });

  // Set up form with zodResolver
  const form = useForm<OrderUpdateFormValues>({
    resolver: zodResolver(orderUpdateSchema),
    defaultValues: {
      status: 'pending',
      tracking_number: '',
      estimated_delivery: '',
      notes: '',
      payment_status: 'pending',
      payment_method: '',
      partial_payment_amount: undefined,
    },
  });

  // Get current payment status from form
  const currentPaymentStatus = form.watch('payment_status');
  const paymentMethodValue = form.watch('payment_method');

  // Update form values when order data is loaded
  useEffect(() => {
    if (order) {
      const backendPaymentStatus = order.payment_status; // string | undefined
      let effectiveInitialStatus: PaymentStatusType;

      if (backendPaymentStatus === null || backendPaymentStatus === undefined) {
        effectiveInitialStatus = ''; // Default for null/undefined
      } else if (orderUpdateSchema.shape.payment_status.options.includes(backendPaymentStatus as PaymentStatusType)) {
        // If it's a known enum value (e.g., 'pending', 'full_payment', 'partial_payment', 'full_credit', '')
        effectiveInitialStatus = backendPaymentStatus as PaymentStatusType;
      } else {
        // If it's some other string not in the enum, also default to '' (pending-like state)
        effectiveInitialStatus = '';
      }
      
      setOriginalPaymentStatus(effectiveInitialStatus);
      
      form.reset({
        status: order.status || 'pending',
        tracking_number: order.tracking_number || '',
        estimated_delivery: order.estimated_delivery || '',
        notes: order.notes || '',
        payment_status: effectiveInitialStatus, // Use the derived effectiveInitialStatus
        payment_method: (order.payment_method as any) || '',
        partial_payment_amount: undefined,
      });
    }
  }, [order, form]);

  // Mutation for updating order and payment details
  const updateOrderMutation = useMutation({
    mutationFn: async (data: OrderUpdateFormValues) => {
      // Create a complete update data object that includes all fields
      const updateData: any = { 
        status: data.status
      };
      
      // Add optional fields if they have values
      if (data.tracking_number) updateData.tracking_number = data.tracking_number;
      if (data.estimated_delivery) updateData.estimated_delivery = data.estimated_delivery;
      if (data.notes) updateData.notes = data.notes;
      
      // Add payment details if payment status is changing
      if (data.payment_status !== originalPaymentStatus) {
        console.log('Updating payment status:', {
          from: originalPaymentStatus,
          to: data.payment_status
        });
        
        updateData.payment_status = data.payment_status === '' ? 'pending' : data.payment_status;
        
        if (data.payment_method) {
          updateData.payment_method = data.payment_method;
        }
        
        // Add partial payment amount if payment status is partial_payment
        if (data.payment_status === 'partial_payment' && data.partial_payment_amount) {
          updateData.partial_payment_amount = parseFloat(data.partial_payment_amount.toString());
        }
      }
      
      console.log('Sending update with data:', updateData);
      
      // Make a single API call to update everything - use the regular orders API that only needs authentication
      const response = await apiClient.put(`/orders/${orderId}/status`, updateData);
      const updatedOrder = response.data.data || response.data;
      
      // Log some info about what happened with payment status
      if (
        (data.payment_status === 'full_payment' || data.payment_status === 'partial_payment') && 
        creditPeriod && 
        creditPeriod.id &&
        data.payment_status !== originalPaymentStatus
      ) {
        console.log('=== PAYMENT STATUS UPDATED ===');
        console.log('Credit Period ID:', creditPeriod.id);
        console.log('Original Payment Status:', originalPaymentStatus);
        console.log('New Payment Status:', data.payment_status);
        
        // No need to make a separate API call - the backend already handled the credit period update
        // as part of the order status update. This prevents race conditions.
        
        // Just invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['creditPeriod', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
        queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
      }
      
      return updatedOrder;
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['creditPeriod', orderId] });
      
      toast.success('Order updated successfully');
      navigate(`/sales/orders/${orderId}`);
    },
    onError: (error: any) => {
      console.error('Error updating order:', error);
      toast.error(`Failed to update order: ${error.message || 'Unknown error'}`);
      setError(error.message || 'Failed to update order. Please try again.');
    },
  });

  const onSubmit = async (data: OrderUpdateFormValues) => {
    // Prevent any updates if order is cancelled
    if (order.status === 'cancelled') {
      toast.error('Cancelled orders cannot be updated further.');
      return;
    }

    // 1. Payment Status Flow Validation
    if (originalPaymentStatus === 'full_payment' && data.payment_status !== 'full_payment') {
      toast.error('Cannot change payment status once it is set to Full Payment.');
      form.setValue('payment_status', originalPaymentStatus as OrderUpdateFormValues['payment_status']); // Reset if invalid
      return;
    }
    if (originalPaymentStatus === 'partial_payment' && data.payment_status === 'full_credit') {
      toast.error('Cannot change from Partial Payment to Full Credit.');
      form.setValue('payment_status', originalPaymentStatus as OrderUpdateFormValues['payment_status']);
      return;
    }
    // Prevent moving from full_credit to pending
    if (originalPaymentStatus === 'full_credit' && data.payment_status === 'pending') { // Removed redundant originalPaymentStatus !== 'pending'
        toast.error('Cannot change from Full Credit to Pending.');
        form.setValue('payment_status', originalPaymentStatus as OrderUpdateFormValues['payment_status']);
        return;
    }

    // 2. Payment Method Required Validation (already exists, kept for clarity)
    if (
      (data.payment_status === 'full_payment' || data.payment_status === 'partial_payment') && 
      !data.payment_method
    ) {
      toast.error('Payment method is required for Full Payment or Partial Payment.');
      return;
    }

    // 3. Partial Payment Amount Validation
    if (data.payment_status === 'partial_payment' && (!data.partial_payment_amount || data.partial_payment_amount <=0)) {
      toast.error('A valid partial payment amount is required.');
      return;
    }

    // 4. Credit Limit Validation
    if (customer && order && (data.payment_status === 'full_credit' || data.payment_status === 'partial_payment')) {
      let creditBeingExtendedThisOrder = 0;
      if (data.payment_status === 'full_credit') {
        creditBeingExtendedThisOrder = parseFloat(order.total_amount.toString());
      } else if (data.payment_status === 'partial_payment' && data.partial_payment_amount !== undefined) {
        creditBeingExtendedThisOrder = parseFloat(order.total_amount.toString()) - data.partial_payment_amount;
      }

      creditBeingExtendedThisOrder = Math.max(0, creditBeingExtendedThisOrder);

      let originalCreditForThisOrder = 0;
      if (creditPeriod && originalPaymentStatus === 'full_credit') {
        originalCreditForThisOrder = parseFloat(creditPeriod.amount.toString());
      } else if (creditPeriod && originalPaymentStatus === 'partial_payment') {
        // This calculation might be tricky if partial payment was made multiple times.
        // Assuming creditPeriod.amount reflects the total credit given for this order so far.
        // For simplicity, we'll consider the credit period amount tied to the *initial* credit state.
        // A more robust way might be to check previous payment transactions if available.
        // Here, we assume current_credit on customer ALREADY reflects existing credits *excluding this order's original credit IF it was credit*
        // OR it reflects all credits including this one.
        // Let's assume customer.current_credit is the total credit *before* this update.
      }

      const currentCustomerCredit = customer.current_credit || 0;
      const customerCreditLimit = customer.credit_limit || 0;
      
      let netChangeInCreditForThisOrder = 0;

      let newCreditAmountForThisOrder = 0;
      if (data.payment_status === 'full_credit') {
        newCreditAmountForThisOrder = parseFloat(order.total_amount.toString());
      } else if (data.payment_status === 'partial_payment' && data.partial_payment_amount !== undefined) {
        newCreditAmountForThisOrder = Math.max(0, parseFloat(order.total_amount.toString()) - data.partial_payment_amount);
      }

      let previousCreditAmountForThisOrder = 0;
      if (originalPaymentStatus === 'full_credit' && creditPeriod) {
        previousCreditAmountForThisOrder = parseFloat(creditPeriod.amount.toString());
      } else if (originalPaymentStatus === 'partial_payment' && creditPeriod && order) {
        // If original was partial, the creditPeriod.amount might be the initial full credit.
        // It's safer to re-calculate based on known order total and assumed previous payments.
        // This part is complex without full payment history for the order.
        // For now, let's assume creditPeriod.amount for a 'partial_payment' status (if it exists) reflects remaining credit.
        // Or, more simply, assume customer.current_credit is accurate *before* this order's update.
        // Then, the change is newCreditAmountForThisOrder - previousCreditAmountForThisOrder.
        // The customer.current_credit should ideally be sum of all *other* active credits
        // + the credit portion of *this* order in its current state (before update).

        // Simplified: let's assume 'customer.current_credit' does NOT include this order's current credit portion.
        // If it does, the logic is: potentialNewTotalCredit = customer.current_credit - previousCreditAmountForThisOrder + newCreditAmountForThisOrder
      }

      let currentOrderCreditValue = 0;
      if (originalPaymentStatus === 'full_credit') {
        currentOrderCreditValue = parseFloat(order.total_amount.toString());
      } else if (originalPaymentStatus === 'partial_payment' && creditPeriod) {
        currentOrderCreditValue = parseFloat(creditPeriod.amount.toString());
      }

      const existingCreditWithoutThisOrder = (customer.current_credit || 0) - currentOrderCreditValue;
      const projectedTotalCustomerCredit = existingCreditWithoutThisOrder + newCreditAmountForThisOrder;
      
      if (projectedTotalCustomerCredit > customerCreditLimit) {
        toast.error(
          `Operation exceeds customer credit limit. 
          Limit: $${customerCreditLimit.toFixed(2)}, 
          Current (excl. this order's change): $${existingCreditWithoutThisOrder.toFixed(2)}, 
          New for this order: $${newCreditAmountForThisOrder.toFixed(2)},
          Projected Total: $${projectedTotalCustomerCredit.toFixed(2)}`
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      await updateOrderMutation.mutateAsync(data);
    } catch (error) {
      // Error is handled in the mutation callbacks
    } finally {
      setLoading(false);
    }
  };

  if (orderLoading || creditPeriodLoading || (!!creditPeriod?.customer_id && customerLoading)) {
    return <div className="container mx-auto py-8">Loading order and customer details...</div>;
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load order. Please try again or contact support.
          </AlertDescription>
        </Alert>
        <Button 
          className="mt-4"
          onClick={() => navigate('/sales/orders')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    );
  }

  if (!!creditPeriod?.customer_id && customerError) {
    console.warn("Could not load customer details for credit limit checks.");
  }

  return (
    <div className="container mx-auto py-8">
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate(`/sales/orders/${orderId}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Order Details
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Update Order #{(order as any).order_number || `ID: ${order.id}`}</CardTitle>
          <CardDescription>
            Update status, payment information, and notes for this order.
          </CardDescription>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                        disabled={order.status === 'cancelled'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select order status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {order.status === 'cancelled' 
                          ? "Cancelled orders cannot be updated further" 
                          : "Current status of the order"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Payment Status */}
                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Payment Status 
                        {(
                          <span className="ml-1 text-sm font-normal text-muted-foreground">
                            (Current: {
                              (originalPaymentStatus === '' || originalPaymentStatus === 'pending')
                                ? 'Pending' 
                                : originalPaymentStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                            })
                          </span>
                        )}
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        disabled={originalPaymentStatus === 'full_payment'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Full Payment: Always a valid target state (unless original is full_payment, then field is disabled) */}
                          <SelectItem 
                            value="full_payment"
                            // No specific disable here, as it's a final state. Main select disabled if already full_payment.
                          >
                            Full Payment
                          </SelectItem>

                          {/* Partial Payment: */}
                          {/* Allowed from: pending, full_credit, or if already partial_payment (for more payments) */}
                          {/* Disabled if: original is full_payment (main select covers this) */}
                          <SelectItem
                            value="partial_payment"
                            disabled={originalPaymentStatus === 'full_payment'} // Covered by main select disable
                          >
                            Partial Payment
                          </SelectItem>
                          
                          {/* Full Credit: */}
                          {/* Allowed from: pending */}
                          {/* Disabled if: original is partial_payment or full_payment */}
                          <SelectItem 
                            value="full_credit" 
                            disabled={
                              originalPaymentStatus === 'partial_payment' || 
                              originalPaymentStatus === 'full_payment'
                            }
                          >
                            Full Credit
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {originalPaymentStatus === 'full_payment' 
                          ? "Payment status cannot be changed after Full Payment" 
                          : "Select a new payment status for this order"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Payment Method - Only show when payment status is not pending */}
                {(currentPaymentStatus === 'full_payment' || currentPaymentStatus === 'partial_payment') && (
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <Select 
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Method of payment
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Partial Payment Amount - Only show when payment status is partial payment */}
                {currentPaymentStatus === 'partial_payment' && (
                  <FormField
                    control={form.control}
                    name="partial_payment_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partial Payment Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Enter payment amount"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? undefined : value);
                            }}
                            value={field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormDescription>
                          Amount paid in this transaction
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Tracking Number */}
                <FormField
                  control={form.control}
                  name="tracking_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter tracking number" 
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter shipping tracking number if available
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Estimated Delivery */}
                <FormField
                  control={form.control}
                  name="estimated_delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Delivery Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Expected date of delivery
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Order Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any special instructions or notes for this order"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional information about this order
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Credit Information */}
              {creditPeriod && (
                <div className="border rounded-md p-4 bg-muted/50">
                  <h3 className="font-medium mb-2">Credit Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Credit Amount:</div>
                    <div>${parseFloat(creditPeriod.amount.toString()).toFixed(2)}</div>
                    
                    <div className="text-muted-foreground">Credit Period:</div>
                    <div>{creditPeriod.period} days</div>
                    
                    <div className="text-muted-foreground">Due Date:</div>
                    <div>{new Date(creditPeriod.end_date || creditPeriod.due_date).toLocaleDateString()}</div>
                    
                    <div className="text-muted-foreground">Status:</div>
                    <div>
                      {creditPeriod.description === 'Order Cancelled' ? (
                        <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-gray-400 text-white">Cancelled</span>
                      ) : new Date() > new Date(creditPeriod.end_date || creditPeriod.due_date) ? (
                        <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-red-600 text-white">Overdue</span>
                      ) : (
                        <span className="inline-block rounded px-2 py-1 text-xs font-semibold bg-green-600 text-white">Active</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Credit Limit Info */}
              {customer && (
                 <div className="border rounded-md p-4 bg-muted/50 mt-4">
                  <h3 className="font-medium mb-2">Customer Credit Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Credit Limit:</div>
                    <div>${(customer.credit_limit || 0).toFixed(2)}</div>
                    <div className="text-muted-foreground">Current Outstanding Credit:</div>
                    <div>${(customer.current_credit || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              
              {/* Order Summary Information */}
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Order Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Order Date:</div>
                  <div>{new Date(order.created_at).toLocaleDateString()}</div>
                  
                  <div className="text-muted-foreground">Total Amount:</div>
                  <div>${parseFloat(order.total_amount.toString()).toFixed(2)}</div>
                  
                  <div className="text-muted-foreground">Current Payment Method:</div>
                  <div>{order.payment_method || 'Not specified'}</div>
                  
                  <div className="text-muted-foreground">Items:</div>
                  <div>{order.items?.length || 0} items</div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-between border-t p-4">
              <Button 
                variant="outline" 
                type="button"
                onClick={() => navigate(`/sales/orders/${orderId}`)}
              >
                Cancel
              </Button>
              
              <Button 
                type="submit" 
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Order'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
} 