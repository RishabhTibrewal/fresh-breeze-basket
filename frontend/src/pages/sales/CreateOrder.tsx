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
import { ArrowLeft, Plus, Trash2, ShoppingCart, MapPin, X, Minus, Check, ChevronsUpDown, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { customerService } from '@/api/customer';
import apiClient from '@/lib/apiClient';
import { addressApi } from '@/api/addresses';
import { warehousesService } from '@/api/warehouses';
import { productsService } from '@/api/products';
import { variantsService } from '@/api/variants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import CustomerAddressForm from "./CustomerAddressForm";
import WarehouseStockDisplay from "@/components/products/WarehouseStockDisplay";
import { cn } from "@/lib/utils";

// Enhanced schema for the order form with payment method options
const orderFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  notes: z.string().optional(),
  payment_status: z.enum(['full_payment', 'partial_payment', 'full_credit'], {
    required_error: "Payment status is required",
  }),
  payment_method: z.enum(['cash', 'card', 'cheque', 'bank_transfer', 'neft', 'rtgs', 'upi']).optional(),
  payment_type: z.enum(['full_payment', 'partial_payment', 'full_credit']).optional(),
  shipping_address_id: z.string().min(1, "Shipping address is required"),
  billing_address_id: z.string().optional(),
  partial_payment_amount: z.number().optional(),
  credit_period: z.number().optional(),
  transaction_id: z.string().optional(),
  cheque_no: z.string().optional(),
  payment_date: z.string().optional(),
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
  
  interface OrderItem {
    id: string; // Unique ID for each row
    product_id: string;
    variant_id?: string | null;
    variant_name?: string;
    product_name: string;
    product_code?: string;
    hsn_code?: string;
    unit?: string;
    tax_percentage?: number;
    quantity: number;
    unit_price: number;
    original_price: number; // Store original product price for reference
    line_total: number;
    discount?: number; // Optional discount percentage
    image_url?: string;
    origin?: string;
    stock_count?: number;
    warehouse_id?: string; // Warehouse ID for this item
  }
  
  const [items, setItems] = useState<OrderItem[]>([]);
  
  // State to store variants for each product
  const [productVariants, setProductVariants] = useState<Record<string, any[]>>({});
  
  // State for product search combobox
  const [productSearchOpen, setProductSearchOpen] = useState<Record<string, boolean>>({});
  const [productSearchQuery, setProductSearchQuery] = useState<Record<string, string>>({});
  
  const [totalAmount, setTotalAmount] = useState(0);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [useSameAsShipping, setUseSameAsShipping] = useState(true);
  
  // State for customer search combobox
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  
  // Get all customers for selection
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
  
  // Get customer details if ID is provided
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerService.getCustomerById(customerId!),
    enabled: !!customerId,
  });
  
  // Get products for the order
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getAll(),
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
      transaction_id: "",
      cheque_no: "",
      payment_date: "",
    },
  });
  
  // Get selected customer from form or URL param (after form is declared)
  const selectedCustomerId = form.watch('customer_id') || customerId;
  const selectedCustomer = customer || allCustomers.find((c: any) => c.id === selectedCustomerId);
  
  // Get customer addresses - update when selected customer changes
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ['customer-addresses', selectedCustomerId],
    queryFn: async () => {
      // If we have a selectedCustomerId, fetch the addresses for that customer
      if (selectedCustomerId) {
        try {
          // Use the customer addresses endpoint
          const response = await apiClient.get(`/customer/${selectedCustomerId}/addresses`);
          // API now returns the array directly
          return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
          console.error('Error fetching addresses:', error);
          return [];
        }
      }
      return [];
    },
    enabled: !!selectedCustomerId,
  });
  
  const isLoading = (customerId ? customerLoading : customersLoading) || productsLoading || addressesLoading;
  
  // Watch payment status to conditionally render fields
  const paymentStatus = form.watch("payment_status");
  // Watch payment type for backward compatibility with existing code
  const paymentType = form.watch("payment_type");
  // Watch payment method to conditionally render transaction/cheque fields
  const paymentMethod = form.watch("payment_method");
  
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
    const total = items
      .filter(item => item.product_id && item.product_id !== '')
      .reduce((sum, item) => sum + item.line_total, 0);
    setTotalAmount(total);
  }, [items]);
  
  // Fill in customer details when loaded from URL param
  useEffect(() => {
    if (customer && customerId) {
      form.setValue('customer_id', customer.id);
    }
  }, [customer, customerId, form]);
  
  // Update addresses when selected customer changes
  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== customerId) {
      // Clear addresses when customer changes (they will be refetched by the query)
      form.setValue('shipping_address_id', '');
      form.setValue('billing_address_id', '');
    }
  }, [selectedCustomerId, customerId, form]);
  
  // Auto-fill credit period when customer with credit period is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.credit_period_days && 
        (paymentStatus === 'full_credit' || paymentStatus === 'partial_payment')) {
      const currentCreditPeriod = form.getValues('credit_period');
      // Only auto-fill if not already set or if it exceeds the customer's limit
      if (!currentCreditPeriod || currentCreditPeriod > selectedCustomer.credit_period_days) {
        form.setValue('credit_period', selectedCustomer.credit_period_days);
      }
    }
  }, [selectedCustomer, paymentStatus, form]);
  
  // Set default address if available
  useEffect(() => {
    if (addresses.length > 0) {
      // Look for a default address
      const defaultAddress = addresses.find(addr => addr.is_default);
      
      if (defaultAddress) {
        form.setValue('shipping_address_id', defaultAddress.id);
        form.setValue('billing_address_id', defaultAddress.id);
        setUseSameAsShipping(true);
      } else if (addresses[0]) {
        // Use the first address as default if no default address exists
        form.setValue('shipping_address_id', addresses[0].id);
        form.setValue('billing_address_id', addresses[0].id);
        setUseSameAsShipping(true);
      }
    }
  }, [addresses, form]);
  
  // Sync billing address with shipping address when checkbox is checked
  useEffect(() => {
    if (useSameAsShipping) {
      const shippingAddressId = form.getValues('shipping_address_id');
      if (shippingAddressId) {
        form.setValue('billing_address_id', shippingAddressId);
      }
    }
  }, [useSameAsShipping, form.watch('shipping_address_id'), form]);
  
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
    queryClient.invalidateQueries({ queryKey: ['customer-addresses', selectedCustomerId] });
    
    // Set the new address as the shipping/billing address after a small delay to ensure the data is refetched
    setTimeout(() => {
      if (address?.id) {
        form.setValue('shipping_address_id', address.id);
        form.setValue('billing_address_id', address.id);
      }
    }, 500);
  };
  
  // Add a new empty row
  const addRow = () => {
    setItems([
      ...items,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        product_id: '',
        variant_id: null,
        variant_name: '',
        product_name: '',
        product_code: '',
        hsn_code: '',
        unit: '',
        tax_percentage: 0,
        quantity: 1,
        unit_price: 0,
        original_price: 0,
        line_total: 0,
        discount: 0,
        warehouse_id: warehouses.length > 0 ? warehouses[0].id : undefined
      }
    ]);
  };

  // Fetch variants for a product
  const fetchVariantsForProduct = async (productId: string) => {
    if (productVariants[productId]) {
      return productVariants[productId];
    }
    try {
      const variants = await variantsService.getByProduct(productId);
      setProductVariants(prev => ({ ...prev, [productId]: variants }));
      return variants;
    } catch (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
  };
    
  // Update product for a specific row
  const updateProductForRow = async (rowId: string, productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    // Fetch variants for this product
    const variants = await fetchVariantsForProduct(productId);
    
    // Use default variant if available, otherwise use product-level data
    const defaultVariant = variants.find((v: any) => v.is_default) || variants[0];
    
    let price = 0;
    let originalPrice = 0;
    let taxPercentage = 0;
    let hsnCode = '';
    let unit = 'piece';
    let variantId: string | null = null;
    let variantName = '';

    if (defaultVariant) {
      variantId = defaultVariant.id;
      variantName = defaultVariant.name;
      price = defaultVariant.price?.sale_price || product.sale_price || product.price || 0;
      originalPrice = price;
      taxPercentage = defaultVariant.tax?.rate || product.tax || 0;
      hsnCode = defaultVariant.hsn || product.hsn_code || '';
      unit = defaultVariant.unit_type || product.unit_type || 'piece';
    } else {
      // Fallback to product-level data
      price = product.sale_price || product.price || 0;
      originalPrice = price;
      taxPercentage = product.tax || 0;
      hsnCode = product.hsn_code || '';
      unit = product.unit_type || 'piece';
    }
    
    setItems(items.map(item => {
      if (item.id === rowId) {
        // Calculate line total with tax (consistent with other update functions)
        const taxAmount = (item.quantity * price * taxPercentage) / 100;
        const lineTotal = (item.quantity * price) + taxAmount;
        return {
          ...item,
        product_id: product.id,
          variant_id: variantId,
          variant_name: variantName,
        product_name: product.name,
          product_code: product.product_code || '',
          hsn_code: hsnCode,
          unit: unit,
          tax_percentage: taxPercentage,
          unit_price: price,
          original_price: originalPrice,
          line_total: lineTotal,
        image_url: product.image_url,
        origin: product.origin,
          stock_count: product.stock_count
        };
      }
      return item;
    }));
  };

  // Update variant for a specific row
  const updateVariantForRow = (rowId: string, variantId: string) => {
    const item = items.find(i => i.id === rowId);
    if (!item || !item.product_id) return;

    const variants = productVariants[item.product_id] || [];
    const variant = variants.find((v: any) => v.id === variantId);
    if (!variant) return;

    const price = variant.price?.sale_price || 0;
    const taxPercentage = variant.tax?.rate || 0;
    const hsnCode = variant.hsn || '';
    const unit = variant.unit_type || 'piece';

    setItems(items.map(i => {
      if (i.id === rowId) {
        // Calculate line total with tax (consistent with other update functions)
        const taxAmount = (i.quantity * price * taxPercentage) / 100;
        const lineTotal = (i.quantity * price) + taxAmount;
        return {
          ...i,
          variant_id: variant.id,
          variant_name: variant.name,
          hsn_code: hsnCode,
          unit: unit,
          tax_percentage: taxPercentage,
          unit_price: price,
          original_price: price,
          line_total: lineTotal
        };
      }
      return i;
    }));
  };

  // Update quantity
  const updateQuantity = (rowId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === rowId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        const taxAmount = (newQuantity * item.unit_price * (item.tax_percentage || 0)) / 100;
        return {
          ...item,
          quantity: newQuantity,
          line_total: (newQuantity * item.unit_price) + taxAmount
        };
      }
      return item;
    }));
  };
  
  // Update quantity by direct input
  const updateQuantityDirect = (rowId: string, quantity: number) => {
    setItems(items.map(item => {
      if (item.id === rowId) {
        const newQuantity = Math.max(1, quantity);
        const taxAmount = (newQuantity * item.unit_price * (item.tax_percentage || 0)) / 100;
        return {
          ...item,
          quantity: newQuantity,
          line_total: (newQuantity * item.unit_price) + taxAmount
        };
      }
      return item;
    }));
  };

  // Update price
  const updatePrice = (rowId: string, price: number) => {
    setItems(items.map(item => {
      if (item.id === rowId) {
        const taxAmount = (item.quantity * price * (item.tax_percentage || 0)) / 100;
        const newLineTotal = (item.quantity * price) + taxAmount;
    
    // Calculate discount percentage if price is different from original
        let discount = 0;
        if (item.original_price > 0 && price < item.original_price) {
          const discountAmount = item.original_price - price;
          discount = (discountAmount / item.original_price) * 100;
    }
    
        return {
          ...item,
          unit_price: price,
          line_total: newLineTotal,
          discount: discount
        };
      }
      return item;
    }));
  };

  // Update warehouse for an item
  const updateWarehouse = (rowId: string, warehouseId: string) => {
    setItems(items.map(item => {
      if (item.id === rowId) {
        return { ...item, warehouse_id: warehouseId };
      }
      return item;
    }));
  };
  
  // Remove item
  const removeItem = (rowId: string) => {
    setItems(items.filter(item => item.id !== rowId));
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
    onSuccess: (response, variables) => { // Add response and variables to onSuccess
      console.log('Order creation API response in onSuccess:', response);
      const orderCustomerId = variables.customer_id; // Use customer_id from the form data
      queryClient.invalidateQueries({ queryKey: ['customerOrders', orderCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created successfully');
      navigate(`/sales/customers/${orderCustomerId}/orders`);
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
    
    // Filter out items without products selected and format for API
    const validItems = items.filter(item => item.product_id && item.product_id !== '');
    
    if (validItems.length === 0) {
      toast.error('Please add at least one item with a product selected');
      setActiveTab('products');
      return;
    }
    
    // Ensure all items have the price field set correctly and include warehouse_id
    const processedItems: any[] = validItems.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id || undefined,
      quantity: item.quantity,
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
        onClick={() => {
          const currentCustomerId = selectedCustomerId || customerId;
          if (currentCustomerId) {
            navigate(`/sales/customers/${currentCustomerId}/orders`);
          } else {
            navigate('/sales/customers');
        }
        }}
      >
        <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
        Back
      </Button>

      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl lg:text-3xl break-words">Create New Order</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1 break-words">
            {selectedCustomer ? `Creating order for ${selectedCustomer.name}` : 'Select a customer and add products'}
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
                        {customerId ? (
                          // If customerId is provided in URL, show disabled select with customer name
                        <Select 
                            disabled={true}
                            value={field.value}
                        >
                          <SelectTrigger className="text-sm sm:text-base h-9 sm:h-10">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                          <SelectContent>
                              {selectedCustomer && (
                                <SelectItem value={selectedCustomer.id} className="text-sm">
                                  {selectedCustomer.name} {selectedCustomer.email ? `(${selectedCustomer.email})` : ''}
                                </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        ) : (
                          // If no customerId, show searchable combobox
                          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={customerSearchOpen}
                                className="w-full justify-between text-sm sm:text-base h-9 sm:h-10"
                              >
                                {selectedCustomer ? (
                                  <span className="truncate">
                                    {selectedCustomer.name} 
                                    {selectedCustomer.email ? ` (${selectedCustomer.email})` : ''}
                                    {selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ''}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Select customer...</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search customers by name, email, or phone..." 
                                  value={customerSearchQuery}
                                  onValueChange={setCustomerSearchQuery}
                                />
                                <CommandList>
                                  <CommandEmpty>No customer found.</CommandEmpty>
                                  <CommandGroup>
                                    {allCustomers
                                      .filter((cust: any) => {
                                        const query = customerSearchQuery.toLowerCase();
                                        if (!query) return true;
                                        
                                        const nameMatch = cust.name?.toLowerCase().includes(query);
                                        const emailMatch = cust.email?.toLowerCase().includes(query);
                                        const phoneMatch = cust.phone?.toLowerCase().includes(query);
                                        return nameMatch || emailMatch || phoneMatch;
                                      })
                                      .map((cust: any) => (
                                        <CommandItem
                                          key={cust.id}
                                          value={`${cust.name} ${cust.email || ''} ${cust.phone || ''}`}
                                          onSelect={() => {
                                            field.onChange(cust.id);
                                            setCustomerSearchOpen(false);
                                            setCustomerSearchQuery('');
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === cust.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{cust.name}</span>
                                            {cust.email && (
                                              <span className="text-xs text-muted-foreground">{cust.email}</span>
                                            )}
                                            {cust.phone && (
                                              <span className="text-xs text-muted-foreground">{cust.phone}</span>
                                            )}
                                            {cust.credit_period_days && (
                                              <span className="text-xs text-muted-foreground">
                                                Credit: {cust.credit_period_days} days
                                              </span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </FormControl>
                      {selectedCustomer && (
                        <FormDescription className="text-xs sm:text-sm">
                          {selectedCustomer.credit_period_days && (
                            <span>Credit Period: {selectedCustomer.credit_period_days} days</span>
                          )}
                          {selectedCustomer.credit_limit && (
                            <span className="ml-2">Credit Limit: ₹{selectedCustomer.credit_limit.toLocaleString()}</span>
                          )}
                          {selectedCustomer.current_credit !== undefined && (
                            <span className="ml-2">Current Credit: ₹{selectedCustomer.current_credit.toLocaleString()}</span>
                          )}
                        </FormDescription>
                      )}
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
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Order Items ({items.filter(item => item.product_id).length})</CardTitle>
                        <Button onClick={addRow} size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Row
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {items.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            <p>No items added. Click "Add Row" to add products.</p>
                            <Button onClick={addRow} className="mt-4" variant="outline">
                              <Plus className="h-4 w-4 mr-2" />
                              Add First Row
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[150px]">Product Code</TableHead>
                                    <TableHead className="min-w-[200px]">Product Name</TableHead>
                                    <TableHead className="min-w-[150px]">Variant</TableHead>
                                    <TableHead className="min-w-[100px]">HSN Code</TableHead>
                                    <TableHead className="min-w-[80px]">Qty</TableHead>
                                    <TableHead className="min-w-[80px]">Unit</TableHead>
                                    <TableHead className="min-w-[100px]">Price</TableHead>
                                    <TableHead className="min-w-[80px]">Tax %</TableHead>
                                    <TableHead className="min-w-[100px]">Warehouse</TableHead>
                                    <TableHead className="min-w-[120px]">Total</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((item) => {
                                    const taxAmount = item.product_id ? (item.quantity * item.unit_price * (item.tax_percentage || 0)) / 100 : 0;
                                    // Use line_total from item to ensure consistency
                                    const totalWithTax = item.line_total || 0;
                                    return (
                                      <TableRow key={item.id}>
                                        <TableCell className="text-sm">
                                          {item.product_code || '-'}
                                        </TableCell>
                                        <TableCell>
                                          <Popover 
                                            open={productSearchOpen[item.id] || false} 
                                            onOpenChange={(open) => {
                                              setProductSearchOpen(prev => ({ ...prev, [item.id]: open }));
                                              if (!open) {
                                                setProductSearchQuery(prev => ({ ...prev, [item.id]: '' }));
                                              }
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                  <Button 
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={productSearchOpen[item.id] || false}
                                                className="w-full justify-between"
                                  >
                                                {item.product_name ? (
                                                  <span className="truncate">{item.product_name}</span>
                                                ) : (
                                                  <span className="text-muted-foreground">Select product...</span>
                                                )}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0" align="start">
                                              <Command>
                                                <CommandInput 
                                                  placeholder="Search products by name or code..." 
                                                  value={productSearchQuery[item.id] || ''}
                                                  onValueChange={(value) => {
                                                    setProductSearchQuery(prev => ({ ...prev, [item.id]: value }));
                                                  }}
                                                />
                                                <CommandList>
                                                  <CommandEmpty>No product found.</CommandEmpty>
                                                  <CommandGroup>
                                                    {products
                                                      .filter((product: any) => {
                                                        const query = (productSearchQuery[item.id] || '').toLowerCase();
                                                        if (!query) return true;
                                                        
                                                        const nameMatch = product.name?.toLowerCase().includes(query);
                                                        const codeMatch = product.product_code?.toLowerCase().includes(query);
                                                        return nameMatch || codeMatch;
                                                      })
                                                      .map((product: any) => {
                                                        // Check if product is already used in another row
                                                        const isUsedInOtherRow = items.some(
                                                          (i) => i.product_id === product.id && i.id !== item.id
                                                        );
                                                        
                                                        // Get variant information
                                                        const variants = product.variants || [];
                                                        const defaultVariant = variants.find((v: any) => v.is_default) || variants[0];
                                                        const variantCount = variants.length;
                                                        
                                                        // Build variant display text
                                                        let variantInfo = '';
                                                        if (variantCount > 0) {
                                                          if (variantCount === 1) {
                                                            variantInfo = ` - ${defaultVariant.name} (₹${defaultVariant.price?.sale_price || 0})`;
                                                          } else {
                                                            const prices = variants
                                                              .map((v: any) => v.price?.sale_price || 0)
                                                              .filter((p: number) => p > 0);
                                                            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                                                            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                                                            if (minPrice === maxPrice) {
                                                              variantInfo = ` - ${variantCount} variants (₹${minPrice})`;
                                                            } else {
                                                              variantInfo = ` - ${variantCount} variants (₹${minPrice}-₹${maxPrice})`;
                                                            }
                                                          }
                                                        } else {
                                                          // Fallback to product-level price if no variants
                                                          variantInfo = ` - ₹${product.sale_price || product.price || 0}`;
                                                        }
                                                        
                                                        const displayText = `${product.name}${variantInfo}${isUsedInOtherRow ? ' (Already added)' : ''}`;
                                                        
                                                        return (
                                                          <CommandItem
                                                            key={product.id}
                                                            value={displayText}
                                                            disabled={isUsedInOtherRow}
                                                            onSelect={async () => {
                                                              await updateProductForRow(item.id, product.id);
                                                              setProductSearchOpen(prev => ({ ...prev, [item.id]: false }));
                                                              setProductSearchQuery(prev => ({ ...prev, [item.id]: '' }));
                                                            }}
                                                          >
                                                            <Check
                                                              className={cn(
                                                                "mr-2 h-4 w-4",
                                                                item.product_id === product.id ? "opacity-100" : "opacity-0"
                                                              )}
                                                            />
                                                            <div className="flex items-center gap-2">
                                                              <Package className="h-4 w-4 text-muted-foreground" />
                                                              <span className="flex-1">{displayText}</span>
                                    </div>
                                                          </CommandItem>
                                                        );
                                                      })}
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                        <TableCell>
                                          {item.product_id ? (
                                      <Select
                                              value={item.variant_id || ''}
                                              onValueChange={(variantId) => updateVariantForRow(item.id, variantId)}
                                      >
                                              <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select variant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                                {(productVariants[item.product_id] || []).map((variant: any) => (
                                                  <SelectItem key={variant.id} value={variant.id}>
                                                    {variant.name} {variant.is_default && '(Default)'} - ₹{variant.price?.sale_price || 0}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">Select product first</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                          {item.hsn_code || '-'}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => updateQuantity(item.id, -1)}
                                              disabled={!item.product_id}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                    <Input
                                      type="number"
                                              value={item.quantity}
                                              onChange={(e) => updateQuantityDirect(item.id, parseInt(e.target.value) || 1)}
                                              className="h-8 w-16 text-center text-sm"
                                              min="1"
                                              step="1"
                                              disabled={!item.product_id}
                                            />
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => updateQuantity(item.id, 1)}
                                              disabled={!item.product_id}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                      </div>
                                  </TableCell>
                                        <TableCell className="text-sm">
                                          {item.unit || '-'}
                                        </TableCell>
                                        <TableCell>
                                      <Input
                                        type="number"
                                            value={item.unit_price}
                                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                            className="h-8 w-24 text-sm"
                                            min="0"
                                            step="0.01"
                                            disabled={!item.product_id}
                                      />
                                    </TableCell>
                                        <TableCell className="text-sm">
                                          {item.tax_percentage ? `${item.tax_percentage}%` : '-'}
                                        </TableCell>
                                        <TableCell>
                                      {warehousesLoading ? (
                                        <div className="text-xs text-muted-foreground">Loading...</div>
                                      ) : (
                                        <Select
                                          value={item.warehouse_id || ''}
                                              onValueChange={(value) => updateWarehouse(item.id, value)}
                                        >
                                              <SelectTrigger className="w-full h-8 text-xs">
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
                                        <TableCell className="font-medium text-sm">
                                          {item.product_id ? `₹${totalWithTax.toFixed(2)}` : '-'}
                                    </TableCell>
                                        <TableCell>
                                      <Button 
                                        variant="ghost" 
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => removeItem(item.id)}
                                      >
                                            <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                    );
                                  })}
                            </TableBody>
                          </Table>
                        </div>
                            <div className="flex justify-between items-center pt-4 border-t">
                              <Button onClick={addRow} variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Row
                              </Button>
                              <div className="flex justify-between font-bold text-lg min-w-[200px]">
                                <span>Total:</span>
                                <span>₹{totalAmount.toFixed(2)}</span>
                        </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                        
                            {items.length > 0 && (
                      <div className="flex justify-end mt-4">
                                <Button
                                  type="button"
                                  onClick={() => setActiveTab('checkout')}
                            className="text-sm sm:text-base"
                                >
                                  Continue to Checkout
                                </Button>
                              </div>
                            )}
                        </TabsContent>
                        
                  <TabsContent value="checkout" className="w-full min-w-0">
                          {showAddressForm && (
                            <Card className="mb-4 sm:mb-6 p-3 sm:p-4 w-full min-w-0 overflow-hidden">
                              <CardContent className="p-0">
                                {selectedCustomerId ? (
                                <CustomerAddressForm
                                    customerId={selectedCustomerId}
                                  onClose={() => setShowAddressForm(false)}
                                  onAddressAdded={handleAddressAdded}
                                />
                                ) : (
                                  <div className="p-4 text-center text-muted-foreground">
                                    <p className="text-sm">Please select a customer first before adding an address.</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowAddressForm(false)}
                                      className="mt-4"
                                    >
                                      Close
                                    </Button>
                                  </div>
                                )}
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
                                            onValueChange={(value) => {
                                              field.onChange(value);
                                              // If "use same as shipping" is checked, update billing too
                                              if (useSameAsShipping) {
                                                form.setValue('billing_address_id', value);
                                              }
                                            }}
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
                                
                                {/* Billing Address */}
                                <FormField
                                  control={form.control}
                                  name="billing_address_id"
                                  render={({ field }) => (
                              <FormItem className="space-y-2 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <FormLabel className="text-xs sm:text-sm">Billing Address</FormLabel>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="use-same-address"
                                      checked={useSameAsShipping}
                                      onCheckedChange={(checked) => {
                                        setUseSameAsShipping(checked as boolean);
                                        if (checked) {
                                          const shippingId = form.getValues('shipping_address_id');
                                          if (shippingId) {
                                            field.onChange(shippingId);
                                          }
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor="use-same-address"
                                      className="text-xs sm:text-sm font-normal cursor-pointer"
                                    >
                                      Same as shipping
                                    </label>
                                  </div>
                                </div>
                                <div className="space-y-3 sm:space-y-4">
                                        {addressesLoading ? (
                                    <div className="text-xs sm:text-sm">Loading addresses...</div>
                                        ) : addresses.length === 0 ? (
                                    <div className="text-xs sm:text-sm text-muted-foreground">No addresses found</div>
                                        ) : (
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            value={field.value}
                                            disabled={useSameAsShipping}
                                      className="flex flex-col space-y-2.5 sm:space-y-3"
                                          >
                                            {addresses.map(address => (
                                        <div className={`flex items-start space-x-2.5 sm:space-x-3 border p-3 sm:p-4 rounded-md min-w-0 ${useSameAsShipping ? 'opacity-50' : ''}`} key={address.id}>
                                          <RadioGroupItem value={address.id} id={`billing-${address.id}`} className="mt-0.5 flex-shrink-0" />
                                                <label 
                                                  htmlFor={`billing-${address.id}`}
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
                                        
                                        {!useSameAsShipping && (
                                          <Button 
                                            type="button" 
                                            variant="outline"
                                            onClick={() => setShowAddressForm(true)}
                                    className="w-full text-xs sm:text-sm h-9 sm:h-10"
                                          >
                                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                            Add New Address
                                          </Button>
                                        )}
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
                                    <SelectItem value="bank_transfer" className="text-sm">Bank Transfer</SelectItem>
                                    <SelectItem value="neft" className="text-sm">NEFT</SelectItem>
                                    <SelectItem value="rtgs" className="text-sm">RTGS</SelectItem>
                                    <SelectItem value="upi" className="text-sm">UPI</SelectItem>
                                      </SelectContent>
                                    </Select>
                                <FormDescription className="text-xs sm:text-sm">
                                      How will the customer make the payment?
                                    </FormDescription>
                                <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                  
                              {/* Cheque Number and Payment Date - Only show when payment method is cheque */}
                              {paymentMethod === 'cheque' && (paymentStatus === 'full_payment' || paymentStatus === 'partial_payment') && (
                                <>
                                  <FormField
                                    control={form.control}
                                    name="cheque_no"
                                    render={({ field }) => (
                                      <FormItem className="min-w-0">
                                        <FormLabel className="text-xs sm:text-sm">Cheque Number *</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Enter cheque number"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormDescription className="text-xs sm:text-sm">
                                          Enter the cheque number
                                        </FormDescription>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="payment_date"
                                    render={({ field }) => (
                                      <FormItem className="min-w-0">
                                        <FormLabel className="text-xs sm:text-sm">Payment Date *</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormDescription className="text-xs sm:text-sm">
                                          Date when the cheque was issued
                                        </FormDescription>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}
                              
                              {/* Transaction ID and Payment Date - Only show when payment method is bank transfer, NEFT, RTGS, or UPI */}
                              {(paymentMethod === 'bank_transfer' || paymentMethod === 'neft' || paymentMethod === 'rtgs' || paymentMethod === 'upi') && 
                               (paymentStatus === 'full_payment' || paymentStatus === 'partial_payment') && (
                                <>
                                  <FormField
                                    control={form.control}
                                    name="transaction_id"
                                    render={({ field }) => (
                                      <FormItem className="min-w-0">
                                        <FormLabel className="text-xs sm:text-sm">Transaction ID / Reference Number *</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Enter transaction ID or reference number"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormDescription className="text-xs sm:text-sm">
                                          Enter the transaction reference number
                                        </FormDescription>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="payment_date"
                                    render={({ field }) => (
                                      <FormItem className="min-w-0">
                                        <FormLabel className="text-xs sm:text-sm">Payment Date *</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            className="text-sm sm:text-base h-9 sm:h-10"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormDescription className="text-xs sm:text-sm">
                                          Date when the transaction occurred
                                        </FormDescription>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}
                  
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
                                        max={selectedCustomer?.credit_period_days || 30}
                                        placeholder={`Max: ${selectedCustomer?.credit_period_days || 30} days`}
                                      className="text-sm sm:text-base h-9 sm:h-10"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          if (value <= (selectedCustomer?.credit_period_days || 30)) {
                                            field.onChange(value);
                                          }
                                        }}
                                        value={field.value === undefined ? '' : field.value}
                                      />
                        </FormControl>
                                  <FormDescription className="text-xs sm:text-sm">
                                        Number of days until payment is due (Maximum: {selectedCustomer?.credit_period_days || 30} days)
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