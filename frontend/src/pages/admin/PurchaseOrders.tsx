import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Search, Eye, FileText, CheckCircle, ExternalLink } from "lucide-react";
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { suppliersService } from '@/api/suppliers';
import { warehousesService } from '@/api/warehouses';
import { goodsReceiptsService } from '@/api/goodsReceipts';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
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
import { MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isWarehouseManager, isAccounts, warehouses, hasWarehouseAccess } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Approve mutation for quick action
  const approveMutation = useMutation({
    mutationFn: (poId: string) => purchaseOrdersService.approve(poId),
    onSuccess: () => {
      toast.success('Purchase order approved');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to approve purchase order';
      toast.error(errorMessage);
    },
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter, warehouseFilter, supplierFilter],
    queryFn: () => purchaseOrdersService.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
      search: searchQuery || undefined,
    }),
  });

  // Filter POs by warehouse access for warehouse managers
  const filteredPurchaseOrders = isAdmin 
    ? purchaseOrders 
    : purchaseOrders.filter((po: any) => hasWarehouseAccess(po.warehouse_id));

  // Fetch GRNs and invoices for each PO (for progress calculation)
  const { data: allGRNs = [] } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => goodsReceiptsService.getAll({}),
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ['purchase-invoices'],
    queryFn: () => purchaseInvoicesService.getAll({}),
  });

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll({ is_active: true }),
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

  // Calculate received quantity progress for a PO
  const getReceivedProgress = (po: any) => {
    const poItems = po.purchase_order_items || [];
    if (poItems.length === 0) return { received: 0, total: 0, percentage: 0 };
    
    const totalOrdered = poItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    const totalReceived = poItems.reduce((sum: number, item: any) => sum + (item.received_quantity || 0), 0);
    const percentage = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;
    
    return { received: totalReceived, total: totalOrdered, percentage };
  };

  // Get related GRNs for a PO
  const getRelatedGRNs = (poId: string) => {
    return allGRNs.filter((grn: any) => grn.purchase_order_id === poId);
  };

  // Get related invoices for a PO
  const getRelatedInvoices = (poId: string) => {
    return allInvoices.filter((inv: any) => inv.purchase_order_id === poId);
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Purchase Orders</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage purchase orders and procurement
          </p>
        </div>
        {(isAdmin || isWarehouseManager) && (
          <Button onClick={() => navigate('/admin/purchase-orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create PO
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO number..."
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.supplier_code || supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders ({filteredPurchaseOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading purchase orders...</div>
          ) : filteredPurchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Received Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Related</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseOrders.map((po) => {
                    const progress = getReceivedProgress(po);
                    const relatedGRNs = getRelatedGRNs(po.id);
                    const relatedInvoices = getRelatedInvoices(po.id);
                    
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>
                          {po.suppliers?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {po.warehouses?.code || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(po.order_date || po.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{po.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    progress.percentage === 100 ? 'bg-green-500' : 
                                    progress.percentage > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${progress.percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {progress.received} / {progress.total}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={po.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {relatedGRNs.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/admin/goods-receipts?po=${po.id}`)}
                                className="h-7 text-xs"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {relatedGRNs.length} GRN{relatedGRNs.length > 1 ? 's' : ''}
                              </Button>
                            )}
                            {relatedInvoices.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/admin/purchase-invoices?po=${po.id}`)}
                                className="h-7 text-xs"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {relatedInvoices.length} Inv{relatedInvoices.length > 1 ? 's' : ''}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/admin/purchase-orders/${po.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {po.status === 'pending' && (isAdmin || isAccounts) && (
                                <DropdownMenuItem 
                                  onClick={() => approveMutation.mutate(po.id)}
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve PO
                                </DropdownMenuItem>
                              )}
                              {(po.status === 'approved' || po.status === 'ordered' || po.status === 'partially_received') && (isAdmin || isWarehouseManager) && (
                                <DropdownMenuItem 
                                  onClick={() => navigate(`/admin/goods-receipts/new?po=${po.id}`)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Create GRN
                                </DropdownMenuItem>
                              )}
                              {relatedGRNs.length > 0 && (
                                <DropdownMenuItem onClick={() => navigate(`/admin/goods-receipts?po=${po.id}`)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  View GRNs ({relatedGRNs.length})
                                </DropdownMenuItem>
                              )}
                              {relatedInvoices.length > 0 && (
                                <DropdownMenuItem onClick={() => navigate(`/admin/purchase-invoices?po=${po.id}`)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Invoices ({relatedInvoices.length})
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
