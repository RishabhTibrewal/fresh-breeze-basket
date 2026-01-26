import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, FileText, CheckCircle, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { warehousesService } from '@/api/warehouses';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GoodsReceipts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('po');
  const queryClient = useQueryClient();
  const { isAdmin, isWarehouseManager, isAccounts, hasWarehouseAccess } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');

  // Complete GRN mutation for quick action
  const completeMutation = useMutation({
    mutationFn: (grnId: string) => goodsReceiptsService.complete(grnId),
    onSuccess: () => {
      toast.success('GRN completed successfully');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to complete GRN';
      toast.error(errorMessage);
    },
  });

  // Create invoice from GRN mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (grnId: string) => purchaseInvoicesService.createFromGRN({ goods_receipt_id: grnId }),
    onSuccess: (invoice) => {
      toast.success('Invoice created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      navigate(`/admin/purchase-invoices/${invoice.id}`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to create invoice';
      toast.error(errorMessage);
    },
  });

  // Check if GRN already has an invoice
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['purchase-invoices'],
    queryFn: () => purchaseInvoicesService.getAll({}),
  });

  const hasInvoice = (grnId: string) => {
    return allInvoices.some((inv: any) => inv.goods_receipt_id === grnId);
  };

  // Fetch goods receipts
  const { data: goodsReceipts = [], isLoading } = useQuery({
    queryKey: ['goods-receipts', statusFilter, warehouseFilter, poId],
    queryFn: () => goodsReceiptsService.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      purchase_order_id: poId || undefined,
      search: searchQuery || undefined,
    }),
  });

  // Fetch warehouses for filter
  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  // Filter warehouses based on user access
  const availableWarehouses = isAdmin 
    ? allWarehouses 
    : allWarehouses.filter((wh: any) => hasWarehouseAccess(wh.id));

  // Filter GRNs by warehouse access for warehouse managers
  const filteredGRNs = isAdmin 
    ? goodsReceipts 
    : goodsReceipts.filter((grn: any) => hasWarehouseAccess(grn.warehouse_id));

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Goods Receipts</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage goods receipt notes (GRN)
          </p>
        </div>
        {(isAdmin || isWarehouseManager) && (
          <Button onClick={() => navigate('/admin/goods-receipts/new' + (poId ? `?po=${poId}` : ''))}>
            <Plus className="h-4 w-4 mr-2" />
            Create GRN
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search GRN number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inspected">Inspected</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {availableWarehouses.map((warehouse: any) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Goods Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Goods Receipts ({filteredGRNs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading goods receipts...</div>
          ) : filteredGRNs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No goods receipts found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN Number</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGRNs.map((grn) => (
                    <TableRow key={grn.id}>
                      <TableCell className="font-medium">{grn.grn_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{grn.purchase_orders?.po_number || 'N/A'}</span>
                          {grn.purchase_order_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/purchase-orders/${grn.purchase_order_id}`);
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {grn.warehouses?.code || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(grn.receipt_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{grn.total_received_amount?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={grn.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/goods-receipts/${grn.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {isAdmin && (grn.status === 'pending' || grn.status === 'inspected') && (
                              <DropdownMenuItem onClick={() => navigate(`/admin/goods-receipts/${grn.id}/edit`)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit GRN
                              </DropdownMenuItem>
                            )}
                            {grn.status !== 'completed' && (isAdmin || isAccounts) && (
                              <DropdownMenuItem 
                                onClick={() => completeMutation.mutate(grn.id)}
                                disabled={completeMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Complete GRN
                              </DropdownMenuItem>
                            )}
                            {grn.status === 'completed' && !hasInvoice(grn.id) && (isAdmin || isAccounts) && (
                              <DropdownMenuItem 
                                onClick={() => createInvoiceMutation.mutate(grn.id)}
                                disabled={createInvoiceMutation.isPending}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Create Invoice
                              </DropdownMenuItem>
                            )}
                            {hasInvoice(grn.id) && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  const invoice = allInvoices.find((inv: any) => inv.goods_receipt_id === grn.id);
                                  if (invoice) navigate(`/admin/purchase-invoices/${invoice.id}`);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Invoice
                              </DropdownMenuItem>
                            )}
                            {grn.purchase_order_id && (
                              <DropdownMenuItem onClick={() => navigate(`/admin/purchase-orders/${grn.purchase_order_id}`)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View PO
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
