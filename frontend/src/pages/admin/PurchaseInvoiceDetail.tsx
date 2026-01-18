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
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { supplierPaymentsService } from '@/api/supplierPayments';
import { uploadsService } from '@/api/uploads';

export default function PurchaseInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      toast.error(error.response?.data?.error || 'Failed to upload invoice file');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'partial':
        return 'secondary';
      case 'paid':
        return 'default';
      case 'overdue':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
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
        <Badge variant={getStatusBadgeVariant(invoice.status)}>
          {invoice.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
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
                  <p className="font-medium">
                    {invoice.purchase_orders?.po_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </p>
                </div>
                {invoice.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {new Date(invoice.due_date).toLocaleDateString()}
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
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.payment_number}</TableCell>
                        <TableCell>
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell className="font-medium">₹{payment.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(payment.status)}>
                            {payment.status.toUpperCase()}
                          </Badge>
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
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
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
                <span className="font-bold">Total:</span>
                <span className="font-bold text-lg">₹{invoice.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Paid:</span>
                <span className="font-medium">₹{invoice.paid_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Balance:</span>
                <span className="font-medium">
                  ₹{(invoice.total_amount - invoice.paid_amount).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={() => navigate(`/admin/supplier-payments/new?invoice=${id}`)}
              >
                Record Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
