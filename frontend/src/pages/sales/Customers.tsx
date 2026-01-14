import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Search, Eye, Edit, ShoppingCart, ClipboardList, Mail, Phone, Calendar, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import apiClient from '@/lib/apiClient';
import { customerService, CustomerFormValues as ImportedCustomerFormValues } from '@/api/customer';
import { useNavigate } from 'react-router-dom';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  trn_number?: string;
  credit_period_days?: number;
  credit_limit?: number;
  current_credit?: number;
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
  user_id?: string;
  active_credit?: {
    amount: number;
    period: number;
    start_date: string;
    end_date: string;
  };
  credit_periods?: {
    id: string;
    amount: number;
    period: number;
    type: string;
    created_at: string;
  }[];
}

const customerFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").nullable().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").nullable().optional(),
  trn_number: z.string().nullable().optional(),
  credit_period_days: z.number().min(0, "Credit period days must be 0 or greater").nullable().optional(),
  credit_limit: z.number().min(0, "Credit limit must be 0 or greater").nullable().optional(),
  current_credit: z.number().min(0, "Current credit must be 0 or greater").nullable().optional(),
});

// Use the imported CustomerFormValues type
type CustomerFormValues = ImportedCustomerFormValues;

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  // Edit customer form
  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  // Effect to populate edit form when selected customer changes
  useEffect(() => {
    if (selectedCustomer && isEditModalOpen) {
      editForm.reset({
        name: selectedCustomer.name,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        trn_number: selectedCustomer.trn_number || "",
        credit_period_days: selectedCustomer.credit_period_days || 0,
        credit_limit: selectedCustomer.credit_limit || 0,
        current_credit: selectedCustomer.current_credit || 0
      });
    }
  }, [selectedCustomer, isEditModalOpen, editForm]);

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get('/customer');
      return response.data;
    },
  });

  // Add customer mutation
  const addCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      if (!data.email) {
        throw new Error('Email is required for user registration');
      }
      // Ensure name is always provided
      if (!data.name) {
        throw new Error('Name is required');
      }
      console.log('Submitting customer form with data:', data);
      const response = await customerService.createCustomer(data);
      console.log('Full customer creation response:', response);
      
      // Handle the case where a user was created but not a customer
      if (response.user && !response.customer) {
        console.warn('User was created but customer record was not');
        if (response.error) {
          throw new Error(`User created but customer record failed: ${response.error.message}`);
        }
      }
      
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsAddModalOpen(false);
      form.reset();
      
      // Show different message based on what was created
      if (data.customer) {
        toast.success('Customer added successfully with a Supabase user account. Default password is "123456"');
      } else if (data.user) {
        toast.warning('User account created, but customer record could not be created. Please check console for details.');
      }
    },
    onError: (error: any) => {
      console.error('Detailed error:', error);
      toast.error(`Failed to add customer: ${error.message || 'Unknown error'}`);
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormValues & { id: string }) => {
      const { id, ...customerData } = data;
      const response = await apiClient.put(`/customer/${id}`, customerData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsEditModalOpen(false);
      editForm.reset();
      toast.success('Customer updated successfully');
    },
    onError: (error: any) => {
      console.error('Detailed error:', error);
      toast.error(`Failed to update customer: ${error.message || 'Unknown error'}`);
    },
  });

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  const onSubmit = (data: CustomerFormValues) => {
    addCustomerMutation.mutate(data);
  };

  const onSubmitEdit = (data: CustomerFormValues) => {
    if (!selectedCustomer) return;
    
    updateCustomerMutation.mutate({
      id: selectedCustomer.id,
      ...data
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl lg:text-3xl break-words">Customers</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1 break-words">
                Manage your customer information and track their orders
              </CardDescription>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto text-sm sm:text-base flex-shrink-0">
                  <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Add New Customer</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Enter the customer's information below.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john@example.com" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1234567890" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="trn_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">TRN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="TRN123456" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="credit_period_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Credit Period (Days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              placeholder="0"
                              className="text-sm sm:text-base h-9 sm:h-10"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="credit_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Credit Limit</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="text-sm sm:text-base h-9 sm:h-10"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="current_credit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Current Credit</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="text-sm sm:text-base h-9 sm:h-10"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                      <Button type="submit" disabled={addCustomerMutation.isPending} className="w-full sm:w-auto text-sm">
                        {addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No customers found</div>
            ) : (
              filteredCustomers.map((customer) => (
                <Card key={customer.id} className="p-3 w-full min-w-0 overflow-hidden">
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-1 break-words">{customer.name}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{customer.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Orders: </span>
                        <span className="font-medium">{customer.totalOrders || 0}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Spent: </span>
                        <span className="font-medium">${(customer.totalSpent || 0).toFixed(2)}</span>
                      </div>
                      <div className="min-w-0 col-span-2">
                        <span className="text-muted-foreground">Last Order: </span>
                        <span className="font-medium break-words">{customer.lastOrder || 'Never'}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-xs h-8 flex-1 min-w-[calc(50%-0.375rem)]"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-base sm:text-lg">Customer Details</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                              Detailed information about {selectedCustomer?.name}
                            </DialogDescription>
                          </DialogHeader>
                          {selectedCustomer && (
                            <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm">
                              <div className="min-w-0">
                                <h3 className="font-semibold mb-2 text-sm sm:text-base">Contact Information</h3>
                                <p className="break-words">Email: {selectedCustomer.email}</p>
                                <p className="break-words">Phone: {selectedCustomer.phone}</p>
                                <p className="break-words">TRN Number: {selectedCustomer.trn_number || 'N/A'}</p>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold mb-2 text-sm sm:text-base">Credit Information</h3>
                                <p>Credit Period: {selectedCustomer.credit_period_days || 0} days</p>
                                <p>Credit Limit: ${(selectedCustomer.credit_limit || 0).toFixed(2)}</p>
                                <p>Current Credit: ${(selectedCustomer.current_credit || 0).toFixed(2)}</p>
                                {selectedCustomer.active_credit && (
                                  <div className="mt-2">
                                    <h4 className="font-medium text-primary text-sm">Active Credit</h4>
                                    <p>Amount: ${selectedCustomer.active_credit.amount.toFixed(2)}</p>
                                    <p>Period: {selectedCustomer.active_credit.period} days</p>
                                    <p>Start Date: {new Date(selectedCustomer.active_credit.start_date).toLocaleDateString()}</p>
                                    <p>Due Date: {new Date(selectedCustomer.active_credit.end_date).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {selectedCustomer.credit_periods && selectedCustomer.credit_periods.length > 0 && (
                                  <div className="mt-2">
                                    <h4 className="font-medium text-sm">Recent Credit History</h4>
                                    <div className="space-y-1">
                                      {selectedCustomer.credit_periods.slice(0, 3).map((period) => (
                                        <div key={period.id} className="text-xs">
                                          <p>Amount: ${period.amount.toFixed(2)} ({period.type})</p>
                                          <p>Period: {period.period} days</p>
                                          <p>Date: {new Date(period.created_at).toLocaleDateString()}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold mb-2 text-sm sm:text-base">Order Statistics</h3>
                                <p>Total Orders: {selectedCustomer.totalOrders || 0}</p>
                                <p>Total Spent: ${(selectedCustomer.totalSpent || 0).toFixed(2)}</p>
                                <p>Last Order: {selectedCustomer.lastOrder || 'Never'}</p>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          navigate(`/sales/orders/create?customerId=${customer.id}`);
                        }}
                        className="text-xs h-8 flex-1 min-w-[calc(50%-0.375rem)]"
                      >
                        Order
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          navigate(`/sales/customers/${customer.id}/orders`);
                        }}
                        className="text-xs h-8 flex-1 min-w-[calc(50%-0.375rem)]"
                      >
                        Orders
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setIsEditModalOpen(true);
                            }}
                            className="text-xs h-8 flex-1 min-w-[calc(50%-0.375rem)]"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-base sm:text-lg">Edit Customer</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                              Update {selectedCustomer?.name}'s information
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...editForm}>
                            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-3 sm:space-y-4">
                              <FormField
                                control={editForm.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Name *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="John Doe" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                                    <FormControl>
                                      <Input placeholder="john@example.com" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="phone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Phone</FormLabel>
                                    <FormControl>
                                      <Input placeholder="+1234567890" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="trn_number"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">TRN Number</FormLabel>
                                    <FormControl>
                                      <Input placeholder="TRN123456" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="credit_period_days"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Credit Period (Days)</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        min="0"
                                        placeholder="0"
                                        className="text-sm sm:text-base h-9 sm:h-10"
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="credit_limit"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Credit Limit</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="text-sm sm:text-base h-9 sm:h-10"
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name="current_credit"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs sm:text-sm">Current Credit</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="text-sm sm:text-base h-9 sm:h-10"
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              <DialogFooter className="flex-col sm:flex-row gap-2">
                                <Button type="submit" disabled={updateCustomerMutation.isPending} className="w-full sm:w-auto text-sm">
                                  {updateCustomerMutation.isPending ? 'Updating...' : 'Update Customer'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
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
                  <TableHead className="px-2">Name</TableHead>
                  <TableHead className="px-2">Email</TableHead>
                  <TableHead className="px-2">Phone</TableHead>
                  <TableHead className="px-2">Total Orders</TableHead>
                  <TableHead className="px-2">Total Spent</TableHead>
                  <TableHead className="px-2">Last Order</TableHead>
                  <TableHead className="px-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm">Loading...</TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm">No customers found</TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="px-2 py-2 font-medium text-sm min-w-0">
                        <div className="truncate" title={customer.name}>{customer.name}</div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm min-w-0">
                        <div className="truncate" title={customer.email}>{customer.email}</div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm min-w-0">
                        <div className="truncate" title={customer.phone}>{customer.phone}</div>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">{customer.totalOrders || 0}</TableCell>
                      <TableCell className="px-2 py-2 text-sm font-medium">${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-2 text-sm min-w-0">
                        <div className="truncate" title={customer.lastOrder || 'Never'}>{customer.lastOrder || 'Never'}</div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedCustomer(customer)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base sm:text-lg">Customer Details</DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm">
                                  Detailed information about {selectedCustomer?.name}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedCustomer && (
                                <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm">
                                  <div className="min-w-0">
                                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Contact Information</h3>
                                    <p className="break-words">Email: {selectedCustomer.email}</p>
                                    <p className="break-words">Phone: {selectedCustomer.phone}</p>
                                    <p className="break-words">TRN Number: {selectedCustomer.trn_number || 'N/A'}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Credit Information</h3>
                                    <p>Credit Period: {selectedCustomer.credit_period_days || 0} days</p>
                                    <p>Credit Limit: ${(selectedCustomer.credit_limit || 0).toFixed(2)}</p>
                                    <p>Current Credit: ${(selectedCustomer.current_credit || 0).toFixed(2)}</p>
                                    {selectedCustomer.active_credit && (
                                      <div className="mt-2">
                                        <h4 className="font-medium text-primary text-sm">Active Credit</h4>
                                        <p>Amount: ${selectedCustomer.active_credit.amount.toFixed(2)}</p>
                                        <p>Period: {selectedCustomer.active_credit.period} days</p>
                                        <p>Start Date: {new Date(selectedCustomer.active_credit.start_date).toLocaleDateString()}</p>
                                        <p>Due Date: {new Date(selectedCustomer.active_credit.end_date).toLocaleDateString()}</p>
                                      </div>
                                    )}
                                    {selectedCustomer.credit_periods && selectedCustomer.credit_periods.length > 0 && (
                                      <div className="mt-2">
                                        <h4 className="font-medium text-sm">Recent Credit History</h4>
                                        <div className="space-y-1">
                                          {selectedCustomer.credit_periods.slice(0, 3).map((period) => (
                                            <div key={period.id} className="text-xs">
                                              <p>Amount: ${period.amount.toFixed(2)} ({period.type})</p>
                                              <p>Period: {period.period} days</p>
                                              <p>Date: {new Date(period.created_at).toLocaleDateString()}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Order Statistics</h3>
                                    <p>Total Orders: {selectedCustomer.totalOrders || 0}</p>
                                    <p>Total Spent: ${(selectedCustomer.totalSpent || 0).toFixed(2)}</p>
                                    <p>Last Order: {selectedCustomer.lastOrder || 'Never'}</p>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              navigate(`/sales/orders/create?customerId=${customer.id}`);
                            }}
                            className="h-8 w-8 p-0"
                            title="Place Order"
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              navigate(`/sales/customers/${customer.id}/orders`);
                            }}
                            className="h-8 w-8 p-0"
                            title="View Orders"
                          >
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setIsEditModalOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base sm:text-lg">Edit Customer</DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm">
                                  Update {selectedCustomer?.name}'s information
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...editForm}>
                                <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-3 sm:space-y-4">
                                  <FormField
                                    control={editForm.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Name *</FormLabel>
                                        <FormControl>
                                          <Input placeholder="John Doe" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="email"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                                        <FormControl>
                                          <Input placeholder="john@example.com" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="phone"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Phone</FormLabel>
                                        <FormControl>
                                          <Input placeholder="+1234567890" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="trn_number"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">TRN Number</FormLabel>
                                        <FormControl>
                                          <Input placeholder="TRN123456" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="credit_period_days"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Credit Period (Days)</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            placeholder="0"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="credit_limit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Credit Limit</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="current_credit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs sm:text-sm">Current Credit</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <DialogFooter className="flex-col sm:flex-row gap-2">
                                    <Button type="submit" disabled={updateCustomerMutation.isPending} className="w-full sm:w-auto text-sm">
                                      {updateCustomerMutation.isPending ? 'Updating...' : 'Update Customer'}
                                    </Button>
                                  </DialogFooter>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 