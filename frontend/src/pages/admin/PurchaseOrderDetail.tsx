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
import { ArrowLeft, CheckCircle, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { warehousesService } from '@/api/warehouses';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersService.approve(id!),
    onSuccess: () => {
      toast.success('Purchase order approved');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve purchase order');
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
      toast.error(error.response?.data?.error || 'Failed to cancel purchase order');
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'pending':
        return 'default';
      case 'approved':
        return 'default';
      case 'ordered':
        return 'default';
      case 'partially_received':
        return 'secondary';
      case 'received':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

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
        <Badge variant={getStatusBadgeVariant(purchaseOrder.status)}>
          {purchaseOrder.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.purchase_order_items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.products?.name || 'Product'}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell>
                        {item.received_quantity} / {item.quantity}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{item.line_total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                      <div>
                        <p className="font-medium">{grn.grn_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(grn.receipt_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(grn.status)}>
                        {grn.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Invoices */}
          {invoices.length > 0 && (
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
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(invoice.invoice_date).toLocaleDateString()} - 
                          ₹{invoice.total_amount.toFixed(2)}
                        </p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(invoice.status)}>
                        {invoice.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {purchaseOrder.status === 'draft' && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/admin/purchase-orders/${id}/edit`)}
                >
                  Edit PO
                </Button>
              )}
              {purchaseOrder.status === 'pending' && (
                <Button
                  className="w-full"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve PO
                </Button>
              )}
              {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending') && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel PO
                </Button>
              )}
              {purchaseOrder.status === 'approved' && goodsReceipts.length === 0 && (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/admin/goods-receipts/new?po=${id}`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create GRN
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
