import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { supplierPaymentsService } from '@/api/supplierPayments';

export default function SupplierPaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payment, isLoading } = useQuery({
    queryKey: ['supplier-payment', id],
    queryFn: () => supplierPaymentsService.getById(id!),
    enabled: !!id,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
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
        <Badge variant={getStatusBadgeVariant(payment.status)}>
          {payment.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
              <p className="font-medium">
                {payment.purchase_invoices?.invoice_number || 'N/A'}
              </p>
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
      </div>
    </div>
  );
}
