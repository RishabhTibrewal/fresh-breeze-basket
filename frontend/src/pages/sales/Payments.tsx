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
import { Plus, Search, Eye, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import { paymentsService, Payment } from '@/api/payments';
import { useCanAccess } from '@/hooks/usePermissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export default function Payments() {
  const navigate = useNavigate();
  const canWrite = useCanAccess('sales.write');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', statusFilter, methodFilter],
    queryFn: () => paymentsService.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      payment_method: methodFilter !== 'all' ? methodFilter : undefined,
    }),
  });

  // Calculate summary statistics
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedAmount = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const failedAmount = payments
    .filter((p) => p.status === 'failed' || p.status === 'refunded')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Filter payments by search query
  const filteredPayments = payments.filter((payment: Payment & { order?: any; customer?: any }) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        payment.id?.toLowerCase().includes(query) ||
        payment.order?.order_number?.toLowerCase().includes(query) ||
        payment.customer?.name?.toLowerCase().includes(query) ||
        payment.transaction_id?.toLowerCase().includes(query) ||
        payment.cheque_no?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: Payment['status']) => {
    const statusConfig = {
      completed: { variant: 'default' as const, label: 'Completed', className: 'bg-green-100 text-green-800' },
      pending: { variant: 'secondary' as const, label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      failed: { variant: 'destructive' as const, label: 'Failed', className: 'bg-red-100 text-red-800' },
      refunded: { variant: 'outline' as const, label: 'Refunded', className: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methodMap: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      neft: 'NEFT',
      rtgs: 'RTGS',
      upi: 'UPI',
      cheque: 'Cheque',
    };
    return methodMap[method] || method;
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Payments</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage customer payments and transactions
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate('/sales/payments/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{payments.length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(completedAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === 'completed').length} payments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === 'pending').length} payments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed/Refunded</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(failedAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === 'failed' || p.status === 'refunded').length} payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order, customer, transaction ID..."
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="neft">NEFT</SelectItem>
                <SelectItem value="rtgs">RTGS</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No payments match your search criteria' : 'No payments found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Transaction/Cheque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: Payment & { order?: any; customer?: any }) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {payment.payment_date 
                          ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                          : format(new Date(payment.created_at), 'MMM dd, yyyy')
                        }
                      </TableCell>
                      <TableCell>
                        {payment.order?.order_number ? (
                          <button
                            onClick={() => navigate(`/sales/orders/${payment.order_id}`)}
                            className="text-primary hover:underline"
                          >
                            {payment.order.order_number}
                          </button>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.customer?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        {getPaymentMethodLabel(payment.payment_method)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.transaction_id && (
                          <div>TX: {payment.transaction_id}</div>
                        )}
                        {payment.cheque_no && (
                          <div>Cheque: {payment.cheque_no}</div>
                        )}
                        {!payment.transaction_id && !payment.cheque_no && '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/sales/orders/${payment.order_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

