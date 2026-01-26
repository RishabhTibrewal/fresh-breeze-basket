import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
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
import { Plus, Search, Eye, DollarSign, MoreHorizontal, AlertTriangle, Pencil } from "lucide-react";
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { suppliersService } from '@/api/suppliers';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { cn } from '@/lib/utils';
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

export default function PurchaseInvoices() {
  const navigate = useNavigate();
  const { isAdmin, isAccounts } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');

  // Fetch purchase invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['purchase-invoices', statusFilter, supplierFilter, dateFromFilter, dateToFilter],
    queryFn: () => purchaseInvoicesService.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
      date_from: dateFromFilter || undefined,
      date_to: dateToFilter || undefined,
    }),
  });

  // Check if invoice is overdue
  const isOverdue = (invoice: any) => {
    if (!invoice.due_date) return false;
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
    return new Date(invoice.due_date) < new Date();
  };

  // Calculate balance for invoice
  const getBalance = (invoice: any) => {
    return invoice.total_amount - invoice.paid_amount;
  };

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll({ is_active: true }),
  });


  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Purchase Invoices</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage purchase invoices and supplier bills
          </p>
        </div>
        {(isAdmin || isAccounts) && (
          <Button onClick={() => navigate('/admin/purchase-invoices/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number..."
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
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
            <Input
              type="date"
              placeholder="Date From"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
            />
            <Input
              type="date"
              placeholder="Date To"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices
                    .filter((invoice: any) => {
                      if (!searchQuery) return true;
                      return invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                    .map((invoice: any) => {
                      const balance = getBalance(invoice);
                      const overdue = isOverdue(invoice);
                      const paymentPercentage = invoice.total_amount > 0 
                        ? (invoice.paid_amount / invoice.total_amount) * 100 
                        : 0;
                      
                      return (
                        <TableRow 
                          key={invoice.id}
                          className={cn(overdue && 'bg-red-50 dark:bg-red-950/20')}
                        >
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            {invoice.purchase_orders?.suppliers?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {invoice.purchase_orders?.po_number || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.invoice_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className={cn(overdue && 'text-red-600 font-medium')}>
                              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                              {overdue && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ₹{invoice.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Paid:</span>
                                <span className="font-medium text-green-600">
                                  ₹{invoice.paid_amount.toFixed(2)}
                                </span>
                              </div>
                              {balance > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Balance:</span>
                                  <span className="font-medium text-red-600">
                                    ₹{balance.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    paymentPercentage === 100 ? 'bg-green-500' : 
                                    paymentPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                  )}
                                  style={{ width: `${paymentPercentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/admin/purchase-invoices/${invoice.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {isAdmin && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                  <DropdownMenuItem onClick={() => navigate(`/admin/purchase-invoices/${invoice.id}/edit`)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Invoice
                                  </DropdownMenuItem>
                                )}
                                {balance > 0 && (isAdmin || isAccounts) && (
                                  <DropdownMenuItem 
                                    onClick={() => navigate(`/admin/supplier-payments/new?invoice=${invoice.id}`)}
                                  >
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Record Payment
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
