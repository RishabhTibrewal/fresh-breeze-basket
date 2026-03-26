import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  FileCheck, 
  Search, 
  Check, 
  ChevronsUpDown,
  Calculator,
  User,
  FileText
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Textarea } from "@/components/ui/textarea";
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

import apiClient from '@/lib/apiClient';
import { creditNotesService } from '@/api/creditNotes';
import { ordersService } from '@/api/orders';
import { cn } from "@/lib/utils";

const cnFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  order_id: z.string().optional(),
  reason: z.string().min(3, "Reason is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  tax_amount: z.coerce.number().min(0, "Tax amount cannot be negative").default(0),
  total_amount: z.coerce.number().min(0.01, "Total amount must be greater than 0"),
  notes: z.string().optional(),
});

type CNFormValues = z.infer<typeof cnFormSchema>;

export default function CreateCreditNote() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get('customerId');
  const initialOrderId = searchParams.get('orderId');

  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const form = useForm<CNFormValues>({
    resolver: zodResolver(cnFormSchema),
    defaultValues: {
      customer_id: initialCustomerId || "",
      order_id: initialOrderId || "none",
      reason: "Manual Adjustment",
      amount: 0,
      tax_amount: 0,
      total_amount: 0,
      notes: "",
    },
  });

  // Fetch all customers for selection
  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/customer');
        return Array.isArray(response.data) ? response.data : response.data.data || [];
      } catch (error) {
        console.error('Error fetching customers:', error);
        return [];
      }
    },
  });

  const selectedCustomerId = form.watch('customer_id');

  // Fetch customer orders if a customer is selected
  const { data: customerOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders-brief', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      try {
        const response = await apiClient.get(`/customer/${selectedCustomerId}/orders`);
        const orders = Array.isArray(response.data) ? response.data : response.data.data || [];
        return orders.map((o: any) => ({
          id: o.id,
          order_number: o.order_number || `ORD-${o.id.substring(0, 8)}`,
          total_amount: o.total_amount,
          created_at: o.created_at
        }));
      } catch (error) {
        console.error('Error fetching customer orders:', error);
        return [];
      }
    },
    enabled: !!selectedCustomerId,
  });

  // Auto-calculate total amount
  const amount = form.watch('amount');
  const taxAmount = form.watch('tax_amount');

  useEffect(() => {
    const total = (Number(amount) || 0) + (Number(taxAmount) || 0);
    form.setValue('total_amount', Math.round(total * 100) / 100);
  }, [amount, taxAmount, form]);

  const createCNMutation = useMutation({
    mutationFn: (data: CNFormValues) => creditNotesService.createManual({
      customer_id: data.customer_id as string,
      reason: data.reason as string,
      amount: Number(data.amount),
      tax_amount: Number(data.tax_amount),
      total_amount: Number(data.total_amount),
      notes: data.notes,
      order_id: data.order_id === 'none' ? undefined : data.order_id,
    }),
    onSuccess: () => {
      toast.success('Credit Note created successfully');
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      navigate('/sales/credit-notes');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create credit note');
    },
  });

  const onSubmit = (values: CNFormValues) => {
    createCNMutation.mutate(values);
  };

  const selectedCustomer = allCustomers.find((c: any) => c.id === selectedCustomerId);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-bold tracking-tight">Create Manual Credit Note</h1>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
                <CardDescription>Select the customer to issue credit to.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Customer</FormLabel>
                      <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={!!initialCustomerId}
                            >
                              {field.value
                                ? allCustomers.find((c: any) => c.id === field.value)?.name
                                : "Select customer..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search customer..." 
                              value={customerSearchQuery}
                              onValueChange={setCustomerSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No customer found.</CommandEmpty>
                              <CommandGroup>
                                {allCustomers
                                  .filter((cust: any) => 
                                    cust.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                    cust.phone?.includes(customerSearchQuery)
                                  )
                                  .slice(0, 100)
                                  .map((cust: any) => (
                                    <CommandItem
                                      key={cust.id}
                                      value={cust.name}
                                      onSelect={() => {
                                        form.setValue("customer_id", cust.id);
                                        form.setValue("order_id", "none"); // Reset order when customer changes
                                        setCustomerSearchOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          cust.id === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{cust.name}</span>
                                        {cust.phone && <span className="text-xs text-muted-foreground">{cust.phone}</span>}
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedCustomerId && (
                  <FormField
                    control={form.control}
                    name="order_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link to Order (Optional)</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={ordersLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={ordersLoading ? "Loading orders..." : "Select an order..."} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None / Manual Only</SelectItem>
                            {customerOrders.map((order: any) => (
                              <SelectItem key={order.id} value={order.id}>
                                {order.order_number} (₹{order.total_amount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Optionally link this credit note to a specific order.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* CN Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Financial Details
                </CardTitle>
                <CardDescription>Enter the credit amount and reason.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Returned goods, Price adjustment" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (Net)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                            <Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                            <Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Credit Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">₹</span>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="pl-7 bg-muted font-bold text-lg h-12" 
                            disabled 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Calculated as Amount + Tax</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        placeholder="Internal notes or description..." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-3 bg-muted/50 p-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(-1)}
                disabled={createCNMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={createCNMutation.isPending}
              >
                {createCNMutation.isPending ? "Creating..." : "Create Credit Note"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
