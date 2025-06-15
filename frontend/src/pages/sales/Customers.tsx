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
import { Plus, Search, Eye, Edit, ShoppingCart, ClipboardList } from "lucide-react";
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
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                Manage your customer information and track their orders
              </CardDescription>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>
                    Enter the customer's information below.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="trn_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TRN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="TRN123456" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="credit_period_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Period (Days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="credit_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Limit</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="current_credit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Credit</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={addCustomerMutation.isPending}>
                        {addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Total Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No customers found</TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.totalOrders || 0}</TableCell>
                      <TableCell>${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{customer.lastOrder || 'Never'}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedCustomer(customer)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Customer Details</DialogTitle>
                                <DialogDescription>
                                  Detailed information about {selectedCustomer?.name}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedCustomer && (
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="font-semibold">Contact Information</h3>
                                    <p>Email: {selectedCustomer.email}</p>
                                    <p>Phone: {selectedCustomer.phone}</p>
                                    <p>TRN Number: {selectedCustomer.trn_number || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">Credit Information</h3>
                                    <p>Credit Period: {selectedCustomer.credit_period_days || 0} days</p>
                                    <p>Credit Limit: ${(selectedCustomer.credit_limit || 0).toFixed(2)}</p>
                                    <p>Current Credit: ${(selectedCustomer.current_credit || 0).toFixed(2)}</p>
                                    {selectedCustomer.active_credit && (
                                      <div className="mt-2">
                                        <h4 className="font-medium text-primary">Active Credit</h4>
                                        <p>Amount: ${selectedCustomer.active_credit.amount.toFixed(2)}</p>
                                        <p>Period: {selectedCustomer.active_credit.period} days</p>
                                        <p>Start Date: {new Date(selectedCustomer.active_credit.start_date).toLocaleDateString()}</p>
                                        <p>Due Date: {new Date(selectedCustomer.active_credit.end_date).toLocaleDateString()}</p>
                                      </div>
                                    )}
                                    {selectedCustomer.credit_periods && selectedCustomer.credit_periods.length > 0 && (
                                      <div className="mt-2">
                                        <h4 className="font-medium">Recent Credit History</h4>
                                        <div className="space-y-1">
                                          {selectedCustomer.credit_periods.slice(0, 3).map((period) => (
                                            <div key={period.id} className="text-sm">
                                              <p>Amount: ${period.amount.toFixed(2)} ({period.type})</p>
                                              <p>Period: {period.period} days</p>
                                              <p>Date: {new Date(period.created_at).toLocaleDateString()}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">Order Statistics</h3>
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
                              // Navigate to create order page for this customer
                              navigate(`/sales/orders/create?customerId=${customer.id}`);
                            }}
                          >
                            Place Order
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              navigate(`/sales/customers/${customer.id}/orders`);
                            }}
                          >
                            View Orders
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
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Customer</DialogTitle>
                                <DialogDescription>
                                  Update {selectedCustomer?.name}'s information
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...editForm}>
                                <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
                                  <FormField
                                    control={editForm.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Name *</FormLabel>
                                        <FormControl>
                                          <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="email"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                          <Input placeholder="john@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="phone"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                          <Input placeholder="+1234567890" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="trn_number"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>TRN Number</FormLabel>
                                        <FormControl>
                                          <Input placeholder="TRN123456" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="credit_period_days"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Credit Period (Days)</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="credit_limit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Credit Limit</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={editForm.control}
                                    name="current_credit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Current Credit</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <DialogFooter>
                                    <Button type="submit" disabled={updateCustomerMutation.isPending}>
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