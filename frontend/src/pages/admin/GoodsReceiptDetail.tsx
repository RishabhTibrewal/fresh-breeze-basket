import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, FileText, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { useAuth } from '@/contexts/AuthContext';
import { handleApiError } from '@/utils/errorHandler';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { StatusTransitionButton } from '@/components/procurement/StatusTransitionButton';
import { ProcurementWorkflow } from '@/components/procurement/ProcurementWorkflow';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAccounts, isWarehouseManager, hasAnyRole } = useAuth();

  const { data: grn, isLoading } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => goodsReceiptsService.getById(id!),
    enabled: !!id,
  });

  // Fetch related PO
  const { data: purchaseOrder } = useQuery({
    queryKey: ['purchase-order', grn?.purchase_order_id],
    queryFn: () => grn?.purchase_order_id ? goodsReceiptsService.getAll({ purchase_order_id: grn.purchase_order_id }).then(() => null) : null,
    enabled: !!grn?.purchase_order_id,
  });

  // Fetch related invoice
  const { data: relatedInvoice } = useQuery({
    queryKey: ['purchase-invoice-by-grn', id],
    queryFn: async () => {
      if (!id) return null;
      const invoices = await purchaseInvoicesService.getAll({});
      return invoices.find((inv: any) => inv.goods_receipt_id === id) || null;
    },
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: () => goodsReceiptsService.complete(id!),
    onSuccess: () => {
      toast.success('GRN completed and inventory updated');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', grn?.purchase_order_id] });
    },
    onError: (error: any) => {
      handleApiError(error, 'complete GRN', ['accounts', 'admin']);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: { supplier_invoice_number?: string; invoice_date?: string; due_date?: string; notes?: string }) => {
      return purchaseInvoicesService.createFromGRN({
        goods_receipt_id: id!,
        ...data,
      });
    },
    onSuccess: (invoice) => {
      toast.success('Invoice created successfully from GRN');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice-by-grn', id] });
      navigate(`/admin/purchase-invoices/${invoice.id}`);
    },
    onError: (error: any) => {
      handleApiError(error, 'create invoice from GRN', ['accounts', 'admin']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => goodsReceiptsService.delete(id!),
    onSuccess: () => {
      toast.success('GRN deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      navigate('/admin/goods-receipts');
    },
    onError: (error: any) => {
      handleApiError(error, 'delete GRN', ['admin', 'accounts', 'warehouse_manager']);
    },
  });

  const handleDelete = () => {
    if (window.confirm(
      `Are you sure you want to delete this GRN (${grn.grn_number})? ` +
      (grn.status === 'completed' 
        ? 'This will reverse inventory updates and cannot be undone.' 
        : 'This action cannot be undone.')
    )) {
      deleteMutation.mutate();
    }
  };

  const handleCreateInvoice = () => {
    createInvoiceMutation.mutate({});
  };

  if (isLoading || !grn) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="text-center py-8">Loading goods receipt...</div>
      </div>
    );
  }

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
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            Goods Receipt: {grn.grn_number}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {new Date(grn.receipt_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={grn.status} />
          {isAdmin && (grn.status === 'pending' || grn.status === 'inspected') && (
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/goods-receipts/${grn.id}/edit`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {/* Show delete button based on status and role */}
          {/* Completed GRNs: only admin can delete */}
          {/* Pending GRNs: admin, accounts, or warehouse managers can delete */}
          {((grn.status === 'completed' && isAdmin) || 
            (grn.status === 'pending' && hasAnyRole(['admin', 'accounts', 'warehouse_manager']))) && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Indicator */}
      {grn.purchase_order_id && (
        <ProcurementWorkflow
          po={{ id: grn.purchase_order_id, status: grn.purchase_orders?.status }}
          grn={{ id: grn.id, status: grn.status, grn_number: grn.grn_number }}
          invoice={relatedInvoice ? { id: relatedInvoice.id, status: relatedInvoice.status, invoice_number: relatedInvoice.invoice_number } : undefined}
        />
      )}

      <div className="space-y-4">
        {/* Main Details */}
        <div className="space-y-4">
          {/* GRN Information */}
          <Card>
            <CardHeader>
              <CardTitle>GRN Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {grn.purchase_orders && (
                  <div>
                    <p className="text-sm text-muted-foreground">Purchase Order</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{grn.purchase_orders.po_number || 'N/A'}</p>
                      {grn.purchase_order_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => navigate(`/admin/purchase-orders/${grn.purchase_order_id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {grn.warehouses && (
                  <div>
                    <p className="text-sm text-muted-foreground">Warehouse</p>
                    <p className="font-medium">{grn.warehouses.code || 'N/A'} - {grn.warehouses.name || 'N/A'}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Receipt Date</p>
                  <p className="font-medium">{new Date(grn.receipt_date).toLocaleDateString()}</p>
                </div>
                {grn.received_by && (
                  <div>
                    <p className="text-sm text-muted-foreground">Received By</p>
                    <p className="font-medium">{grn.received_by}</p>
                  </div>
                )}
              </div>
              {grn.inspection_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Inspection Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{grn.inspection_notes}</p>
                </div>
              )}
              {grn.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{grn.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Table */}
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
                      <TableHead className="min-w-[150px]">Product</TableHead>
                      <TableHead className="min-w-[120px]">Variant</TableHead>
                      <TableHead className="min-w-[100px]">HSN Code</TableHead>
                      <TableHead className="min-w-[80px]">Received</TableHead>
                      <TableHead className="min-w-[80px]">Accepted</TableHead>
                      <TableHead className="min-w-[80px]">Rejected</TableHead>
                      <TableHead className="min-w-[100px]">Unit Price</TableHead>
                      <TableHead className="min-w-[100px]">Batch Number</TableHead>
                      <TableHead className="min-w-[100px]">Expiry Date</TableHead>
                      <TableHead className="min-w-[150px]">Condition Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.goods_receipt_items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.product_code || item.products?.product_code || '-'}</TableCell>
                        <TableCell className="font-medium">
                          {item.products?.name || 'Product'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.variants?.name || item.purchase_order_items?.variants?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{item.hsn_code || item.products?.hsn_code || '-'}</TableCell>
                        <TableCell>{item.quantity_received}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {item.quantity_accepted}
                        </TableCell>
                        <TableCell className="text-red-600 font-medium">
                          {item.quantity_rejected || 0}
                        </TableCell>
                        <TableCell>₹{item.unit_price?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{item.batch_number || '-'}</TableCell>
                        <TableCell>
                          {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.condition_notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <p className="text-lg font-bold">
                    Total Received: ₹{grn.total_received_amount?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Invoice */}
          {relatedInvoice && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Related Invoice</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/admin/purchase-invoices/${relatedInvoice.id}`)}>
                    <div>
                      <p className="font-medium">{relatedInvoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(relatedInvoice.invoice_date).toLocaleDateString()} - 
                        ₹{relatedInvoice.total_amount?.toFixed(2)}
                      </p>
                    </div>
                    <StatusBadge status={relatedInvoice.status} />
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Items */}
              {relatedInvoice.purchase_invoice_items && relatedInvoice.purchase_invoice_items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Items</CardTitle>
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
                            <TableHead className="min-w-[80px]">Qty</TableHead>
                            <TableHead className="min-w-[80px]">Unit</TableHead>
                            <TableHead className="min-w-[100px]">Price</TableHead>
                            <TableHead className="min-w-[80px]">Tax %</TableHead>
                            <TableHead className="min-w-[100px]">Tax Amt</TableHead>
                            <TableHead className="min-w-[120px]">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {relatedInvoice.purchase_invoice_items.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">{item.product_code || '-'}</TableCell>
                              <TableCell className="font-medium text-sm">
                                {item.products?.name || 'Product'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.variants?.name || item.goods_receipt_items?.variants?.name || '-'}
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
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <StatusTransitionButton
                label="Complete GRN"
                onClick={() => completeMutation.mutate()}
                requiredRoles={['accounts', 'admin']}
                currentStatus={grn.status}
                targetStatus="completed"
                disabled={completeMutation.isPending || grn.status === 'completed'}
                icon={<CheckCircle className="h-4 w-4" />}
                showConfirmation={true}
                confirmationTitle="Complete Goods Receipt"
                confirmationMessage="Are you sure you want to complete this GRN? This will update inventory and cannot be undone."
              />

              {grn.status === 'completed' && (isAdmin || isAccounts) && (
                <StatusTransitionButton
                  label="Create Invoice from GRN"
                  onClick={handleCreateInvoice}
                  requiredRoles={['accounts', 'admin']}
                  currentStatus={grn.status}
                  targetStatus="completed"
                  disabled={createInvoiceMutation.isPending || !!relatedInvoice}
                  icon={<FileText className="h-4 w-4" />}
                  tooltipMessage={relatedInvoice ? 'Invoice already exists for this GRN' : undefined}
                />
              )}

              {relatedInvoice && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/admin/purchase-invoices/${relatedInvoice.id}`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoice
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
