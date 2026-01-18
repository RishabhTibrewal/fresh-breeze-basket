import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Plus, Trash2, Minus } from "lucide-react";
import { toast } from "sonner";
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { suppliersService } from '@/api/suppliers';
import { warehousesService } from '@/api/warehouses';
import { productsService } from '@/api/products';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import WarehouseStockDisplay from "@/components/products/WarehouseStockDisplay";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export default function CreatePurchaseOrder() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll({ is_active: true }),
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getAll(),
  });

  // Fetch bulk stock data
  const { data: bulkStockData } = useQuery({
    queryKey: ['bulk-product-stock', products.map((p: any) => p.id).join(',')],
    queryFn: () => {
      if (products.length === 0) return {};
      return warehousesService.getBulkProductStock(products.map((p: any) => p.id));
    },
    enabled: products.length > 0,
    staleTime: 30000,
  });

  // Fetch existing purchase order if in edit mode
  const { data: existingPO, isLoading: isLoadingPO } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrdersService.getById(id!),
    enabled: isEditMode && !!id,
  });

  // Load existing purchase order data when available
  useEffect(() => {
    if (existingPO && isEditMode) {
      setSupplierId(existingPO.supplier_id || '');
      setWarehouseId(existingPO.warehouse_id || '');
      setExpectedDeliveryDate(existingPO.expected_delivery_date || '');
      setNotes(existingPO.notes || '');
      setTermsConditions(existingPO.terms_conditions || '');
      
      // Load items from purchase_order_items
      if (existingPO.purchase_order_items && existingPO.purchase_order_items.length > 0) {
        const loadedItems: OrderItem[] = existingPO.purchase_order_items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.products?.name || '',
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          line_total: parseFloat(item.line_total),
        }));
        setItems(loadedItems);
      }
    }
  }, [existingPO, isEditMode]);

  // Create or update purchase order mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditMode && id) {
        return purchaseOrdersService.update(id, data);
      }
      return purchaseOrdersService.create(data);
    },
    onSuccess: () => {
      toast.success(isEditMode ? 'Purchase order updated successfully' : 'Purchase order created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      navigate('/admin/purchase-orders');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} purchase order`);
    },
  });

  // Add product to order
  const addProduct = (product: any) => {
    const existingItem = items.find(item => item.product_id === product.id);
    const price = product.sale_price || product.price || 0;

    if (existingItem) {
      setItems(items.map(item =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              line_total: (item.quantity + 1) * item.unit_price
            }
          : item
      ));
    } else {
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: price,
          line_total: price
        }
      ]);
    }
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          line_total: newQuantity * item.unit_price
        };
      }
      return item;
    }));
  };

  // Update quantity by direct input
  const updateQuantityDirect = (productId: string, quantity: number) => {
    setItems(items.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, quantity);
        return {
          ...item,
          quantity: newQuantity,
          line_total: newQuantity * item.unit_price
        };
      }
      return item;
    }));
  };

  // Update price
  const updatePrice = (productId: string, price: number) => {
    setItems(items.map(item => {
      if (item.product_id === productId) {
        return {
          ...item,
          unit_price: price,
          line_total: item.quantity * price
        };
      }
      return item;
    }));
  };

  // Remove item
  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

  // Handle submit
  const handleSubmit = () => {
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    if (!warehouseId) {
      toast.error('Please select a warehouse');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    createMutation.mutate({
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      expected_delivery_date: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      terms_conditions: termsConditions || undefined,
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }))
    });
  };

  // Filter products
  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading state when fetching existing PO
  if (isEditMode && isLoadingPO) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading purchase order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/purchase-orders')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            {isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create a new purchase order
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Supplier and Warehouse Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_code ? `${supplier.supplier_code} - ` : ''}{supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Warehouse *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  placeholder="Terms and conditions..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {filteredProducts.map((product: any) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => addProduct(product)}
                  >
                    <CardContent className="p-3">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-20 object-cover rounded mb-2"
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
                            bulkStockData={bulkStockData?.[product.id]}
                            compact
                          />
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No items added. Select products to add.
                </div>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Product</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[100px]">Price</TableHead>
                        <TableHead className="w-[100px]">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium text-sm">
                            {item.product_name}
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
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantityDirect(item.product_id, parseInt(e.target.value) || 1)}
                                className="h-8 w-16 text-center text-sm"
                                min="1"
                                step="1"
                              />
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
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                              className="h-8 w-20 text-sm"
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            ₹{item.line_total.toFixed(2)}
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
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/admin/purchase-orders')}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={createMutation.isPending || items.length === 0 || !supplierId || !warehouseId}
            >
              {createMutation.isPending 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update PO' : 'Create PO')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
