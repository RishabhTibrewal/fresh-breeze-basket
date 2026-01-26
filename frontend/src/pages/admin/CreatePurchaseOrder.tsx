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
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OrderItem {
  id: string; // Unique ID for each row
  product_id: string;
  product_name: string;
  product_code?: string;
  hsn_code?: string;
  unit?: string;
  tax_percentage?: number;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export default function CreatePurchaseOrder() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, warehouses, hasWarehouseAccess } = useAuth();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsConditions, setTermsConditions] = useState('');

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll({ is_active: true }),
  });

  // Fetch warehouses
  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Filter warehouses based on user access
  const availableWarehouses = isAdmin 
    ? allWarehouses 
    : allWarehouses.filter((wh: any) => hasWarehouseAccess(wh.id));

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.getAll(),
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
          id: `row-${item.id}-${Date.now()}`,
          product_id: item.product_id,
          product_name: item.products?.name || '',
          product_code: item.product_code || item.products?.product_code || '',
          hsn_code: item.hsn_code || item.products?.hsn_code || '',
          unit: item.unit || item.products?.unit_type || 'piece',
          tax_percentage: item.tax_percentage || item.products?.tax || 0,
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

  // Add a new empty row
  const addRow = () => {
    setItems([
      ...items,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        product_id: '',
        product_name: '',
        product_code: '',
        hsn_code: '',
        unit: '',
        tax_percentage: 0,
        quantity: 1,
        unit_price: 0,
        line_total: 0
      }
    ]);
  };

  // Update product for a specific row
  const updateProductForRow = (rowId: string, productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const price = product.sale_price || product.price || 0;
    const taxPercentage = product.tax || 0;
    
    setItems(items.map(item => {
      if (item.id === rowId) {
        const lineTotal = item.quantity * price;
        return {
          ...item,
          product_id: product.id,
          product_name: product.name,
          product_code: product.product_code || '',
          hsn_code: product.hsn_code || '',
          unit: product.unit_type || 'piece',
          tax_percentage: taxPercentage,
          unit_price: price,
          line_total: lineTotal
        };
      }
      return item;
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
        return {
          ...item,
          unit_price: price,
          line_total: (item.quantity * price) + taxAmount
        };
      }
      return item;
    }));
  };

  // Remove item
  const removeItem = (rowId: string) => {
    setItems(items.filter(item => item.id !== rowId));
  };

  // Calculate total (only for items with products selected)
  const totalAmount = items
    .filter(item => item.product_id && item.product_id !== '')
    .reduce((sum, item) => sum + item.line_total, 0);

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

    // Filter out items without products selected
    const validItems = items.filter(item => item.product_id && item.product_id !== '');
    
    if (validItems.length === 0) {
      toast.error('Please add at least one item with a product selected');
      return;
    }

    createMutation.mutate({
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      expected_delivery_date: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      terms_conditions: termsConditions || undefined,
      items: validItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }))
    });
  };


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

      {/* Order Details - 2 columns at top */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {availableWarehouses.map((warehouse: any) => (
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
            <div className="md:col-span-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                placeholder="Terms and conditions..."
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
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
                      <TableHead className="min-w-[100px]">HSN Code</TableHead>
                      <TableHead className="min-w-[80px]">Qty</TableHead>
                      <TableHead className="min-w-[80px]">Unit</TableHead>
                      <TableHead className="min-w-[100px]">Price</TableHead>
                      <TableHead className="min-w-[80px]">Tax %</TableHead>
                      <TableHead className="min-w-[120px]">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const taxAmount = item.product_id ? (item.quantity * item.unit_price * (item.tax_percentage || 0)) / 100 : 0;
                      const totalWithTax = item.product_id ? (item.quantity * item.unit_price) + taxAmount : 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            {item.product_code || '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.product_id || ''}
                              onValueChange={(productId) => updateProductForRow(item.id, productId)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product: any) => {
                                  // Check if product is already used in another row
                                  const isUsedInOtherRow = items.some(
                                    (i) => i.product_id === product.id && i.id !== item.id
                                  );
                                  return (
                                    <SelectItem 
                                      key={product.id} 
                                      value={product.id}
                                      disabled={isUsedInOtherRow}
                                    >
                                      {product.name} - ₹{product.sale_price || product.price}
                                      {isUsedInOtherRow && ' (Already added)'}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Summary */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/admin/purchase-orders')}
          >
            Cancel
          </Button>
          <Button
            className="w-full"
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
  );
}
