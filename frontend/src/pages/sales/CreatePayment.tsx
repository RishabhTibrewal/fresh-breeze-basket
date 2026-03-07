import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { paymentsService } from '@/api/payments';
import apiClient from '@/lib/apiClient';
import { formatCurrency } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const paymentFormSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(['cash', 'card', 'cheque', 'bank_transfer', 'neft', 'rtgs', 'upi'], {
    required_error: "Payment method is required",
  }),
  status: z.enum(['pending', 'completed', 'failed']).default('completed'),
  transaction_id: z.string().optional(),
  cheque_no: z.string().optional(),
  payment_date: z.string().optional(),
}).superRefine((data, ctx) => {
  // If payment method is cheque, cheque_no is required
  if (data.payment_method === 'cheque' && !data.cheque_no) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cheque number is required for cheque payments",
      path: ["cheque_no"],
    });
  }
  // If payment method is bank_transfer, neft, rtgs, or upi, transaction_id is required
  if (['bank_transfer', 'neft', 'rtgs', 'upi'].includes(data.payment_method) && !data.transaction_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Transaction ID is required for this payment method",
      path: ["transaction_id"],
    });
  }
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export default function CreatePayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Fetch orders for selection
  const { data: orders = [] } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: async () => {
      const response = await apiClient.get('/orders/sales');
      return response.data;
    },
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      order_id: '',
      amount: 0,
      payment_method: 'cash',
      status: 'completed',
      transaction_id: '',
      cheque_no: '',
      payment_date: '',
    },
  });

  const selectedOrderId = form.watch('order_id');
  const paymentMethod = form.watch('payment_method');
  const selectedOrder = orders.find((o: any) => o.id === selectedOrderId);

  // Fetch payments for selected order to calculate remaining balance
  const { data: orderPayments = [] } = useQuery({
    queryKey: ['orderPayments', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return [];
      const response = await paymentsService.getAll({ order_id: selectedOrderId });
      return response;
    },
    enabled: !!selectedOrderId,
  });

  // Calculate remaining balance
  const orderTotal = selectedOrder?.total_amount || 0;
  const paidAmount = orderPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const remainingBalance = orderTotal - paidAmount;

  // Set default amount to remaining balance when order is selected
  useEffect(() => {
    if (selectedOrder && remainingBalance > 0) {
      form.setValue('amount', remainingBalance);
    }
  }, [selectedOrder, remainingBalance, form]);

  const createPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormValues) => paymentsService.create(data),
    onSuccess: () => {
      toast.success('Payment created successfully');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      navigate('/sales/payments');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create payment');
    },
  });

  const onSubmit = (data: PaymentFormValues) => {
    // Validate amount doesn't exceed remaining balance
    if (data.amount > remainingBalance) {
      toast.error(`Amount cannot exceed remaining balance of ${formatCurrency(remainingBalance)}`);
      return;
    }

    createPaymentMutation.mutate(data);
  };

  const filteredOrders = orders.filter((order: any) => {
    if (orderSearchQuery) {
      const query = orderSearchQuery.toLowerCase();
      return (
        order.order_number?.toLowerCase().includes(query) ||
        order.customer?.name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/sales/payments')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Add Payment</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Record a new payment for an order
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>
                Select an order and enter payment information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Selection */}
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Order</FormLabel>
                    <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? `${selectedOrder?.order_number || 'Order'} - ${formatCurrency(selectedOrder?.total_amount || 0)}`
                              : "Select order..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search orders..."
                            value={orderSearchQuery}
                            onValueChange={setOrderSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No orders found.</CommandEmpty>
                            <CommandGroup>
                              {filteredOrders.map((order: any) => (
                                <CommandItem
                                  key={order.id}
                                  value={`${order.order_number} ${order.customer?.name || ''}`}
                                  onSelect={() => {
                                    field.onChange(order.id);
                                    setOrderSearchOpen(false);
                                    setOrderSearchQuery('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === order.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{order.order_number}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {order.customer?.name} - {formatCurrency(order.total_amount)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Select the order for this payment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Order Summary */}
              {selectedOrder && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Order Total:</span>
                        <div className="font-medium">{formatCurrency(orderTotal)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Paid Amount:</span>
                        <div className="font-medium">{formatCurrency(paidAmount)}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Remaining Balance:</span>
                        <div className="font-medium text-lg">{formatCurrency(remainingBalance)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum: {formatCurrency(remainingBalance)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="neft">NEFT</SelectItem>
                        <SelectItem value="rtgs">RTGS</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional Fields */}
              {paymentMethod === 'cheque' && (
                <>
                  <FormField
                    control={form.control}
                    name="cheque_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cheque Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter cheque number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {['bank_transfer', 'neft', 'rtgs', 'upi'].includes(paymentMethod) && (
                <>
                  <FormField
                    control={form.control}
                    name="transaction_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter transaction ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/sales/payments')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPaymentMutation.isPending}>
              {createPaymentMutation.isPending ? 'Creating...' : 'Create Payment'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

