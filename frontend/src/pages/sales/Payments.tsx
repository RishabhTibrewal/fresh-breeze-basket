import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Search, Eye, DollarSign, CheckCircle, Clock, XCircle, Edit, Calendar, User } from "lucide-react";
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
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Payments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = useCanAccess('sales.write');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateAmount, setUpdateAmount] = useState<string>('');
  const [updateMethod, setUpdateMethod] = useState<string>('');
  const [updateTransactionId, setUpdateTransactionId] = useState<string>('');
  const [updateChequeNo, setUpdateChequeNo] = useState<string>('');
  const [updatePaymentDate, setUpdatePaymentDate] = useState<string>('');

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

  const updatePaymentMutation = useMutation({
    mutationFn: (data: { id: string; status?: string; amount?: number; payment_method?: string; transaction_id?: string | null; cheque_no?: string | null; payment_date?: string }) => {
      const { id, ...paymentData } = data;
      return paymentsService.update(id, paymentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment updated successfully');
      setEditingPayment(null);
      setUpdateStatus('');
      setUpdateAmount('');
      setUpdateMethod('');
      setUpdateTransactionId('');
      setUpdateChequeNo('');
      setUpdatePaymentDate('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update payment');
    },
  });

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setUpdateStatus(payment.status);
    setUpdateAmount(payment.amount.toString());
    setUpdateMethod(payment.payment_method);
    setUpdateTransactionId(payment.transaction_id || '');
    setUpdateChequeNo(payment.cheque_no || '');
    setUpdatePaymentDate(payment.payment_date || '');
  };

  const handleUpdatePayment = () => {
    if (!editingPayment) return;
    
    const amount = parseFloat(updateAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    updatePaymentMutation.mutate({
      id: editingPayment.id,
      status: updateStatus,
      amount: amount,
      payment_method: updateMethod,
      transaction_id: updateTransactionId || null,
      cheque_no: updateChequeNo || null,
      payment_date: updatePaymentDate || undefined,
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 pb-20 md:pb-6 space-y-3 sm:space-y-6">
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

      {/* Payments List */}
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
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                {filteredPayments.map((payment: Payment & { order?: any; customer?: any }) => (
                  <Card
                    key={payment.id}
                    className="p-3 w-full min-w-0 overflow-hidden cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
                    onClick={() => navigate(`/sales/orders/${payment.order_id}`)}
                  >
                    <div className="space-y-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm mb-1 text-green-600">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {payment.customer?.name || 'N/A'}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {payment.payment_date
                              ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                              : format(new Date(payment.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {payment.order?.order_number ? `Order #${payment.order.order_number}` : 'N/A'}
                          </span>
                        </div>
                        <div className="text-xs">
                          Method: {getPaymentMethodLabel(payment.payment_method)}
                        </div>
                        {(payment.transaction_id || payment.cheque_no) && (
                          <div className="text-xs text-muted-foreground">
                            {payment.transaction_id && <span>TX: {payment.transaction_id}</span>}
                            {payment.transaction_id && payment.cheque_no && ' | '}
                            {payment.cheque_no && <span>Cheque: {payment.cheque_no}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => navigate(`/sales/orders/${payment.order_id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1.5" />
                          View
                        </Button>
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
                        <div className="flex items-center gap-2">
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPayment(payment)}
                              title="Update Payment"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/sales/orders/${payment.order_id}`)}
                            title="View Order"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Update Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="w-[95%] max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Update payment status and details for payment ID: {editingPayment?.id?.substring(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={updateAmount}
                onChange={(e) => setUpdateAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Payment Status *</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={updateMethod} onValueChange={setUpdateMethod}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
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
            <div className="space-y-2">
              <Label htmlFor="transaction_id">Transaction ID</Label>
              <Input
                id="transaction_id"
                value={updateTransactionId}
                onChange={(e) => setUpdateTransactionId(e.target.value)}
                placeholder="Enter transaction ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cheque_no">Cheque Number</Label>
              <Input
                id="cheque_no"
                value={updateChequeNo}
                onChange={(e) => setUpdateChequeNo(e.target.value)}
                placeholder="Enter cheque number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={updatePaymentDate}
                onChange={(e) => setUpdatePaymentDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingPayment(null);
                setUpdateStatus('');
                setUpdateAmount('');
                setUpdateMethod('');
                setUpdateTransactionId('');
                setUpdateChequeNo('');
                setUpdatePaymentDate('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePayment}
              disabled={updatePaymentMutation.isPending || !updateStatus || !updateAmount}
            >
              {updatePaymentMutation.isPending ? 'Updating...' : 'Update Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

