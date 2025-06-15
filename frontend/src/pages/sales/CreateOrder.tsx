import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, ShoppingCart, MapPin, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { customerService } from '@/api/customer';
import apiClient from '@/lib/apiClient';
import { addressApi } from '@/api/addresses';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CustomerAddressForm from "./CustomerAddressForm";

// Enhanced schema for the order form with payment method options
const orderFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  notes: z.string().optional(),
  payment_status: z.enum(['full_payment', 'partial_payment', 'full_credit'], {
    required_error: "Payment status is required",
  }),
  payment_method: z.enum(['cash', 'card', 'cheque']).optional(),
  payment_type: z.enum(['full_payment', 'partial_payment', 'full_credit']).optional(),
  shipping_address_id: z.string().min(1, "Shipping address is required"),
  billing_address_id: z.string().optional(),
  partial_payment_amount: z.number().optional(),
  credit_period: z.number().optional(),
});

// Custom type with context for form submission
type OrderFormValues = z.infer<typeof orderFormSchema>;

// Address form schema
const addressSchema = z.object({
  address_type: z.enum(['shipping', 'billing', 'both'], {
    required_error: "Please select an address type",
  }),
  address_line1: z.string().min(5, { message: "Address line 1 is required" }),
  address_line2: z.string().optional(),
  city: z.string().min(2, { message: "City is required" }),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, { message: "Country is required" }),
  is_default: z.boolean().default(false),
});

