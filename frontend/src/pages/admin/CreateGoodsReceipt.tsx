import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
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
import { ArrowLeft, Plus, Minus, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { warehousesService } from '@/api/warehouses';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/utils/errorHandler';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreateGoodsReceipt() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('po');
  const queryClient = useQueryClient();
  const { isAdmin, hasWarehouseAccess } = useAuth();

  const [purchaseOrderId, setPurchaseOrderId] = useState(poId || '');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    purchase_order_item_id: string;
    product_id: string;
    variant_id?: string | null;
    variant_name?: string;
    product_name: string;
    product_code?: string;
    hsn_code?: string;
    unit?: string;
    tax_percentage?: number;
    ordered_quantity: number;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected: number;
    unit_price: number;
    batch_number: string;
    expiry_date: string;
    condition_notes: string;
  }>>([]);

  // Fetch purchase orders - GRNs can be created for approved, ordered, or partially_received POs
  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders-for-grn'],
    queryFn: () => purchaseOrdersService.getAll(),
  });

  // Filter to only show POs that allow GRN creation (approved, ordered, partially_received)
  const purchaseOrders = allPurchaseOrders.filter((po: any) => 
    ['approved', 'ordered', 'partially_received'].includes(po.status)
  );

  // Fetch existing GRN if in edit mode
  const { data: existingGRN, isLoading: isLoadingGRN } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => goodsReceiptsService.getById(id!),
    enabled: isEditMode && !!id,
  });

  // Fetch selected purchase order
  const { data: selectedPO } = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => purchaseOrdersService.getById(purchaseOrderId),
    enabled: !!purchaseOrderId,
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

  // Load existing GRN data when in edit mode
  useEffect(() => {
    if (existingGRN && isEditMode) {
      setPurchaseOrderId(existingGRN.purchase_order_id);
      setWarehouseId(existingGRN.warehouse_id);
      setReceiptDate(existingGRN.receipt_date || new Date().toISOString().split('T')[0]);
      setInspectionNotes(existingGRN.inspection_notes || '');
      setNotes(existingGRN.notes || '');
      
      if (existingGRN.goods_receipt_items && existingGRN.goods_receipt_items.length > 0) {
        const grnItems = existingGRN.goods_receipt_items.map((item: any) => ({
          purchase_order_item_id: item.purchase_order_item_id,
          product_id: item.product_id,
          variant_id: item.variant_id || item.purchase_order_items?.variant_id || null,
          variant_name: item.variants?.name || item.purchase_order_items?.variants?.name || '',
          product_name: item.products?.name || item.purchase_order_items?.products?.name || 'Product',
          product_code: item.product_code || item.products?.product_code || item.purchase_order_items?.product_code || '',
          hsn_code: item.hsn_code || item.products?.hsn_code || item.purchase_order_items?.hsn_code || '',
          unit: item.unit || item.products?.unit_type || item.purchase_order_items?.unit || 'piece',
          tax_percentage: item.tax_percentage || item.products?.tax || item.purchase_order_items?.tax_percentage || 0,
          ordered_quantity: item.purchase_order_items?.quantity || 0,
          quantity_received: item.quantity_received || 0,
          quantity_accepted: item.quantity_accepted || 0,
          quantity_rejected: item.quantity_rejected || 0,
          unit_price: item.unit_price || 0,
          batch_number: item.batch_number || '',
          expiry_date: item.expiry_date || '',
          condition_notes: item.condition_notes || ''
        }));
        setItems(grnItems);
      }
    }
  }, [existingGRN, isEditMode]);

  // Initialize items from purchase order (only in create mode)
  useEffect(() => {
    if (!isEditMode && selectedPO && selectedPO.purchase_order_items) {
      const grnItems = selectedPO.purchase_order_items
        .filter((item: any) => {
          // Only include items that have remaining quantity to receive
          const remaining = item.quantity - (item.received_quantity || 0);
          return remaining > 0;
        })
        .map((item: any) => {
          const remaining = item.quantity - (item.received_quantity || 0);
          return {
            purchase_order_item_id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            variant_name: item.variants?.name || item.variant?.name || '',
            product_name: item.products?.name || 'Product',
            product_code: item.product_code || item.products?.product_code || '',
            hsn_code: item.hsn_code || item.products?.hsn_code || '',
            unit: item.unit || item.products?.unit_type || 'piece',
            tax_percentage: item.tax_percentage || item.products?.tax || 0,
            ordered_quantity: item.quantity,
            quantity_received: remaining,
            quantity_accepted: remaining,
            quantity_rejected: 0,
            unit_price: item.unit_price || 0, // Ensure unit_price is set, default to 0 if missing
            batch_number: '',
            expiry_date: '',
            condition_notes: ''
          };
        });
      setItems(grnItems);
      if (selectedPO.warehouse_id) {
        setWarehouseId(selectedPO.warehouse_id);
      }
    }
  }, [selectedPO, isEditMode]);

  // Create or update GRN mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditMode && id) {
        return goodsReceiptsService.update(id, data);
      }
      return goodsReceiptsService.create(data);
    },
    onSuccess: () => {
      toast.success(isEditMode ? 'Goods receipt updated successfully' : 'Goods receipt created successfully');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate(isEditMode ? `/admin/goods-receipts/${id}` : '/admin/goods-receipts');
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error) || `Failed to ${isEditMode ? 'update' : 'create'} goods receipt`;
      toast.error(errorMessage);
    },
  });

  // Update item quantities
  const updateItemQuantity = (index: number, field: 'quantity_received' | 'quantity_accepted' | 'quantity_rejected', value: number) => {
    setItems(items.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: Math.max(0, value) };
        // Ensure accepted + rejected = received
        if (field === 'quantity_received') {
          updated.quantity_accepted = Math.min(updated.quantity_received, updated.quantity_accepted);
          updated.quantity_rejected = updated.quantity_received - updated.quantity_accepted;
        } else if (field === 'quantity_accepted') {
          updated.quantity_rejected = updated.quantity_received - updated.quantity_accepted;
        } else if (field === 'quantity_rejected') {
          updated.quantity_accepted = updated.quantity_received - updated.quantity_rejected;
        }
        return updated;
      }
      return item;
    }));
  };

  // Handle submit
  const handleSubmit = () => {
    if (!purchaseOrderId) {
      toast.error('Please select a purchase order');
      return;
    }

    if (!warehouseId) {
      toast.error('Please select a warehouse');
      return;
    }

    if (items.length === 0) {
      toast.error('No items to receive');
      return;
    }

    // Filter out items with zero quantity_received and validate required fields
    const validItems = items.filter(item => {
      return item.purchase_order_item_id && 
             item.product_id && 
             item.quantity_received > 0 && 
             item.unit_price !== undefined && 
             item.unit_price !== null;
    });

    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity greater than 0');
      return;
    }

    createMutation.mutate({
      purchase_order_id: purchaseOrderId,
      warehouse_id: warehouseId,
      receipt_date: receiptDate,
      inspection_notes: inspectionNotes || undefined,
      notes: notes || undefined,
      items: validItems.map(item => ({
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
        variant_id: item.variant_id || undefined,
        quantity_received: item.quantity_received,
        quantity_accepted: item.quantity_accepted,
        quantity_rejected: item.quantity_rejected,
        unit_price: item.unit_price,
        batch_number: item.batch_number || undefined,
        expiry_date: item.expiry_date || undefined,
        condition_notes: item.condition_notes || undefined
      }))
    });
  };

  // Show loading state when fetching existing GRN
  if (isEditMode && isLoadingGRN) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading goods receipt...</p>
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
          onClick={() => navigate(isEditMode ? `/admin/goods-receipts/${id}` : '/admin/goods-receipts')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            {isEditMode ? 'Edit Goods Receipt' : 'Create Goods Receipt'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isEditMode ? 'Update goods receipt note (GRN)' : 'Create a new goods receipt note (GRN)'}
          </p>
        </div>
      </div>

      {/* GRN Details - 2 columns */}
      <Card>
        <CardHeader>
          <CardTitle>GRN Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Purchase Order *</Label>
              <Select 
                value={purchaseOrderId} 
                onValueChange={setPurchaseOrderId}
                disabled={isEditMode}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.suppliers?.name || 'Supplier'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  Purchase order cannot be changed in edit mode
                </p>
              )}
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
              <Label>Receipt Date</Label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Inspection Notes</Label>
              <Textarea
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Inspection notes..."
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Received Items - Full width */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Received Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Product Code</TableHead>
                    <TableHead className="min-w-[150px]">Product Name</TableHead>
                    <TableHead className="min-w-[120px]">Variant</TableHead>
                    <TableHead className="min-w-[100px]">HSN Code</TableHead>
                    <TableHead className="min-w-[80px]">Unit</TableHead>
                    <TableHead className="min-w-[80px]">Ordered</TableHead>
                    <TableHead className="min-w-[80px]">Received</TableHead>
                    <TableHead className="min-w-[80px]">Accepted</TableHead>
                    <TableHead className="min-w-[80px]">Rejected</TableHead>
                    <TableHead className="min-w-[100px]">Price</TableHead>
                    <TableHead className="min-w-[100px]">Batch</TableHead>
                    <TableHead className="min-w-[100px]">Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    return (
                      <TableRow key={item.purchase_order_item_id}>
                        <TableCell className="text-sm">{item.product_code || '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.variant_name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{item.hsn_code || '-'}</TableCell>
                        <TableCell className="text-sm">{item.unit || '-'}</TableCell>
                        <TableCell>{item.ordered_quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity_received}
                            onChange={(e) => updateItemQuantity(index, 'quantity_received', parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                            min="0"
                            max={item.ordered_quantity}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity_accepted}
                            onChange={(e) => updateItemQuantity(index, 'quantity_accepted', parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                            min="0"
                            max={item.quantity_received}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity_rejected}
                            onChange={(e) => updateItemQuantity(index, 'quantity_rejected', parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                            min="0"
                            max={item.quantity_received}
                          />
                        </TableCell>
                        <TableCell className="text-sm">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            value={item.batch_number}
                            onChange={(e) => setItems(items.map((it, i) => i === index ? { ...it, batch_number: e.target.value } : it))}
                            placeholder="Batch #"
                            className="w-24 h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => setItems(items.map((it, i) => i === index ? { ...it, expiry_date: e.target.value } : it))}
                            className="w-32 h-8 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Purchase Order Info - Moved below */}
        {selectedPO && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-medium">{selectedPO.po_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedPO.suppliers?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium">₹{selectedPO.total_amount.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(isEditMode ? `/admin/goods-receipts/${id}` : '/admin/goods-receipts')}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || items.length === 0 || (!isEditMode && !purchaseOrderId) || !warehouseId}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {createMutation.isPending 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update GRN' : 'Create GRN')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
