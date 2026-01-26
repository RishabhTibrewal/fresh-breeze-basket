import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
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
import { ArrowLeft, Zap, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { handleApiError } from '@/utils/errorHandler';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreatePurchaseInvoice() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grnId = searchParams.get('grn');
  const queryClient = useQueryClient();
  const { isAdmin, isAccounts } = useAuth();

  const [goodsReceiptId, setGoodsReceiptId] = useState(grnId || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Fetch existing invoice if in edit mode
  const { data: invoiceToEdit, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ['purchase-invoice', id],
    queryFn: () => purchaseInvoicesService.getById(id!),
    enabled: isEditMode && !!id,
  });

  // Fetch goods receipts (only completed ones, or all if editing)
  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ['goods-receipts', isEditMode],
    queryFn: () => goodsReceiptsService.getAll({ status: isEditMode ? undefined : 'completed' }),
  });

  // Check if selected GRN already has an invoice
  const { data: existingInvoice } = useQuery({
    queryKey: ['invoice-by-grn', goodsReceiptId],
    queryFn: async () => {
      if (!goodsReceiptId) return null;
      const invoices = await purchaseInvoicesService.getAll({});
      return invoices.find((inv: any) => inv.goods_receipt_id === goodsReceiptId) || null;
    },
    enabled: !!goodsReceiptId,
  });

  // Fetch selected goods receipt
  const { data: selectedGRN } = useQuery({
    queryKey: ['goods-receipt', goodsReceiptId],
    queryFn: () => goodsReceiptsService.getById(goodsReceiptId),
    enabled: !!goodsReceiptId,
  });

  // State for invoice items
  const [invoiceItems, setInvoiceItems] = useState<Array<{
    product_id: string;
    product_name: string;
    product_code?: string;
    hsn_code?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_percentage: number;
    tax_amount: number;
    discount_amount: number;
    line_total: number;
  }>>([]);

  // Load existing invoice data when in edit mode
  useEffect(() => {
    if (invoiceToEdit && isEditMode) {
      setGoodsReceiptId(invoiceToEdit.goods_receipt_id || '');
      setSupplierInvoiceNumber(invoiceToEdit.supplier_invoice_number || '');
      setInvoiceDate(invoiceToEdit.invoice_date || new Date().toISOString().split('T')[0]);
      setDueDate(invoiceToEdit.due_date || '');
      setSubtotal(invoiceToEdit.subtotal || 0);
      setTaxAmount(invoiceToEdit.tax_amount || 0);
      setDiscountAmount(invoiceToEdit.discount_amount || 0);
      setNotes(invoiceToEdit.notes || '');
      
      // Load invoice items
      if (invoiceToEdit.purchase_invoice_items && invoiceToEdit.purchase_invoice_items.length > 0) {
        const items = invoiceToEdit.purchase_invoice_items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.products?.name || 'Product',
          product_code: item.product_code || '',
          hsn_code: item.hsn_code || '',
          quantity: item.quantity,
          unit: item.unit || 'piece',
          unit_price: item.unit_price,
          tax_percentage: item.tax_percentage || 0,
          tax_amount: item.tax_amount || 0,
          discount_amount: item.discount_amount || 0,
          line_total: item.line_total,
        }));
        setInvoiceItems(items);
      }
    }
  }, [invoiceToEdit, isEditMode]);

  // Calculate amounts from GRN and load items (only in create mode)
  useEffect(() => {
    if (!isEditMode && selectedGRN && selectedGRN.goods_receipt_items) {
      const items = selectedGRN.goods_receipt_items.map((item: any) => {
        const quantity = item.quantity_accepted || item.quantity_received || 0;
        const unitPrice = item.unit_price || 0;
        const taxPercentage = item.tax_percentage || item.products?.tax || 0;
        const taxAmount = (quantity * unitPrice * taxPercentage) / 100;
        const lineTotal = (quantity * unitPrice) + taxAmount;
        
        return {
          product_id: item.product_id,
          product_name: item.products?.name || 'Product',
          product_code: item.product_code || item.products?.product_code || '',
          hsn_code: item.hsn_code || item.products?.hsn_code || '',
          quantity,
          unit: item.unit || item.products?.unit_type || 'piece',
          unit_price: unitPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          discount_amount: 0,
          line_total: lineTotal,
        };
      });
      setInvoiceItems(items);
      
      // Calculate totals
      const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const calculatedTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
      setSubtotal(calculatedSubtotal);
      setTaxAmount(calculatedTax);
    }
  }, [selectedGRN, isEditMode]);

  // Quick create from GRN mutation
  const quickCreateMutation = useMutation({
    mutationFn: (data: { supplier_invoice_number?: string; invoice_date?: string; due_date?: string; notes?: string }) => {
      return purchaseInvoicesService.createFromGRN({
        goods_receipt_id: goodsReceiptId,
        ...data,
      });
    },
    onSuccess: (invoice) => {
      toast.success('Invoice created successfully from GRN');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-by-grn', goodsReceiptId] });
      navigate(`/admin/purchase-invoices/${invoice.id}`);
    },
    onError: (error: any) => {
      handleApiError(error, 'create invoice from GRN', ['accounts', 'admin']);
    },
  });

  // Create or update invoice mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditMode && id) {
        return purchaseInvoicesService.update(id, data);
      }
      return purchaseInvoicesService.create(data);
    },
    onSuccess: () => {
      toast.success(isEditMode ? 'Purchase invoice updated successfully' : 'Purchase invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', id] });
      navigate(isEditMode ? `/admin/purchase-invoices/${id}` : '/admin/purchase-invoices');
    },
    onError: (error: any) => {
      handleApiError(error, isEditMode ? 'update purchase invoice' : 'create purchase invoice', ['accounts', 'admin']);
    },
  });

  const handleQuickCreate = () => {
    if (!goodsReceiptId) {
      toast.error('Please select a goods receipt');
      return;
    }
    if (selectedGRN?.status !== 'completed') {
      toast.error('GRN must be completed to create invoice');
      return;
    }
    quickCreateMutation.mutate({
      supplier_invoice_number: supplierInvoiceNumber || undefined,
      invoice_date: invoiceDate || undefined,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode && !goodsReceiptId) {
      toast.error('Please select a goods receipt');
      return;
    }

    const totalAmount = subtotal + taxAmount - discountAmount;

    const submitData: any = {
      supplier_invoice_number: supplierInvoiceNumber || undefined,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      notes: notes || undefined,
    };

    // Only include goods_receipt_id and purchase_order_id in create mode
    if (!isEditMode) {
      submitData.goods_receipt_id = goodsReceiptId;
      submitData.purchase_order_id = selectedGRN?.purchase_order_id;
    }

    // Include invoice items
    submitData.items = invoiceItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      tax_percentage: item.tax_percentage,
      tax_amount: item.tax_amount,
      discount_amount: item.discount_amount,
      product_code: item.product_code,
      hsn_code: item.hsn_code
    }));

    createMutation.mutate(submitData);
  };

  // Update invoice item
  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const updatedItems = [...invoiceItems];
    const item = updatedItems[index];
    
    if (field === 'quantity') {
      item.quantity = parseFloat(value) || 0;
    } else if (field === 'unit_price') {
      item.unit_price = parseFloat(value) || 0;
    } else if (field === 'tax_percentage') {
      item.tax_percentage = parseFloat(value) || 0;
    } else if (field === 'discount_amount') {
      item.discount_amount = parseFloat(value) || 0;
    }
    
    // Recalculate tax_amount and line_total
    const lineSubtotal = item.quantity * item.unit_price;
    item.tax_amount = (lineSubtotal * item.tax_percentage) / 100;
    item.line_total = lineSubtotal + item.tax_amount - item.discount_amount;
    
    updatedItems[index] = item;
    setInvoiceItems(updatedItems);
    
    // Recalculate totals
    const newSubtotal = updatedItems.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const newTaxAmount = updatedItems.reduce((sum, it) => sum + it.tax_amount, 0);
    const newDiscountAmount = updatedItems.reduce((sum, it) => sum + it.discount_amount, 0);
    setSubtotal(newSubtotal);
    setTaxAmount(newTaxAmount);
    setDiscountAmount(newDiscountAmount);
  };

  const totalAmount = subtotal + taxAmount - discountAmount;

  // Show loading state when fetching existing invoice
  if (isEditMode && isLoadingInvoice) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading invoice...</p>
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
          onClick={() => navigate(isEditMode ? `/admin/purchase-invoices/${id}` : '/admin/purchase-invoices')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            {isEditMode ? 'Edit Purchase Invoice' : 'Create Purchase Invoice'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isEditMode ? 'Update purchase invoice details' : 'Create a new purchase invoice from goods receipt'}
          </p>
        </div>
      </div>

      {/* Quick Create from GRN Section - Only show in create mode */}
      {!isEditMode && selectedGRN && selectedGRN.status === 'completed' && !existingInvoice && (isAdmin || isAccounts) && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            <div>
              <p className="font-medium">Quick Create Available</p>
              <p className="text-sm text-muted-foreground">
                This GRN is completed. You can quickly create an invoice with auto-filled data from the GRN.
              </p>
            </div>
            <Button
              onClick={handleQuickCreate}
              disabled={quickCreateMutation.isPending}
              className="ml-4"
            >
              <Zap className="h-4 w-4 mr-2" />
              {quickCreateMutation.isPending ? 'Creating...' : 'Quick Create Invoice'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {existingInvoice && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            <div>
              <p className="font-medium">Invoice Already Exists</p>
              <p className="text-sm">
                An invoice already exists for this GRN.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/purchase-invoices/${existingInvoice.id}`)}
              className="ml-4"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Invoice
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {selectedGRN && selectedGRN.status !== 'completed' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">GRN Not Completed</p>
            <p className="text-sm">
              The selected GRN must be completed before creating an invoice. Current status: <StatusBadge status={selectedGRN.status} />
            </p>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Main Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Goods Receipt *</Label>
                  <Select 
                    value={goodsReceiptId} 
                    onValueChange={setGoodsReceiptId}
                    disabled={isEditMode}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select goods receipt" />
                    </SelectTrigger>
                    <SelectContent>
                      {goodsReceipts.map((grn: any) => (
                        <SelectItem key={grn.id} value={grn.id}>
                          <div className="flex items-center gap-2">
                            <span>{grn.grn_number} - {grn.purchase_orders?.po_number || 'PO'}</span>
                            <StatusBadge status={grn.status} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isEditMode && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Goods receipt cannot be changed in edit mode
                    </p>
                  )}
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

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Items</CardTitle>
              </CardHeader>
              <CardContent>
                {invoiceItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">Product Code</TableHead>
                          <TableHead className="min-w-[150px]">Product Name</TableHead>
                          <TableHead className="min-w-[100px]">HSN Code</TableHead>
                          <TableHead className="min-w-[80px]">Qty</TableHead>
                          <TableHead className="min-w-[80px]">Unit</TableHead>
                          <TableHead className="min-w-[100px]">Price</TableHead>
                          <TableHead className="min-w-[80px]">Tax %</TableHead>
                          <TableHead className="min-w-[100px]">Discount</TableHead>
                          <TableHead className="min-w-[100px]">Tax Amt</TableHead>
                          <TableHead className="min-w-[120px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{item.product_code || '-'}</TableCell>
                            <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                            <TableCell className="text-sm">{item.hsn_code || '-'}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                                className="w-20 h-8 text-sm"
                                min="0"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell className="text-sm">{item.unit}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateInvoiceItem(index, 'unit_price', e.target.value)}
                                className="w-24 h-8 text-sm"
                                min="0"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.tax_percentage}
                                onChange={(e) => updateInvoiceItem(index, 'tax_percentage', e.target.value)}
                                className="w-20 h-8 text-sm"
                                min="0"
                                max="100"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.discount_amount}
                                onChange={(e) => updateInvoiceItem(index, 'discount_amount', e.target.value)}
                                className="w-24 h-8 text-sm"
                                min="0"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell className="text-sm">₹{item.tax_amount.toFixed(2)}</TableCell>
                            <TableCell className="font-medium text-sm">₹{item.line_total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>No items available. Please select a goods receipt to load items.</p>
                  </div>
                )}
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

          {/* Summary and Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2"></div>
            <div className="space-y-4">
              {selectedGRN && (
                <Card>
                  <CardHeader>
                    <CardTitle>GRN Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">GRN Number</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{selectedGRN.grn_number}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => navigate(`/admin/goods-receipts/${selectedGRN.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <StatusBadge status={selectedGRN.status} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">PO Number</p>
                      <p className="font-medium">{selectedGRN.purchase_orders?.po_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Received</p>
                      <p className="font-medium">₹{selectedGRN.total_received_amount?.toFixed(2) || '0.00'}</p>
                    </div>
                    {selectedGRN.receipt_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Receipt Date</p>
                        <p className="font-medium">{new Date(selectedGRN.receipt_date).toLocaleDateString()}</p>
                      </div>
                    )}
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
                      onClick={() => navigate(isEditMode ? `/admin/purchase-invoices/${id}` : '/admin/purchase-invoices')}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createMutation.isPending || (!isEditMode && (!goodsReceiptId || selectedGRN?.status !== 'completed'))}
                    >
                      {createMutation.isPending 
                        ? (isEditMode ? 'Updating...' : 'Creating...') 
                        : (isEditMode ? 'Update Invoice' : 'Create Invoice')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
