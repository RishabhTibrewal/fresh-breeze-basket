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
import { warehousesService } from '@/api/warehouses';
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
import WarehouseStockDisplay from "@/components/products/WarehouseStockDisplay";

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
    original_price: number; // Store original product price for reference
    price: number;
    subtotal: number;
    discount?: number; // Optional discount percentage
    image_url?: string;
    origin?: string;
    stock_count?: number;
    unit?: number;
    unit_type?: string;
    warehouse_id?: string; // Warehouse ID for this item
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
        // Request all products by setting a high limit (or fetch all pages)
        const response = await apiClient.get('/products', {
          params: {
            limit: 1000, // Set high limit to get all products
            page: 1
          }
        });
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

  // Fetch all product stocks at once to avoid multiple API calls
  const { data: bulkStockData = {} } = useQuery({
    queryKey: ['bulk-product-stock', products.map(p => p.id).join(',')],
    queryFn: () => {
      if (products.length === 0) return {};
      return warehousesService.getBulkProductStock(products.map(p => p.id));
    },
    enabled: products.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Get warehouses for order items
  const { data: warehouses = [], isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true), // Only get active warehouses
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
    const originalPrice = product.sale_price || product.price;
    
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
      // Set default warehouse (first active warehouse or null)
      const defaultWarehouseId = warehouses.length > 0 ? warehouses[0].id : undefined;
      
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: priceToUse,
        original_price: originalPrice, // Store original price
        price: priceToUse,
        subtotal: priceToUse,
        discount: 0, // No discount initially
        image_url: product.image_url,
        origin: product.origin,
        stock_count: product.stock_count,
        unit: product.unit || 1,
        unit_type: product.unit_type || 'piece',
        warehouse_id: defaultWarehouseId
      };
      
      setItems([...items, newItem]);
      console.log('Added new item to order:', newItem);
    }
  };

  // Update warehouse for an item
  const updateWarehouse = (index: number, warehouseId: string) => {
    const newItems = [...items];
    newItems[index].warehouse_id = warehouseId;
    setItems(newItems);
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

  // Update unit price for an item
  const updateUnitPrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    
    const newItems = [...items];
    newItems[index].unit_price = newPrice;
    newItems[index].subtotal = newItems[index].quantity * newPrice;
    newItems[index].price = newPrice;
    
    // Calculate discount percentage if price is different from original
    if (newItems[index].original_price > 0) {
      const discountAmount = newItems[index].original_price - newPrice;
      newItems[index].discount = (discountAmount / newItems[index].original_price) * 100;
    }
    
    setItems(newItems);
  };

  // Update discount percentage for an item
  const updateDiscount = (index: number, discountPercent: number) => {
    if (discountPercent < 0 || discountPercent > 100) return;
    
    const newItems = [...items];
    newItems[index].discount = discountPercent;
    const discountAmount = (newItems[index].original_price * discountPercent) / 100;
    newItems[index].unit_price = newItems[index].original_price - discountAmount;
    newItems[index].subtotal = newItems[index].quantity * newItems[index].unit_price;
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
        const creditAmount = data.payment_status === 'full_credit' ? totalAmount : 
                            (totalAmount - (data.partial_payment_amount || 0));
        const partialPaymentAmount = data.partial_payment_amount || 0;
        
        orderData.credit_details = {
          amount: creditAmount,
          period: data.credit_period || 30,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          type: 'credit',
          description: data.payment_status === 'full_credit' 
            ? `Credit for order - Full Credit` 
            : `Credit for order - Partial Payment (Paid: ₹ ${partialPaymentAmount.toFixed(2)}, Credit: ₹ ${creditAmount.toFixed(2)})`
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
    
    // Ensure all items have the price field set correctly and include warehouse_id
    const processedItems = items.map(item => ({
      ...item,
      price: item.unit_price,
      warehouse_id: item.warehouse_id // Include warehouse_id for each item
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
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <Button 
        variant="outline" 
        className="mb-3 sm:mb-4 w-full sm:w-auto text-sm sm:text-base"
        onClick={() => customerId 
          ? navigate(`/sales/customers/${customerId}/orders`) 
          : navigate('/sales/customers')
        }
      >
        <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
        Back
      </Button>

      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl lg:text-3xl break-words">Create New Order</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1 break-words">
            {customer ? `Creating order for ${customer.name}` : 'Select a customer and add products'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Customer *</FormLabel>
                      <FormControl>
                        <Select 
                          disabled={!!customerId}
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <SelectTrigger className="text-sm sm:text-base h-9 sm:h-10">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customer && (
                              <SelectItem value={customer.id} className="text-sm">{customer.name}</SelectItem>
                            )}
                            {/* Additional customers would be listed here in a full implementation */}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                
                <Tabs 
                  defaultValue="products" 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="w-full min-w-0"
                >
                  <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10">
                    <TabsTrigger value="products" className="text-xs sm:text-sm">
                      Products
                    </TabsTrigger>
                    <TabsTrigger value="checkout" disabled={items.length === 0} className="text-xs sm:text-sm">
                      <ShoppingCart className="mr-1.5 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Checkout ({items.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="products" className="w-full min-w-0">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="mb-3 sm:mb-4">
                        <h3 className="text-base sm:text-lg font-medium mb-2">Select Products</h3>
                        
                        {productsLoading ? (
                          <div className="text-center py-4 text-sm sm:text-base">Loading products...</div>
                        ) : !products || products.length === 0 ? (
                          <div className="text-center py-4 text-sm sm:text-base">No products available</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {products.map(product => (
                              <div 
                                key={product?.id || 'unknown'} 
                                className="border rounded-md p-2.5 sm:p-3 cursor-pointer hover:bg-gray-50 transition-colors min-w-0 overflow-hidden"
                                onClick={() => addProduct(product.id)}
                              >
                                <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                                  {product.image_url && (
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md overflow-hidden flex-shrink-0">
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-grow min-w-0">
                                    <div className="font-medium text-sm sm:text-base truncate">{product?.name || 'Unknown'}</div>
                                    <div className="text-xs sm:text-sm text-muted-foreground truncate">{product.origin || 'N/A'}</div>
                                    <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1 flex-wrap">
                                      {product.sale_price ? (
                                        <>
                                          <span className="font-medium text-green-600 text-xs sm:text-sm">
                                            ₹ {product.sale_price.toFixed(2)}
                                          </span>
                                          <span className="text-xs line-through text-muted-foreground">
                                            ₹ {product.price.toFixed(2)}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="font-medium text-xs sm:text-sm">
                                          ₹ {product.price.toFixed(2)}
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        per {product.unit || 1} {product.unit_type || 'piece'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1 gap-2">
                                      <div className="text-xs">
                                        Stock:{' '}
                                        <WarehouseStockDisplay
                                          productId={product.id}
                                          totalStock={product.stock_count}
                                          compact={true}
                                          bulkStockData={bulkStockData[product.id]}
                                        />
                                      </div>
                                      <span className="text-xs px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary rounded-full whitespace-nowrap">
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
                      
                      {/* Mobile Card View for Order Items */}
                      <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                        {items.length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground">
                            No items added to the order yet
                          </div>
                        ) : (
                          items.map((item, index) => (
                            <Card key={`${item.product_id}-${index}`} className="p-3 w-full min-w-0 overflow-hidden">
                              <div className="space-y-2.5 min-w-0">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  {item.image_url && (
                                    <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                      <img
                                        src={item.image_url || '/placeholder.svg'}
                                        alt={item.product_name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm mb-1 break-words">{item.product_name}</div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                      {item.origin || 'N/A'} • Stock: {item.stock_count || 'N/A'}
                                    </div>
                                    <div className="text-base font-bold text-green-600 mb-2">
                                      ₹ {item.subtotal.toFixed(2)}
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 flex-shrink-0"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                
                                <div className="space-y-2 text-xs min-w-0 border-t pt-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="min-w-0">
                                      <label className="text-muted-foreground">Qty:</label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                        className="h-8 text-xs mt-1"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <label className="text-muted-foreground">Discount %:</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={item.discount || 0}
                                        onChange={(e) => updateDiscount(index, parseFloat(e.target.value) || 0)}
                                        className="h-8 text-xs mt-1"
                                        placeholder="0%"
                                      />
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <label className="text-muted-foreground">Warehouse:</label>
                                    {warehousesLoading ? (
                                      <div className="text-xs text-muted-foreground mt-1">Loading...</div>
                                    ) : (
                                      <Select
                                        value={item.warehouse_id || ''}
                                        onValueChange={(value) => updateWarehouse(index, value)}
                                      >
                                        <SelectTrigger className="h-8 text-xs mt-1">
                                          <SelectValue placeholder="Select warehouse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {warehouses.map((warehouse) => (
                                            <SelectItem key={warehouse.id} value={warehouse.id} className="text-xs">
                                              {warehouse.code} - {warehouse.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <label className="text-muted-foreground">Unit Price:</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) => updateUnitPrice(index, parseFloat(e.target.value) || 0)}
                                      className="h-8 text-xs mt-1"
                                    />
                                    {item.unit_price < item.original_price && (
                                      <div className="text-xs text-green-600 mt-1">
                                        Save: ₹ {((item.original_price - item.unit_price) * item.quantity).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Original: ₹ {item.original_price.toFixed(2)} per {item.unit || 1} {item.unit_type || 'piece'}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                        {items.length > 0 && (
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                            <span className="font-medium text-sm sm:text-base">Total:</span>
                            <span className="font-bold text-base sm:text-lg">₹ {totalAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                        <div className="rounded-md border w-full min-w-0">
                          <Table className="min-w-[800px]">
                          <TableHeader>
                            <TableRow>
                                <TableHead className="px-2 w-12">Image</TableHead>
                                <TableHead className="px-2">Product</TableHead>
                                <TableHead className="px-2">Origin</TableHead>
                                <TableHead className="px-2 min-w-[100px]">Stock</TableHead>
                                <TableHead className="px-2 w-24">Quantity</TableHead>
                                <TableHead className="px-2 w-32">Warehouse</TableHead>
                                <TableHead className="px-2 w-32">Original Price</TableHead>
                                <TableHead className="px-2 w-32">Discount %</TableHead>
                                <TableHead className="px-2 w-32">Unit Price</TableHead>
                                <TableHead className="px-2 w-32">Subtotal</TableHead>
                                <TableHead className="px-2 w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center py-6 text-sm">
                                    No items added to the order yet
                                  </TableCell>
                                </TableRow>
                              ) : (
                                items.map((item, index) => (
                                  <TableRow key={`${item.product_id}-${index}`}>
                                    <TableCell className="px-2 py-2">
                                          <div className="w-10 h-10 rounded-md overflow-hidden">
                                            <img
                                              src={item.image_url || '/placeholder.svg'}
                                              alt={item.product_name}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        </TableCell>
                                    <TableCell className="px-2 py-2 font-medium text-sm min-w-0">
                                      <div className="truncate" title={item.product_name}>{item.product_name}</div>
                                    </TableCell>
                                    <TableCell className="px-2 py-2 text-sm">{item.origin || 'N/A'}</TableCell>
                                    <TableCell className="px-2 py-2 text-sm">
                                      {item.warehouse_id ? (
                                        <WarehouseStockDisplay
                                          productId={item.product_id}
                                          totalStock={item.stock_count}
                                          compact={true}
                                          bulkStockData={bulkStockData[item.product_id]}
                                        />
                                      ) : (
                                        item.stock_count || 'N/A'
                                      )}
                                    </TableCell>
                                    <TableCell className="px-2 py-2">
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                        className="w-16 h-8 text-sm"
                                      />
                                    </TableCell>
                                    <TableCell className="px-2 py-2">
                                      {warehousesLoading ? (
                                        <div className="text-xs text-muted-foreground">Loading...</div>
                                      ) : (
                                        <Select
                                          value={item.warehouse_id || ''}
                                          onValueChange={(value) => updateWarehouse(index, value)}
                                        >
                                          <SelectTrigger className="w-32 h-8 text-xs">
                                            <SelectValue placeholder="Select warehouse" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {warehouses.map((warehouse) => (
                                              <SelectItem key={warehouse.id} value={warehouse.id} className="text-xs">
                                                {warehouse.code} - {warehouse.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </TableCell>
                                    <TableCell className="px-2 py-2">
                                      <div className="text-sm">
                                        ₹ {item.original_price.toFixed(2)}
                                      <div className="text-xs text-muted-foreground">
                                        per {item.unit || 1} {item.unit_type || 'piece'}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-2 py-2">
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={item.discount || 0}
                                        onChange={(e) => updateDiscount(index, parseFloat(e.target.value) || 0)}
                                        className="w-20 h-8 text-sm"
                                        placeholder="0%"
                                      />
                                    </TableCell>
                                    <TableCell className="px-2 py-2">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={(e) => updateUnitPrice(index, parseFloat(e.target.value) || 0)}
                                        className="w-24 h-8 text-sm"
                                      />
                                      {item.unit_price < item.original_price && (
                                        <div className="text-xs text-green-600 mt-1">
                                          Save: ₹ {((item.original_price - item.unit_price) * item.quantity).toFixed(2)}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="px-2 py-2 font-medium text-sm">₹ {item.subtotal.toFixed(2)}</TableCell>
                                    <TableCell className="px-2 py-2">
                                      <Button 
                                        variant="ghost" 
                                            size="icon"
                                        onClick={() => removeItem(index)}
                                        className="h-8 w-8"
                                      >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                                  
                                  {items.length > 0 && (
                                    <TableRow>
                                  <TableCell colSpan={9} className="text-right font-medium px-2 py-2 text-sm">
                                        Total:
                                      </TableCell>
                                  <TableCell className="font-bold px-2 py-2 text-sm sm:text-base">
                                        ₹ {totalAmount.toFixed(2)}
                                      </TableCell>
                                  <TableCell className="px-2 py-2"></TableCell>
                                    </TableRow>
                                  )}
                            </TableBody>
                          </Table>
                        </div>
                        </div>
                        
                            {items.length > 0 && (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  onClick={() => setActiveTab('checkout')}
                            className="text-sm sm:text-base"
                                >
                                  Continue to Checkout
                                </Button>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        
                  <TabsContent value="checkout" className="w-full min-w-0">
                          {showAddressForm && (
                            <Card className="mb-4 sm:mb-6 p-3 sm:p-4 w-full min-w-0 overflow-hidden">
                              <CardContent className="p-0">
                                <CustomerAddressForm
                                  customerId={customerId}
                                  onClose={() => setShowAddressForm(false)}
                                  onAddressAdded={handleAddressAdded}
                                />
                              </CardContent>
                            </Card>
                          )}

                          {/* Shipping and billing address section */}
                    <div className="space-y-4 sm:space-y-6">
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Delivery Information</h3>
                        
                        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                                {/* Shipping Address */}
                                <FormField
                                  control={form.control}
                                  name="shipping_address_id"
                                  render={({ field }) => (
                              <FormItem className="space-y-2 min-w-0">
                                <FormLabel className="text-xs sm:text-sm">Shipping Address *</FormLabel>
                                <div className="space-y-3 sm:space-y-4">
                                        {addressesLoading ? (
                                    <div className="text-xs sm:text-sm">Loading addresses...</div>
                                        ) : addresses.length === 0 ? (
                                    <div className="text-xs sm:text-sm text-muted-foreground">No addresses found</div>
                                        ) : (
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                      className="flex flex-col space-y-2.5 sm:space-y-3"
                                          >
                                            {addresses.map(address => (
                                        <div className="flex items-start space-x-2.5 sm:space-x-3 border p-3 sm:p-4 rounded-md min-w-0" key={address.id}>
                                          <RadioGroupItem value={address.id} id={`shipping-${address.id}`} className="mt-0.5 flex-shrink-0" />
                                                <label 
                                                  htmlFor={`shipping-${address.id}`}
                                            className="flex-1 cursor-pointer text-xs sm:text-sm min-w-0 break-words"
                                          >
                                            <div className="font-medium mb-1">{address.address_type} Address</div>
                                            <div className="break-words">{address.address_line1}</div>
                                            {address.address_line2 && <div className="break-words">{address.address_line2}</div>}
                                            <div className="break-words">{address.city}, {address.state}, {address.postal_code}</div>
                                            <div className="break-words">{address.country}</div>
                                                </label>
                                              </div>
                                            ))}
                                          </RadioGroup>
                                        )}
                                        
                                        <Button 
                                          type="button" 
                                          variant="outline"
                                          onClick={() => setShowAddressForm(true)}
                                    className="w-full text-xs sm:text-sm h-9 sm:h-10"
                                        >
                                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                          Add New Address
                                        </Button>
                                      </div>
                                <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />
                      </div>
                    </div>
                    
                          {/* Payment Information */}
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Payment Information</h3>
                            
                        <div className="space-y-4 sm:space-y-6">
                              {/* Payment Status */}
                    <FormField
                      control={form.control}
                      name="payment_status"
                      render={({ field }) => (
                              <FormItem className="space-y-2 min-w-0">
                                <FormLabel className="text-xs sm:text-sm">Payment Option *</FormLabel>
                                <div className="space-y-3 sm:space-y-4">
                            <RadioGroup
                              onValueChange={(value) => {
                                // Update both payment_status and payment_type for compatibility
                                field.onChange(value);
                                form.setValue('payment_type', value as 'full_payment' | 'partial_payment' | 'full_credit');
                              }} 
                              defaultValue={field.value}
                                    className="flex flex-col space-y-2.5 sm:space-y-3"
                            >
                                    <div className="flex items-start space-x-2.5 sm:space-x-3 border p-3 sm:p-4 rounded-md min-w-0">
                                      <RadioGroupItem value="full_payment" id="full_payment" className="mt-0.5 flex-shrink-0" />
                                <label 
                                  htmlFor="full_payment"
                                        className="flex-1 cursor-pointer text-xs sm:text-sm min-w-0"
                                >
                                        <div className="font-medium mb-1">Full Payment</div>
                                        <div className="text-muted-foreground break-words">Customer pays full amount today</div>
                                </label>
                              </div>
                              
                                    <div className="flex items-start space-x-2.5 sm:space-x-3 border p-3 sm:p-4 rounded-md min-w-0">
                                      <RadioGroupItem value="partial_payment" id="partial_payment" className="mt-0.5 flex-shrink-0" />
                                <label 
                                  htmlFor="partial_payment"
                                        className="flex-1 cursor-pointer text-xs sm:text-sm min-w-0"
                                >
                                        <div className="font-medium mb-1">Partial Payment</div>
                                        <div className="text-muted-foreground break-words">Customer pays part of the amount today and the rest on credit</div>
                                </label>
                              </div>
                              
                                    <div className="flex items-start space-x-2.5 sm:space-x-3 border p-3 sm:p-4 rounded-md min-w-0">
                                      <RadioGroupItem value="full_credit" id="full_credit" className="mt-0.5 flex-shrink-0" />
                                <label 
                                  htmlFor="full_credit"
                                        className="flex-1 cursor-pointer text-xs sm:text-sm min-w-0"
                                >
                                        <div className="font-medium mb-1">Full Credit</div>
                                        <div className="text-muted-foreground break-words">Customer pays full amount later</div>
                                </label>
                              </div>
                            </RadioGroup>
                          </div>
                                <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                      
                              {/* Payment Method */}
                              <FormField
                                control={form.control}
                                name="payment_method"
                                render={({ field }) => (
                              <FormItem className="min-w-0">
                                <FormLabel className="text-xs sm:text-sm">Payment Method *</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                    <SelectTrigger className="text-sm sm:text-base h-9 sm:h-10">
                                          <SelectValue placeholder="Select payment method" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                    <SelectItem value="cash" className="text-sm">Cash</SelectItem>
                                    <SelectItem value="card" className="text-sm">Card</SelectItem>
                                    <SelectItem value="cheque" className="text-sm">Cheque</SelectItem>
                                      </SelectContent>
                                    </Select>
                                <FormDescription className="text-xs sm:text-sm">
                                      How will the customer make the payment?
                                    </FormDescription>
                                <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                  
                              {/* Partial Payment Amount (Only for Partial Payment) */}
                              {paymentStatus === 'partial_payment' && (
                    <FormField
                      control={form.control}
                                name="partial_payment_amount"
                      render={({ field }) => (
                                <FormItem className="min-w-0">
                                  <FormLabel className="text-xs sm:text-sm">Partial Payment Amount *</FormLabel>
                          <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                      className="text-sm sm:text-base h-9 sm:h-10"
                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                        value={field.value === undefined ? '' : field.value}
                                      />
                          </FormControl>
                                  <FormDescription className="text-xs sm:text-sm">
                                      Enter the amount to be paid now. Remaining ₹ {(totalAmount - (field.value || 0)).toFixed(2)} will be on credit.
                                    </FormDescription>
                                  <FormMessage className="text-xs" />
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
                                <FormItem className="min-w-0">
                                  <FormLabel className="text-xs sm:text-sm">Credit Period (Days) *</FormLabel>
                        <FormControl>
                                      <Input
                                        type="number"
                                        min="1"
                                        max={customer?.credit_period_days || 30}
                                        placeholder={`Max: ${customer?.credit_period_days || 30} days`}
                                      className="text-sm sm:text-base h-9 sm:h-10"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          if (value <= (customer?.credit_period_days || 30)) {
                                            field.onChange(value);
                                          }
                                        }}
                                        value={field.value === undefined ? '' : field.value}
                                      />
                        </FormControl>
                                  <FormDescription className="text-xs sm:text-sm">
                                        Number of days until payment is due (Maximum: {customer?.credit_period_days || 30} days)
                                      </FormDescription>
                                  <FormMessage className="text-xs" />
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
                          <FormItem className="min-w-0">
                            <FormLabel className="text-xs sm:text-sm">Order Notes (Optional)</FormLabel>
                          <FormControl>
                                  <Textarea
                                    placeholder="Add any special instructions or notes for this order"
                                className="text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                                    {...field}
                                  />
                          </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                          
                          {/* Order Summary */}
                      <div className="border rounded-md p-3 sm:p-4 min-w-0">
                        <h3 className="font-medium mb-2 text-sm sm:text-base">Order Summary</h3>
                        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                              <div className="flex justify-between">
                                <span>Total Items:</span>
                                <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>Total Amount:</span>
                                <span>₹ {totalAmount.toFixed(2)}</span>
                              </div>
                              
                              {paymentStatus === 'partial_payment' && (
                                <>
                                  <div className="flex justify-between">
                                    <span>Paying Now:</span>
                                    <span>₹ {form.getValues('partial_payment_amount')?.toFixed(2) || '0.00'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>On Credit:</span>
                                    <span>₹ {(totalAmount - (form.getValues('partial_payment_amount') || 0)).toFixed(2)}</span>
                                  </div>
                                </>
                              )}
                              
                              <div className="flex justify-between">
                                <span>Payment Method:</span>
                            <span className="break-words">{form.getValues('payment_method')?.charAt(0).toUpperCase() + form.getValues('payment_method')?.slice(1) || 'Cash'}</span>
                              </div>
                              
                              {paymentStatus === 'full_credit' && (
                                <div className="flex justify-between">
                                  <span>On Credit:</span>
                                  <span>₹ {totalAmount.toFixed(2)}</span>
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
                            <span className="break-words">{form.getValues('payment_status')?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                  
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4 border-t">
                {activeTab === 'checkout' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('products')}
                    className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-1"
                  >
                    Back to Products
                  </Button>
                )}
                
                {activeTab === 'checkout' && (
                  <Button 
                    type="submit" 
                    disabled={createOrderMutation.isPending || items.length === 0}
                    className="w-full sm:w-auto text-sm sm:text-base order-1 sm:order-2"
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