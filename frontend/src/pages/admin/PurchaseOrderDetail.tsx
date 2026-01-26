import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
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
import { ArrowLeft, CheckCircle, XCircle, FileText, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { useAuth } from '@/contexts/AuthContext';
import { handleApiError } from '@/utils/errorHandler';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { StatusTransitionButton } from '@/components/procurement/StatusTransitionButton';
import { WarehouseAccessGuard } from '@/components/procurement/WarehouseAccessGuard';
import { ProcurementWorkflow } from '@/components/procurement/ProcurementWorkflow';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAccounts, isWarehouseManager, hasWarehouseAccess } = useAuth();

  // Fetch purchase order
  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrdersService.getById(id!),
    enabled: !!id,
  });

  // Fetch related GRNs
  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ['goods-receipts', id],
    queryFn: () => goodsReceiptsService.getAll({ purchase_order_id: id }),
    enabled: !!id,
  });

  // Fetch related invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ['purchase-invoices', id],
    queryFn: () => purchaseInvoicesService.getAll({ purchase_order_id: id }),
    enabled: !!id,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => purchaseOrdersService.submit(id!),
    onSuccess: () => {
      toast.success('Purchase order submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (error: any) => {
      handleApiError(error, 'submit purchase order', ['warehouse_manager', 'admin']);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersService.approve(id!),
    onSuccess: () => {
      toast.success('Purchase order approved');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (error: any) => {
      handleApiError(error, 'approve purchase order', ['accounts', 'admin']);
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => purchaseOrdersService.cancel(id!),
    onSuccess: () => {
      toast.success('Purchase order cancelled');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (error: any) => {
      handleApiError(error, 'cancel purchase order', ['admin']);
    },
  });


  if (isLoading) {
    return <div className="text-center py-8">Loading purchase order...</div>;
  }

  if (!purchaseOrder) {
    return <div className="text-center py-8">Purchase order not found</div>;
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
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            Purchase Order: {purchaseOrder.po_number}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {new Date(purchaseOrder.created_at).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={purchaseOrder.status} />
      </div>

      {/* Workflow Indicator */}
      <ProcurementWorkflow
        po={{ id: purchaseOrder.id, status: purchaseOrder.status, po_number: purchaseOrder.po_number }}
        grn={goodsReceipts.length > 0 ? { id: goodsReceipts[0].id, status: goodsReceipts[0].status, grn_number: goodsReceipts[0].grn_number } : undefined}
        invoice={invoices.length > 0 ? { id: invoices[0].id, status: invoices[0].status, invoice_number: invoices[0].invoice_number } : undefined}
      />

      <div className="space-y-4">
        {/* Main Details */}
        <div className="space-y-4">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{purchaseOrder.suppliers?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Warehouse</p>
                  <p className="font-medium">{purchaseOrder.warehouses?.code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">
                    {new Date(purchaseOrder.order_date).toLocaleDateString()}
                  </p>
                </div>
                {purchaseOrder.expected_delivery_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">
                      {new Date(purchaseOrder.expected_delivery_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              {purchaseOrder.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{purchaseOrder.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Product Code</TableHead>
                      <TableHead className="min-w-[150px]">Product</TableHead>
                      <TableHead className="min-w-[100px]">HSN Code</TableHead>
                      <TableHead className="min-w-[80px]">Quantity</TableHead>
                      <TableHead className="min-w-[100px]">Unit Price</TableHead>
                      <TableHead className="min-w-[80px]">Tax %</TableHead>
                      <TableHead className="min-w-[100px]">Received</TableHead>
                      <TableHead className="min-w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.purchase_order_items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.product_code || item.products?.product_code || '-'}</TableCell>
                        <TableCell className="font-medium">
                          {item.products?.name || 'Product'}
                        </TableCell>
                        <TableCell className="text-sm">{item.hsn_code || item.products?.hsn_code || '-'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-sm">{item.tax_percentage ? `${item.tax_percentage}%` : (item.products?.tax ? `${item.products.tax}%` : '-')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.received_quantity || 0} / {item.quantity}</span>
                            {item.received_quantity > 0 && (
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${(item.received_quantity / item.quantity) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{item.line_total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <p className="text-lg font-bold">
                    Total: ₹{purchaseOrder.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related GRNs */}
          {goodsReceipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Goods Receipts ({goodsReceipts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {goodsReceipts.map((grn: any) => (
                    <div
                      key={grn.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted"
                      onClick={() => navigate(`/admin/goods-receipts/${grn.id}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{grn.grn_number}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/goods-receipts/${grn.id}`);
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(grn.receipt_date).toLocaleDateString()} - ₹{grn.total_received_amount?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <StatusBadge status={grn.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Invoices */}
          {invoices.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Invoices ({invoices.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {invoices.map((invoice: any) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => navigate(`/admin/purchase-invoices/${invoice.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/purchase-invoices/${invoice.id}`);
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(invoice.invoice_date).toLocaleDateString()} - 
                            ₹{invoice.total_amount.toFixed(2)}
                            {invoice.paid_amount > 0 && (
                              <span className="ml-2">(Paid: ₹{invoice.paid_amount.toFixed(2)})</span>
                            )}
                          </p>
                        </div>
                        <StatusBadge status={invoice.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Items */}
              {invoices.some((inv: any) => inv.purchase_invoice_items && inv.purchase_invoice_items.length > 0) && (
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
                          {invoices.flatMap((invoice: any) =>
                            (invoice.purchase_invoice_items || []).map((item: any) => (
                              <TableRow key={`${invoice.id}-${item.id}`}>
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
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Actions - Only show if PO is not approved */}
        {purchaseOrder.status !== 'approved' && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {purchaseOrder.status === 'draft' && isAdmin && (
                  <Button
                    onClick={() => navigate(`/admin/purchase-orders/${id}/edit`)}
                  >
                    Edit PO
                  </Button>
                )}

                {purchaseOrder.status === 'draft' && (
                  <StatusTransitionButton
                    label="Submit for Approval"
                    onClick={() => submitMutation.mutate()}
                    requiredRoles={['warehouse_manager', 'admin']}
                    currentStatus={purchaseOrder.status}
                    targetStatus="pending"
                    disabled={submitMutation.isPending}
                    icon={<Send className="h-4 w-4" />}
                    showConfirmation={true}
                    confirmationTitle="Submit Purchase Order for Approval"
                    confirmationMessage="Are you sure you want to submit this purchase order for approval? Once submitted, it will need to be approved by accounts or admin before warehouse managers can create GRNs."
                  />
                )}
                
                <StatusTransitionButton
                  label="Approve PO"
                  onClick={() => approveMutation.mutate()}
                  requiredRoles={['accounts', 'admin']}
                  currentStatus={purchaseOrder.status}
                  targetStatus="approved"
                  disabled={approveMutation.isPending || (!isAdmin && purchaseOrder.status !== 'pending')}
                  icon={<CheckCircle className="h-4 w-4" />}
                  showConfirmation={true}
                  confirmationTitle="Approve Purchase Order"
                  confirmationMessage="Are you sure you want to approve this purchase order? This will allow warehouse managers to create GRNs."
                />

                {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending') && isAdmin && (
                  <StatusTransitionButton
                    label="Cancel PO"
                    onClick={() => cancelMutation.mutate()}
                    requiredRoles={['admin']}
                    currentStatus={purchaseOrder.status}
                    targetStatus="cancelled"
                    disabled={cancelMutation.isPending}
                    variant="destructive"
                    icon={<XCircle className="h-4 w-4" />}
                    showConfirmation={true}
                    confirmationTitle="Cancel Purchase Order"
                    confirmationMessage="Are you sure you want to cancel this purchase order? This action cannot be undone."
                  />
                )}

                {purchaseOrder.status === 'ordered' && goodsReceipts.length === 0 && (
                  <WarehouseAccessGuard 
                    warehouseId={purchaseOrder.warehouse_id}
                    showWarning={true}
                  >
                    <StatusTransitionButton
                      label="Create GRN"
                      onClick={() => navigate(`/admin/goods-receipts/new?po=${id}`)}
                      requiredRoles={['warehouse_manager', 'admin']}
                      requiredWarehouseAccess={purchaseOrder.warehouse_id}
                      currentStatus={purchaseOrder.status}
                      targetStatus="ordered"
                      icon={<FileText className="h-4 w-4" />}
                    />
                  </WarehouseAccessGuard>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
