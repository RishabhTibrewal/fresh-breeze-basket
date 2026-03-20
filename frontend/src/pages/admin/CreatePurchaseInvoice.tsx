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
  const { user, isAdmin, isAccounts } = useAuth();
  const moduleBase = `/${window.location.pathname.split('/')[1]}`;

  const [goodsReceiptId, setGoodsReceiptId] = useState(grnId || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [extraDiscountPct, setExtraDiscountPct] = useState<number>(0);
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
    variant_id?: string | null;
    variant_name?: string;
    product_name: string;
    product_code?: string;
    hsn_code?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_percentage: number;
    tax_amount: number;
    discount_percentage: number;
    discount_amount: number;
    line_total: number;
    goods_receipt_item_id?: string;
  }>>([]);

  // Load existing invoice data when in edit mode
  useEffect(() => {
    if (invoiceToEdit && isEditMode) {
      setGoodsReceiptId(invoiceToEdit.goods_receipt_id || '');
      setSupplierInvoiceNumber(invoiceToEdit.supplier_invoice_number || '');
      setInvoiceDate(invoiceToEdit.invoice_date || new Date().toISOString().split('T')[0]);
      setDueDate(invoiceToEdit.due_date || '');
      setSubtotal(invoiceToEdit.subtotal || 0);
      setTaxAmount(invoiceToEdit.total_tax || 0);
      setDiscountAmount(invoiceToEdit.total_discount - (invoiceToEdit.extra_discount_amount || 0));
      setExtraDiscountPct(invoiceToEdit.extra_discount_percentage !== undefined ? invoiceToEdit.extra_discount_percentage : (invoiceToEdit.purchase_orders?.extra_discount_percentage || 0));
      setExtraDiscount(invoiceToEdit.extra_discount_amount || 0);
      setNotes(invoiceToEdit.notes || '');
      
      // Load invoice items
      if (invoiceToEdit.purchase_invoice_items && invoiceToEdit.purchase_invoice_items.length > 0) {
        const items = invoiceToEdit.purchase_invoice_items.map((item: any) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || item.goods_receipt_items?.variant_id || null,
          variant_name: item.variants?.name || item.goods_receipt_items?.variants?.name || '',
          product_name: item.products?.name || 'Product',
          product_code: item.product_code || '',
          hsn_code: item.hsn_code || '',
          quantity: item.quantity,
          unit: item.unit || 'piece',
          unit_price: item.unit_price,
          tax_percentage: item.tax_percentage || 0,
          tax_amount: item.tax_amount || 0,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          line_total: item.line_total,
          goods_receipt_item_id: item.goods_receipt_item_id,
        }));
        setInvoiceItems(items);
      }
    }
  }, [invoiceToEdit, isEditMode]);

  // Calculate amounts from GRN and load items (only in create mode)
  // Only use accepted quantity for invoicing (rejected items should not be invoiced)
  useEffect(() => {
    if (!isEditMode && selectedGRN && selectedGRN.goods_receipt_items) {
      const items = selectedGRN.goods_receipt_items
        .filter((item: any) => (item.quantity_accepted || 0) > 0) // Only include items with accepted quantity
        .map((item: any) => {
          // Use only accepted quantity - rejected items should not be invoiced
          const quantity = item.quantity_accepted || 0;
          const unitPrice = item.unit_price || 0;
          const taxPercentage = item.tax_percentage || item.products?.tax || 0;
          const discountPercentage = item.purchase_order_items?.discount_percentage || 0;
          
          const lineSubtotal = quantity * unitPrice;
          const taxAmount = Math.round(((lineSubtotal * taxPercentage) / 100) * 100) / 100;
          const discountAmount = Math.round(((lineSubtotal * discountPercentage) / 100) * 100) / 100;
          const lineTotal = Math.round((lineSubtotal + taxAmount - discountAmount) * 100) / 100;
          
          return {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            variant_name: item.variants?.name || '',
            product_name: item.products?.name || 'Product',
            product_code: item.product_code || item.products?.product_code || '',
            hsn_code: item.hsn_code || item.products?.hsn_code || '',
            quantity,
            unit: item.unit || item.products?.unit_type || 'piece',
            unit_price: unitPrice,
            tax_percentage: taxPercentage,
            tax_amount: taxAmount,
            discount_percentage: discountPercentage,
            discount_amount: discountAmount,
            line_total: lineTotal,
            goods_receipt_item_id: item.id, // Include GRN item ID for traceability
          };
        });
      setInvoiceItems(items);
      
      // Calculate totals based on accepted quantities and discounts
      const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const calculatedTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
      const calculatedDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
      
      setSubtotal(calculatedSubtotal);
      setTaxAmount(calculatedTax);
      setDiscountAmount(calculatedDiscount);

      // Default extra discount % from PO
      if (selectedGRN.purchase_orders?.extra_discount_percentage) {
        setExtraDiscountPct(selectedGRN.purchase_orders.extra_discount_percentage);
      }
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
      navigate(`${moduleBase}/purchase-invoices/${invoice.id}`);
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
      navigate(isEditMode ? `${moduleBase}/purchase-invoices/${id}` : `${moduleBase}/purchase-invoices`);
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

  const calculateGrandTotal = () => {
    const itemsTotal = subtotal + taxAmount - discountAmount;
    const extraPctAmt = Math.round(((itemsTotal * (extraDiscountPct || 0)) / 100) * 100) / 100;
    return Math.max(0, itemsTotal - extraPctAmt - (extraDiscount || 0));
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
      total_tax: taxAmount,
      total_discount: Math.round((discountAmount + (extraDiscountPct > 0 ? (subtotal + taxAmount - discountAmount) * extraDiscountPct / 100 : extraDiscount)) * 100) / 100,
      extra_discount_percentage: extraDiscountPct,
      extra_discount_amount: extraDiscountPct > 0 ? Math.round(((subtotal + taxAmount - discountAmount) * extraDiscountPct / 100) * 100) / 100 : extraDiscount,
      total_amount: Math.round(calculateGrandTotal() * 100) / 100,
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
      variant_id: item.variant_id || undefined,
      goods_receipt_item_id: item.goods_receipt_item_id || undefined,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      tax_percentage: item.tax_percentage,
      tax_amount: item.tax_amount,
      discount_percentage: item.discount_percentage,
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
    } else if (field === 'discount_percentage') {
      item.discount_percentage = parseFloat(value) || 0;
    }
    
    // Recalculate tax_amount, discount_amount and line_total
    const lineSubtotal = item.quantity * item.unit_price;
    item.tax_amount = Math.round(((lineSubtotal * item.tax_percentage) / 100) * 100) / 100;
    item.discount_amount = Math.round(((lineSubtotal * item.discount_percentage) / 100) * 100) / 100;
    item.line_total = Math.round((lineSubtotal + item.tax_amount - item.discount_amount) * 100) / 100;
    
    updatedItems[index] = item;
    setInvoiceItems(updatedItems);
    
    // Recalculate totals
    const newSubtotal = Math.round(updatedItems.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0) * 100) / 100;
    const newTaxAmount = Math.round(updatedItems.reduce((sum, it) => sum + it.tax_amount, 0) * 100) / 100;
    const newDiscountAmount = Math.round(updatedItems.reduce((sum, it) => sum + it.discount_amount, 0) * 100) / 100;
    setSubtotal(newSubtotal);
    setTaxAmount(newTaxAmount);
    setDiscountAmount(newDiscountAmount);
  };

  const totalAmount = calculateGrandTotal();

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
          onClick={() => navigate(-1)}
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
              onClick={() => navigate(`${moduleBase}/purchase-invoices/${existingInvoice.id}`)}
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
                          <TableHead className="min-w-[120px]">Variant</TableHead>
                          <TableHead className="min-w-[100px]">HSN Code</TableHead>
                          <TableHead className="min-w-[80px]">Qty</TableHead>
                          <TableHead className="min-w-[80px]">Unit</TableHead>
                          <TableHead className="min-w-[100px]">Price</TableHead>
                          <TableHead className="min-w-[80px]">Tax %</TableHead>
                          <TableHead className="min-w-[80px]">Disc %</TableHead>
                          <TableHead className="min-w-[100px]">Tax Amt</TableHead>
                          <TableHead className="min-w-[120px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{item.product_code || '-'}</TableCell>
                            <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.variant_name || '-'}
                            </TableCell>
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
                                value={item.discount_percentage}
                                onChange={(e) => updateInvoiceItem(index, 'discount_percentage', e.target.value)}
                                className="w-20 h-8 text-sm"
                                min="0"
                                max="100"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Extra Discount (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="0"
                    value={extraDiscountPct || ''} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setExtraDiscountPct(val);
                      if (val > 0) setExtraDiscount(0);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Extra Discount (Fixed)</Label>
                  <Input 
                    type="number" 
                    placeholder="0"
                    value={extraDiscount || ''} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setExtraDiscount(val);
                      if (val > 0) setExtraDiscountPct(0);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="text-red-500">+₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item Discount:</span>
                  <span className="text-green-600">-₹{discountAmount.toFixed(2)}</span>
                </div>
                {(extraDiscountPct > 0 || extraDiscount > 0) && (
                  <div className="flex justify-between text-sm text-green-600 font-medium italic border-b pb-1">
                    <span>
                      Extra Discount 
                      {extraDiscountPct > 0 ? ` (${extraDiscountPct}%)` : ''}:
                    </span>
                    <span>
                      -₹{extraDiscountPct > 0 
                        ? (( (subtotal + taxAmount - discountAmount) * extraDiscountPct) / 100).toFixed(2)
                        : extraDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xl pt-2 border-t mt-2 text-primary">
                  <span>Grand Total:</span>
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
                          className="h-6 w-6 ml-2"
                          onClick={() => navigate(`${moduleBase}/goods-receipts/${selectedGRN.id}`)}
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
                      onClick={() => navigate(-1)}
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
