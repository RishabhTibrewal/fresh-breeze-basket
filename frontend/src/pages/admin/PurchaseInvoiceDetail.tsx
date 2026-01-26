import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Upload, FileText, ExternalLink, DollarSign, AlertTriangle, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { supplierPaymentsService } from '@/api/supplierPayments';
import { uploadsService } from '@/api/uploads';
import { useAuth } from '@/contexts/AuthContext';
import { handleApiError } from '@/utils/errorHandler';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { ProcurementWorkflow } from '@/components/procurement/ProcurementWorkflow';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PurchaseInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAccounts } = useAuth();

  // Fetch invoice
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['purchase-invoice', id],
    queryFn: () => purchaseInvoicesService.getById(id!),
    enabled: !!id,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['supplier-payments', id],
    queryFn: () => supplierPaymentsService.getAll({ purchase_invoice_id: id }),
    enabled: !!id,
  });

  // Check if invoice is overdue
  const isOverdue = invoice?.due_date && 
    new Date(invoice.due_date) < new Date() && 
    invoice.status !== 'paid' && 
    invoice.status !== 'cancelled';

  const balance = invoice ? invoice.total_amount - invoice.paid_amount : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAdmin && !isAccounts) {
      toast.error('You do not have permission to upload invoice files');
      return;
    }

    try {
      // Upload file
      const uploadResult = await uploadsService.uploadPurchaseInvoice(id!, file);
      
      // Update invoice with file URL
      await purchaseInvoicesService.update(id!, {
        invoice_file_url: uploadResult.url,
      });

      toast.success('Invoice file uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', id] });
    } catch (error: any) {
      handleApiError(error, 'upload invoice file', ['accounts', 'admin']);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="text-center py-8">Invoice not found</div>;
  }

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
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            Invoice: {invoice.invoice_number}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {new Date(invoice.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} />
          {isAdmin && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/purchase-invoices/${invoice.id}/edit`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Overdue Warning */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This invoice is overdue. Due date was {new Date(invoice.due_date!).toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      {/* Workflow Indicator */}
      {invoice.purchase_order_id && (
        <ProcurementWorkflow
          po={{ id: invoice.purchase_order_id, status: invoice.purchase_orders?.status, po_number: invoice.purchase_orders?.po_number }}
          grn={invoice.goods_receipt_id ? { id: invoice.goods_receipt_id, status: invoice.goods_receipts?.status, grn_number: invoice.goods_receipts?.grn_number } : undefined}
          invoice={{ id: invoice.id, status: invoice.status, invoice_number: invoice.invoice_number }}
          payments={payments}
        />
      )}

      <div className="space-y-4">
        {/* Main Details */}
        <div className="space-y-4">
          {/* Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">
                    {invoice.purchase_orders?.suppliers?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {invoice.purchase_orders?.po_number || 'N/A'}
                    </p>
                    {invoice.purchase_order_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => navigate(`/admin/purchase-orders/${invoice.purchase_order_id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {invoice.goods_receipt_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">GRN Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {invoice.goods_receipts?.grn_number || 'N/A'}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => navigate(`/admin/goods-receipts/${invoice.goods_receipt_id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </p>
                </div>
                {invoice.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className={isOverdue ? "font-medium text-red-600" : "font-medium"}>
                      {new Date(invoice.due_date).toLocaleDateString()}
                      {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                    </p>
                  </div>
                )}
                {invoice.supplier_invoice_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier Invoice #</p>
                    <p className="font-medium">{invoice.supplier_invoice_number}</p>
                  </div>
                )}
              </div>
              {invoice.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice File */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.invoice_file_url ? (
                <div>
                  <a
                    href={invoice.invoice_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Invoice File
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No file uploaded</p>
              )}
              {(isAdmin || isAccounts) && (
                <div>
                  <Label htmlFor="invoice-file-upload" className="sr-only">
                    Upload Invoice File
                  </Label>
                  <Input
                    id="invoice-file-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('invoice-file-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {invoice.invoice_file_url ? 'Replace File' : 'Upload File'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.purchase_invoice_items && invoice.purchase_invoice_items.length > 0 ? (
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
                        <TableHead className="min-w-[100px]">Tax Amt</TableHead>
                        <TableHead className="min-w-[120px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.purchase_invoice_items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.product_code || '-'}</TableCell>
                          <TableCell className="font-medium text-sm">
                            {item.products?.name || 'Product'}
                          </TableCell>
                          <TableCell className="text-sm">{item.hsn_code || '-'}</TableCell>
                          <TableCell className="text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-sm">{item.unit || '-'}</TableCell>
                          <TableCell className="text-sm">₹{item.unit_price?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell className="text-sm">{item.tax_percentage ? `${item.tax_percentage}%` : '-'}</TableCell>
                          <TableCell className="text-sm">₹{item.tax_amount?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell className="font-medium text-sm">₹{item.line_total?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No invoice items found.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payments ({payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow 
                        key={payment.id}
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => navigate(`/admin/supplier-payments/${payment.id}`)}
                      >
                        <TableCell className="font-medium">{payment.payment_number}</TableCell>
                        <TableCell>
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell className="font-medium">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          {/* Payment Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal:</span>
                <span className="font-medium">₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tax:</span>
                <span className="font-medium">₹{invoice.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Discount:</span>
                <span className="font-medium">₹{invoice.discount_amount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">Total Amount:</span>
                <span className="font-bold text-lg">₹{invoice.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Paid Amount:</span>
                <span className="font-medium text-green-600">₹{invoice.paid_amount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">Balance:</span>
                <span className={`font-bold text-lg ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{balance.toFixed(2)}
                </span>
              </div>
              <div className="pt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      balance === 0 ? 'bg-green-500' : balance < invoice.total_amount ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(invoice.paid_amount / invoice.total_amount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {((invoice.paid_amount / invoice.total_amount) * 100).toFixed(0)}% Paid
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(isAdmin || isAccounts) && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/admin/supplier-payments/new?invoice=${id}`)}
                  disabled={balance === 0}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              )}
              {balance === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Invoice is fully paid
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
