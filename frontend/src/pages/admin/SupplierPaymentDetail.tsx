import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supplierPaymentsService } from '@/api/supplierPayments';
import { useAuth } from '@/contexts/AuthContext';
import { handleApiError } from '@/utils/errorHandler';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { StatusTransitionButton } from '@/components/procurement/StatusTransitionButton';

export default function SupplierPaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAccounts } = useAuth();

  const { data: payment, isLoading } = useQuery({
    queryKey: ['supplier-payment', id],
    queryFn: () => supplierPaymentsService.getById(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => supplierPaymentsService.update(id!, { status }),
    onSuccess: () => {
      toast.success('Payment status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['supplier-payment', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', payment?.purchase_invoice_id] });
    },
    onError: (error: any) => {
      handleApiError(error, 'update payment status', ['accounts', 'admin']);
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate(newStatus);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading payment...</div>;
  }

  if (!payment) {
    return <div className="text-center py-8">Payment not found</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/supplier-payments')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            Payment: {payment.payment_number}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {new Date(payment.created_at).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Supplier</p>
              <p className="font-medium">{payment.suppliers?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoice</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {payment.purchase_invoices?.invoice_number || 'N/A'}
                </p>
                {payment.purchase_invoice_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => navigate(`/admin/purchase-invoices/${payment.purchase_invoice_id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Date</p>
              <p className="font-medium">
                {new Date(payment.payment_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium">{payment.payment_method}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-medium text-lg">₹{payment.amount.toFixed(2)}</p>
            </div>
            {payment.reference_number && (
              <div>
                <p className="text-sm text-muted-foreground">Reference Number</p>
                <p className="font-medium">{payment.reference_number}</p>
              </div>
            )}
            {payment.bank_name && (
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{payment.bank_name}</p>
              </div>
            )}
            {payment.cheque_number && (
              <div>
                <p className="text-sm text-muted-foreground">Cheque Number</p>
                <p className="font-medium">{payment.cheque_number}</p>
              </div>
            )}
            {payment.transaction_id && (
              <div>
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-medium">{payment.transaction_id}</p>
              </div>
            )}
            {payment.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{payment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium capitalize">{payment.payment_method?.replace('_', ' ') || 'N/A'}</p>
            </div>
            {payment.reference_number && (
              <div>
                <p className="text-sm text-muted-foreground">Reference Number</p>
                <p className="font-medium">{payment.reference_number}</p>
              </div>
            )}
            {payment.bank_name && (
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{payment.bank_name}</p>
              </div>
            )}
            {payment.cheque_number && (
              <div>
                <p className="text-sm text-muted-foreground">Cheque Number</p>
                <p className="font-medium">{payment.cheque_number}</p>
              </div>
            )}
            {payment.transaction_id && (
              <div>
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-medium font-mono text-sm">{payment.transaction_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payment.status === 'pending' && (isAdmin || isAccounts) && (
              <StatusTransitionButton
                label="Mark as Processing"
                onClick={() => handleStatusUpdate('processing')}
                requiredRoles={['accounts', 'admin']}
                currentStatus={payment.status}
                targetStatus="processing"
                disabled={updateStatusMutation.isPending}
                icon={<Clock className="h-4 w-4" />}
                showConfirmation={true}
                confirmationTitle="Mark Payment as Processing"
                confirmationMessage="Are you sure you want to mark this payment as processing?"
              />
            )}

            {(payment.status === 'pending' || payment.status === 'processing') && (isAdmin || isAccounts) && (
              <>
                <StatusTransitionButton
                  label="Mark as Completed"
                  onClick={() => handleStatusUpdate('completed')}
                  requiredRoles={['accounts', 'admin']}
                  currentStatus={payment.status}
                  targetStatus="completed"
                  disabled={updateStatusMutation.isPending}
                  icon={<CheckCircle className="h-4 w-4" />}
                  showConfirmation={true}
                  confirmationTitle="Complete Payment"
                  confirmationMessage="Are you sure you want to mark this payment as completed? This will update the invoice payment status."
                />

                <StatusTransitionButton
                  label="Mark as Failed"
                  onClick={() => handleStatusUpdate('failed')}
                  requiredRoles={['accounts', 'admin']}
                  currentStatus={payment.status}
                  targetStatus="failed"
                  disabled={updateStatusMutation.isPending}
                  variant="destructive"
                  icon={<AlertCircle className="h-4 w-4" />}
                  showConfirmation={true}
                  confirmationTitle="Mark Payment as Failed"
                  confirmationMessage="Are you sure you want to mark this payment as failed?"
                />
              </>
            )}

            {payment.status !== 'completed' && payment.status !== 'cancelled' && (isAdmin || isAccounts) && (
              <StatusTransitionButton
                label="Cancel Payment"
                onClick={() => handleStatusUpdate('cancelled')}
                requiredRoles={['accounts', 'admin']}
                currentStatus={payment.status}
                targetStatus="cancelled"
                disabled={updateStatusMutation.isPending}
                variant="destructive"
                icon={<XCircle className="h-4 w-4" />}
                showConfirmation={true}
                confirmationTitle="Cancel Payment"
                confirmationMessage="Are you sure you want to cancel this payment? This action cannot be undone."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