export default function CreateOrder() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId');
  
  // Active tab state (products or checkout)
  const [activeTab, setActiveTab] = useState("products");
  
  const [items, setItems] = useState<Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    price: number;
    subtotal: number;
    image_url?: string;
    origin?: string;
    stock_count?: number;
    unit?: number;
    unit_type?: string;
  }>>([]);
  
  const [totalAmount, setTotalAmount] = useState(0);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  
  // Get customer details if ID is provided
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerService.getCustomerById(customerId!),
    enabled: !!customerId,
  });
  
  // Get products for the order
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/products');
        console.log('Product API response:', response.data);
        
        // Based on the API response structure, extract the data array
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
          return response.data.data;
        } else if (Array.isArray(response.data)) {
          return response.data;
        } else {
          console.error('Unexpected products API response structure:', response.data);
          return [];
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        return [];
      }
    },
  });
  
  // Get customer addresses
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      // If we have a customerId, fetch the addresses for that customer
      if (customerId) {
        try {
          // Use the customer addresses endpoint
          const response = await apiClient.get(`/customer/${customerId}/addresses`);
          // API now returns the array directly
          return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
          console.error('Error fetching addresses:', error);
          return [];
        }
      }
      return [];
    },
    enabled: !!customerId,
  });
  
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customer_id: customerId || "",
      notes: "",
      payment_status: "full_payment",
      payment_method: "cash",
      payment_type: "full_payment",
      shipping_address_id: "",
      billing_address_id: "",
      partial_payment_amount: undefined,
      credit_period: undefined,
    },
  });
  
  const isLoading = customerLoading || productsLoading || addressesLoading;
  
  // Watch payment status to conditionally render fields
  const paymentStatus = form.watch("payment_status");
  // Watch payment type for backward compatibility with existing code
  const paymentType = form.watch("payment_type");
  
  // Debug products loading
  useEffect(() => {
    if (!productsLoading) {
      console.log('Products loaded:', products);
      console.log('Products array length:', products.length);
      if (products.length === 0) {
        console.warn('No products were loaded');
      }
    }
  }, [products, productsLoading]);
  
  useEffect(() => {
    // Calculate total amount whenever items change
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    setTotalAmount(total);
  }, [items]);
  
  // Fill in customer details when loaded
  useEffect(() => {
    if (customer) {
      form.setValue('customer_id', customer.id);
    }
  }, [customer, form]);
  
  // Set default address if available
  useEffect(() => {
    if (addresses.length > 0) {
      // Look for a default address
      const defaultAddress = addresses.find(addr => addr.is_default);
      
      if (defaultAddress) {
        form.setValue('shipping_address_id', defaultAddress.id);
        form.setValue('billing_address_id', defaultAddress.id);
      } else if (addresses[0]) {
        // Use the first address as default if no default address exists
        form.setValue('shipping_address_id', addresses[0].id);
        form.setValue('billing_address_id', addresses[0].id);
      }
    }
  }, [addresses, form]);
  
  // Handle payment status change
  useEffect(() => {
    const status = form.getValues('payment_status');
    
    // Keep payment_type in sync with payment_status for backward compatibility
    form.setValue('payment_type', status);
    
    // Update form fields based on payment status
    if (status === 'full_payment') {
      // Clear credit fields
      form.setValue('credit_period', undefined);
      form.setValue('partial_payment_amount', undefined);
    } else if (status === 'partial_payment') {
      // Ensure payment method is set for partial payment
      if (!form.getValues('payment_method')) {
        form.setValue('payment_method', 'cash');
      }
    } else if (status === 'full_credit') {
      form.setValue('partial_payment_amount', undefined);
      // Ensure payment method is set for full credit
      if (!form.getValues('payment_method')) {
        form.setValue('payment_method', 'cash');
      }
    }
  }, [form.watch('payment_status')]);
  
  // Handle address added
  const handleAddressAdded = (address: any) => {
    console.log('New address added:', address);
    setShowAddressForm(false);
    setEditingAddressId(null);
    
    // Refetch addresses - ensure we clear the cache completely
    queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
    
    // Set the new address as the shipping/billing address after a small delay to ensure the data is refetched
    setTimeout(() => {
      if (address?.id) {
        form.setValue('shipping_address_id', address.id);
        form.setValue('billing_address_id', address.id);
      }
    }, 500);
  };
  
  // Add a product to the order
  const addProduct = (productId: string) => {
    console.log('Adding product with ID:', productId);
    console.log('Available products:', products);
    
    const product = products.find(p => p.id === productId);
    console.log('Found product:', product);
    
    if (!product) {
      console.error(`Product with ID ${productId} not found in the products list`);
      return;
    }
    
    // Use sale price if available, otherwise use regular price
    const priceToUse = product.sale_price || product.price;
    
    // Check if product already exists in the order
    const existingIndex = items.findIndex(item => item.product_id === productId);
    
    if (existingIndex >= 0) {
      // Update quantity if product already exists
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].subtotal = newItems[existingIndex].quantity * newItems[existingIndex].unit_price;
      setItems(newItems);
      console.log('Updated existing item quantity', newItems[existingIndex]);
    } else {
      // Add new product to the order
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: priceToUse,
        price: priceToUse,
        subtotal: priceToUse,
        image_url: product.image_url,
        origin: product.origin,
        stock_count: product.stock_count,
        unit: product.unit || 1,
        unit_type: product.unit_type || 'piece'
      };
      
      setItems([...items, newItem]);
      console.log('Added new item to order:', newItem);
    }
  };
  
  // Update item quantity
  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].subtotal = quantity * newItems[index].unit_price;
    newItems[index].price = newItems[index].unit_price;
    setItems(newItems);
  };
  
  // Remove item from order
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormValues & { items: typeof items, total_amount: number }) => {
      // Prepare the order data
      interface OrderData extends OrderFormValues {
        items: typeof items;
        total_amount: number;
        credit_details?: {
          amount: number;
          period: number;
          start_date: string;
          end_date: string;
          type: 'credit' | 'payment';
          description: string;
        };
      }
      
      // This console.log was already good for seeing what data object contains
      console.log('Form data for mutation:', data);
      
      const orderData: OrderData = {
        ...data,
        items,
        total_amount: totalAmount
      };
      
      // Add credit period if needed
      if (data.payment_status === 'full_credit' || data.payment_status === 'partial_payment') {
        // Calculate dates for credit period
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (data.credit_period || 30)); // Default to 30 days if missing
        
        // Add credit details
        orderData.credit_details = {
          amount: data.payment_status === 'full_credit' ? totalAmount : 
                 (totalAmount - (data.partial_payment_amount || 0)),
          period: data.credit_period || 30,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          type: 'credit',
          description: `Credit for order - ${data.payment_status === 'full_credit' ? 'Full Credit' : 'Partial Payment'}`
        };
      }
      
      // Log the final object being sent to the service
      console.log('Final orderData being sent to customerService.createOrderForCustomer:', orderData);
      
      return await customerService.createOrderForCustomer(data.customer_id, orderData);
    },
    onSuccess: (response) => { // Add response to onSuccess to log it
      console.log('Order creation API response in onSuccess:', response);
      queryClient.invalidateQueries({ queryKey: ['customerOrders', customerId] });
      toast.success('Order created successfully');
      navigate(`/sales/customers/${customerId}/orders`);
    },
    onError: (error: any) => {
      console.error('Order creation mutation error:', error.response ? error.response.data : error.message);
      toast.error(`Failed to create order: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });
  
  const onSubmit = (data: OrderFormValues) => {
    if (items.length === 0) {
      toast.error('Please add at least one product to the order');
      setActiveTab('products');
      return;
    }
    
    console.log('Submitting order with payment status:', data.payment_status);
    console.log('Payment method:', data.payment_method);
    
    // Validate payment data
    if (data.payment_status === 'partial_payment' && (!data.partial_payment_amount || data.partial_payment_amount <= 0)) {
      toast.error('Please enter a valid partial payment amount');
      return;
    }
    
    if ((data.payment_status === 'partial_payment' || data.payment_status === 'full_credit') && 
        (!data.credit_period || data.credit_period <= 0)) {
      toast.error('Please enter a valid credit period');
      return;
    }
    
    // Validate partial payment amount doesn't exceed total
    if (data.payment_status === 'partial_payment' && 
        data.partial_payment_amount && 
        data.partial_payment_amount >= totalAmount) {
      toast.error('Partial payment amount must be less than the total order amount');
      return;
    }
    
    // Ensure all items have the price field set correctly
    const processedItems = items.map(item => ({
      ...item,
      price: item.unit_price
    }));
    
    createOrderMutation.mutate({
      ...data,
      items: processedItems,
      total_amount: totalAmount
    });
    
    // Log exact values being sent
    console.log('Final order submission with payment_status:', data.payment_status);
  };
  
  return (
    <div className="container mx-auto py-6">
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => customerId 
          ? navigate(`/sales/customers/${customerId}/orders`) 
          : navigate('/sales/customers')
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      
      {showAddressForm && (
        <Card className="mb-6 p-4">
          <CardContent>
            <CustomerAddressForm
              customerId={customerId}
              onClose={() => setShowAddressForm(false)}
              onAddressAdded={handleAddressAdded}
            />
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Order</CardTitle>
          <CardDescription>
            {customer ? `Creating order for ${customer.name}` : 'Select a customer and add products'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <FormControl>
                        <Select 
                          disabled={!!customerId}
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customer && (
                              <SelectItem value={customer.id}>{customer.name}</SelectItem>
                            )}
                            {/* Additional customers would be listed here in a full implementation */}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Tabs 
                  defaultValue="products" 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="products">
                      Products
                    </TabsTrigger>
                    <TabsTrigger value="checkout" disabled={items.length === 0}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Checkout ({items.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="products">
                    <div className="space-y-4">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium mb-2">Select Products</h3>
                        
                        {productsLoading ? (
                          <div className="text-center py-4">Loading products...</div>
                        ) : !products || products.length === 0 ? (
                          <div className="text-center py-4">No products available</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map(product => (
                              <div 
                                key={product?.id || 'unknown'} 
                                className="border rounded-md p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => addProduct(product.id)}
                              >
                                <div className="flex items-start gap-3">
                                  {product.image_url && (
                                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-grow">
                                    <div className="font-medium">{product?.name || 'Unknown'}</div>
                                    <div className="text-sm text-muted-foreground">{product.origin || 'N/A'}</div>
                                    <div className="flex items-baseline gap-2 mt-1">
                                      {product.sale_price ? (
                                        <>
                                          <span className="font-medium text-green-600">
                                            ${product.sale_price.toFixed(2)}
                                          </span>
                                          <span className="text-sm line-through text-muted-foreground">
                                            ${product.price.toFixed(2)}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="font-medium">
                                          ${product.price.toFixed(2)}
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        per {product.unit || 1} {product.unit_type || 'piece'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                      <span className="text-xs">Stock: {product.stock_count || 'N/A'}</span>
                                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                        Click to add
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                                  <TableHead className="w-12">Image</TableHead>
                                <TableHead>Product</TableHead>
                                    <TableHead>Origin</TableHead>
                                    <TableHead>Stock</TableHead>
                                <TableHead className="w-24">Quantity</TableHead>
                                <TableHead className="w-32">Unit Price</TableHead>
                                <TableHead className="w-32">Subtotal</TableHead>
                                <TableHead className="w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.length === 0 ? (
                                <TableRow>
                                      <TableCell colSpan={8} className="text-center py-6">
                                    No items added to the order yet
                                  </TableCell>
                                </TableRow>
                              ) : (
                                items.map((item, index) => (
                                  <TableRow key={`${item.product_id}-${index}`}>
                                        <TableCell>
                                          <div className="w-10 h-10 rounded-md overflow-hidden">
                                            <img
                                              src={item.image_url || '/placeholder.svg'}
                                              alt={item.product_name}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{item.product_name}</TableCell>
                                        <TableCell>{item.origin || 'N/A'}</TableCell>
                                        <TableCell>{item.stock_count || 'N/A'}</TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                            onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                                        className="w-16"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      ${item.unit_price.toFixed(2)}
                                      <div className="text-xs text-muted-foreground">
                                        per {item.unit || 1} {item.unit_type || 'piece'}
                                      </div>
                                    </TableCell>
                                    <TableCell>${item.subtotal.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Button 
                                        variant="ghost" 
                                            size="icon"
                                        onClick={() => removeItem(index)}
                                      >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                                  
                                  {items.length > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-right font-medium">
                                        Total:
                                      </TableCell>
                                      <TableCell className="font-bold">
                                        ${totalAmount.toFixed(2)}
                                      </TableCell>
                                      <TableCell></TableCell>
                                    </TableRow>
                                  )}
                            </TableBody>
                          </Table>
                        </div>
                        
                            {items.length > 0 && (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  onClick={() => setActiveTab('checkout')}
                                >
                                  Continue to Checkout
                                </Button>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="checkout">
                          {/* Shipping and billing address section */}
                          <div className="space-y-6">
                            <div>
                              <h3 className="text-lg font-medium mb-4">Delivery Information</h3>
                              
                              <div className="grid gap-6 md:grid-cols-2">
                                {/* Shipping Address */}
                                <FormField
                                  control={form.control}
                                  name="shipping_address_id"
                                  render={({ field }) => (
                                    <FormItem className="space-y-2">
                                      <FormLabel>Shipping Address *</FormLabel>
                                      <div className="space-y-4">
                                        {addressesLoading ? (
                                          <div>Loading addresses...</div>
                                        ) : addresses.length === 0 ? (
                                          <div className="text-muted-foreground">No addresses found</div>
                                        ) : (
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-3"
                                          >
                                            {addresses.map(address => (
                                              <div className="flex items-center space-x-3 border p-4 rounded-md" key={address.id}>
                                                <RadioGroupItem value={address.id} id={`shipping-${address.id}`} />
                                                <label 
                                                  htmlFor={`shipping-${address.id}`}
                                                  className="flex-1 cursor-pointer text-sm"
                                                >
                                                  <div className="font-medium">{address.address_type} Address</div>
                                                  <div>{address.address_line1}</div>
                                                  {address.address_line2 && <div>{address.address_line2}</div>}
                                                  <div>{address.city}, {address.state}, {address.postal_code}</div>
                                                  <div>{address.country}</div>
                                                </label>
                                              </div>
                                            ))}
                                          </RadioGroup>
                                        )}
                                        
                                        <Button 
                                          type="button" 
                                          variant="outline"
                                          onClick={() => setShowAddressForm(true)}
                                          className="w-full"
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add New Address
                                        </Button>
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                      </div>
                    </div>
                    
                          {/* Payment Information */}
                          <div>
                            <h3 className="text-lg font-medium mb-4">Payment Information</h3>
                            
                            <div className="space-y-6">
                              {/* Payment Status */}
                    <FormField
                      control={form.control}
                      name="payment_status"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel>Payment Option *</FormLabel>
                          <div className="space-y-4">
                            <RadioGroup
                              onValueChange={(value) => {
                                // Update both payment_status and payment_type for compatibility
                                field.onChange(value);
                                form.setValue('payment_type', value as 'full_payment' | 'partial_payment' | 'full_credit');
                              }} 
                              defaultValue={field.value}
                              className="flex flex-col space-y-3"
                            >
                              <div className="flex items-center space-x-3 border p-4 rounded-md">
                                <RadioGroupItem value="full_payment" id="full_payment" />
                                <label 
                                  htmlFor="full_payment"
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  <div className="font-medium">Full Payment</div>
                                  <div className="text-muted-foreground">Customer pays full amount today</div>
                                </label>
                              </div>
                              
                              <div className="flex items-center space-x-3 border p-4 rounded-md">
                                <RadioGroupItem value="partial_payment" id="partial_payment" />
                                <label 
                                  htmlFor="partial_payment"
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  <div className="font-medium">Partial Payment</div>
                                  <div className="text-muted-foreground">Customer pays part of the amount today and the rest on credit</div>
                                </label>
                              </div>
                              
                              <div className="flex items-center space-x-3 border p-4 rounded-md">
                                <RadioGroupItem value="full_credit" id="full_credit" />
                                <label 
                                  htmlFor="full_credit"
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  <div className="font-medium">Full Credit</div>
                                  <div className="text-muted-foreground">Customer pays full amount later</div>
                                </label>
                              </div>
                            </RadioGroup>
                          </div>
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
                                    <FormLabel>Payment Method *</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
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
                                      How will the customer make the payment?
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                  
                              {/* Partial Payment Amount (Only for Partial Payment) */}
                              {paymentStatus === 'partial_payment' && (
                    <FormField
                      control={form.control}
                                name="partial_payment_amount"
                      render={({ field }) => (
                        <FormItem>
                                    <FormLabel>Partial Payment Amount *</FormLabel>
                          <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                        value={field.value === undefined ? '' : field.value}
                                      />
                          </FormControl>
                                    <FormDescription>
                                      Enter the amount to be paid now. Remaining ${(totalAmount - (field.value || 0)).toFixed(2)} will be on credit.
                                    </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                              )}
                  
                              {/* Credit Period (For Credit & Partial Payment) */}
                              {(paymentStatus === 'full_credit' || paymentStatus === 'partial_payment') && (
                    <FormField
                      control={form.control}
                                name="credit_period"
                      render={({ field }) => (
                        <FormItem>
                                      <FormLabel>Credit Period (Days) *</FormLabel>
                        <FormControl>
                                      <Input
                                        type="number"
                                        min="1"
                                        max={customer?.credit_period_days || 30}
                                        placeholder={`Max: ${customer?.credit_period_days || 30} days`}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          if (value <= (customer?.credit_period_days || 30)) {
                                            field.onChange(value);
                                          }
                                        }}
                                        value={field.value === undefined ? '' : field.value}
                                      />
                        </FormControl>
                                      <FormDescription>
                                        Number of days until payment is due (Maximum: {customer?.credit_period_days || 30} days)
                                      </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                              )}
                            </div>
                          </div>
                    
                          {/* Order Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                                <FormLabel>Order Notes (Optional)</FormLabel>
                          <FormControl>
                                  <Textarea
                                    placeholder="Add any special instructions or notes for this order"
                                    {...field}
                                  />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                          
                          {/* Order Summary */}
                          <div className="border rounded-md p-4">
                            <h3 className="font-medium mb-2">Order Summary</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Total Items:</span>
                                <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Total Amount:</span>
                                <span>${totalAmount.toFixed(2)}</span>
                              </div>
                              
                              {paymentStatus === 'partial_payment' && (
                                <>
                                  <div className="flex justify-between">
                                    <span>Paying Now:</span>
                                    <span>${form.getValues('partial_payment_amount')?.toFixed(2) || '0.00'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>On Credit:</span>
                                    <span>${(totalAmount - (form.getValues('partial_payment_amount') || 0)).toFixed(2)}</span>
                                  </div>
                                </>
                              )}
                              
                              <div className="flex justify-between">
                                <span>Payment Method:</span>
                                <span>{form.getValues('payment_method')?.charAt(0).toUpperCase() + form.getValues('payment_method')?.slice(1) || 'Cash'}</span>
                              </div>
                              
                              {paymentStatus === 'full_credit' && (
                                <div className="flex justify-between">
                                  <span>On Credit:</span>
                                  <span>${totalAmount.toFixed(2)}</span>
                                </div>
                              )}
                              
                              {(paymentStatus === 'full_credit' || paymentStatus === 'partial_payment') && (
                                <div className="flex justify-between">
                                  <span>Credit Period:</span>
                                  <span>{form.getValues('credit_period') || 0} days</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between">
                                <span>Payment Status:</span>
                                <span>{form.getValues('payment_status')?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                  
                  <div className="flex justify-between">
                    {activeTab === 'checkout' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab('products')}
                      >
                        Back to Products
                      </Button>
                    )}
                    
                    {activeTab === 'checkout' && (
                    <Button 
                      type="submit" 
                        disabled={createOrderMutation.isPending || items.length === 0}
                    >
                        {createOrderMutation.isPending ? 'Creating Order...' : 'Place Order'}
                    </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      );
    } 