import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('po');
  const queryClient = useQueryClient();

  const [purchaseOrderId, setPurchaseOrderId] = useState(poId || '');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    purchase_order_item_id: string;
    product_id: string;
    product_name: string;
    ordered_quantity: number;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected: number;
    unit_price: number;
    batch_number: string;
    expiry_date: string;
    condition_notes: string;
  }>>([]);

  // Fetch purchase orders
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => purchaseOrdersService.getAll({ status: 'approved' }),
  });

  // Fetch selected purchase order
  const { data: selectedPO } = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => purchaseOrdersService.getById(purchaseOrderId),
    enabled: !!purchaseOrderId,
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Initialize items from purchase order
  useEffect(() => {
    if (selectedPO && selectedPO.purchase_order_items) {
      const grnItems = selectedPO.purchase_order_items.map((item: any) => ({
        purchase_order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'Product',
        ordered_quantity: item.quantity,
        quantity_received: item.quantity - (item.received_quantity || 0),
        quantity_accepted: item.quantity - (item.received_quantity || 0),
        quantity_rejected: 0,
        unit_price: item.unit_price,
        batch_number: '',
        expiry_date: '',
        condition_notes: ''
      }));
      setItems(grnItems);
      if (selectedPO.warehouse_id) {
        setWarehouseId(selectedPO.warehouse_id);
      }
    }
  }, [selectedPO]);

  // Create GRN mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => goodsReceiptsService.create(data),
    onSuccess: () => {
      toast.success('Goods receipt created successfully');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate('/admin/goods-receipts');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create goods receipt');
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

    createMutation.mutate({
      purchase_order_id: purchaseOrderId,
      warehouse_id: warehouseId,
      receipt_date: receiptDate,
      inspection_notes: inspectionNotes || undefined,
      notes: notes || undefined,
      items: items.map(item => ({
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
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

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/goods-receipts')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Create Goods Receipt</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create a new goods receipt note (GRN)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* GRN Details */}
          <Card>
            <CardHeader>
              <CardTitle>GRN Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Purchase Order *</Label>
                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
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
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Received Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Rejected</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.purchase_order_item_id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {selectedPO && (
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
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/admin/goods-receipts')}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || items.length === 0 || !purchaseOrderId || !warehouseId}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {createMutation.isPending ? 'Creating...' : 'Create GRN'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
