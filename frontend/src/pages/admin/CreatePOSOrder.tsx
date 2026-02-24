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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Minus, Trash2, ShoppingCart, Printer, X } from "lucide-react";
import { toast } from "sonner";
import apiClient from '@/lib/apiClient';
import { warehousesService } from '@/api/warehouses';
import { productsService } from '@/api/products';
import { invoicesService } from '@/api/invoices';
import WarehouseStockDisplay from "@/components/products/WarehouseStockDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url?: string;
  warehouse_id?: string;
}

export default function CreatePOSOrder() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');

  // Get products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await apiClient.get('/products', {
        params: { limit: 1000, page: 1 }
      });
      return response.data?.success && Array.isArray(response.data.data) 
        ? response.data.data 
        : Array.isArray(response.data) ? response.data : [];
    },
  });

  // Fetch bulk stock data
  const { data: bulkStockData = {} } = useQuery<Record<string, { warehouses: any[], total_stock: number }>>({
    queryKey: ['bulk-product-stock', products.map(p => p.id).join(',')],
    queryFn: () => {
      if (products.length === 0) return {};
      return warehousesService.getBulkProductStock(products.map(p => p.id));
    },
    enabled: products.length > 0,
    staleTime: 30000,
  });

  // Get warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Calculate total
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    setTotalAmount(total);
  }, [items]);

  // Add product to cart
  const addToCart = (product: any) => {
    const existingItem = items.find(item => item.product_id === product.id);
    const price = product.sale_price || product.price;
    
    if (existingItem) {
      setItems(items.map(item =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * item.unit_price
            }
          : item
      ));
    } else {
      // Get default warehouse
      const defaultWarehouse = warehouses.find((w: any) => w.code === 'WH-001');
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: price,
          subtotal: price,
          image_url: product.image_url,
          warehouse_id: defaultWarehouse?.id
        }
      ]);
    }
    toast.success(`${product.name} added to cart`);
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          subtotal: newQuantity * item.unit_price
        };
      }
      return item;
    }));
  };

  // Remove item
  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  // Update warehouse for item
  const updateWarehouse = (productId: string, warehouseId: string) => {
    setItems(items.map(item =>
      item.product_id === productId
        ? { ...item, warehouse_id: warehouseId }
        : item
    ));
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderData = {
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.unit_price,
          unit_price: item.unit_price,
          warehouse_id: item.warehouse_id
        })),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        payment_method: paymentMethod,
        notes: `POS Order - ${new Date().toLocaleString()}`
      };

      const response = await apiClient.post('/pos/orders', orderData);
      return response.data;
    },
    onSuccess: async (data) => {
      toast.success('Order created successfully!');
      
      // Open invoice in new window for printing
      try {
        await invoicesService.printPOSInvoice(data.data.id);
      } catch (error) {
        console.error('Failed to open invoice:', error);
        toast.error('Order created but failed to open invoice');
      }
      
      // Reset form
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create order');
    }
  });

  // Filter products
  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tax = totalAmount * 0.05;
  const finalTotal = totalAmount + tax;

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">POS Order</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create a quick order for walk-in customers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Products Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="text-center py-8">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products found
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {filteredProducts.map((product: any) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-3">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                        )}
                        <h3 className="font-medium text-sm mb-1 line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-xs font-bold text-primary">
                          ₹{product.sale_price || product.price}
                        </p>
                        <div className="mt-2">
                          <WarehouseStockDisplay
                            productId={product.id}
                            bulkStockData={bulkStockData[product.id] as { warehouses: any[], total_stock: number } | undefined}
                            compact
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Info (Optional) */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="customerName">Customer Name (Optional)</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone (Optional)</Label>
                  <Input
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Cart Items */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Cart is empty. Add products to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Item</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[100px]">Price</TableHead>
                        <TableHead className="w-[80px]">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium text-sm">
                            {item.product_name}
                            {warehouses.length > 1 && (
                              <Select
                                value={item.warehouse_id || ''}
                                onValueChange={(value) => updateWarehouse(item.product_id, value)}
                              >
                                <SelectTrigger className="h-7 text-xs mt-1">
                                  <SelectValue placeholder="Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                  {warehouses.map((warehouse: any) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                      {warehouse.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.product_id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.product_id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">₹{item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-sm font-medium">
                            ₹{item.subtotal.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeItem(item.product_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (5%):</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {items.length > 0 && (
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Actions */}
              {items.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => createOrderMutation.mutate()}
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? 'Processing...' : 'Complete Order'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setItems([]);
                      setCustomerName('');
                      setCustomerPhone('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
