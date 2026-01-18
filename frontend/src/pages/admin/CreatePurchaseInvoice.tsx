import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { goodsReceiptsService } from '@/api/goodsReceipts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreatePurchaseInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grnId = searchParams.get('grn');
  const queryClient = useQueryClient();

  const [goodsReceiptId, setGoodsReceiptId] = useState(grnId || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Fetch goods receipts
  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => goodsReceiptsService.getAll({ status: 'completed' }),
  });

  // Fetch selected goods receipt
  const { data: selectedGRN } = useQuery({
    queryKey: ['goods-receipt', goodsReceiptId],
    queryFn: () => goodsReceiptsService.getById(goodsReceiptId),
    enabled: !!goodsReceiptId,
  });

  // Calculate amounts from GRN
  useEffect(() => {
    if (selectedGRN) {
      setSubtotal(selectedGRN.total_received_amount || 0);
      setTaxAmount((selectedGRN.total_received_amount || 0) * 0.05); // 5% tax
    }
  }, [selectedGRN]);

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => purchaseInvoicesService.create(data),
    onSuccess: () => {
      toast.success('Purchase invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      navigate('/admin/purchase-invoices');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create purchase invoice');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goodsReceiptId) {
      toast.error('Please select a goods receipt');
      return;
    }

    const totalAmount = subtotal + taxAmount - discountAmount;

    createMutation.mutate({
      goods_receipt_id: goodsReceiptId,
      purchase_order_id: selectedGRN?.purchase_order_id,
      supplier_invoice_number: supplierInvoiceNumber || undefined,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      notes: notes || undefined,
    });
  };

  const totalAmount = subtotal + taxAmount - discountAmount;

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/purchase-invoices')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Create Purchase Invoice</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create a new purchase invoice from goods receipt
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Goods Receipt *</Label>
                  <Select value={goodsReceiptId} onValueChange={setGoodsReceiptId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select goods receipt" />
                    </SelectTrigger>
                    <SelectContent>
                      {goodsReceipts.map((grn: any) => (
                        <SelectItem key={grn.id} value={grn.id}>
                          {grn.grn_number} - {grn.purchase_orders?.po_number || 'PO'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier Invoice Number</Label>
                  <Input
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="Supplier's invoice number"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice Date *</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
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

            {/* Amounts */}
            <Card>
              <CardHeader>
                <CardTitle>Amounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Subtotal</Label>
                  <Input
                    type="number"
                    value={subtotal}
                    onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label>Tax Amount</Label>
                  <Input
                    type="number"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label>Discount Amount</Label>
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            {selectedGRN && (
              <Card>
                <CardHeader>
                  <CardTitle>GRN Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">GRN Number</p>
                    <p className="font-medium">{selectedGRN.grn_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PO Number</p>
                    <p className="font-medium">{selectedGRN.purchase_orders?.po_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Received</p>
                    <p className="font-medium">₹{selectedGRN.total_received_amount.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/admin/purchase-invoices')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || !goodsReceiptId}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
