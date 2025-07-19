import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { paymentsService, Payment } from '@/api/payments';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPayments = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const response = await paymentsService.getPaymentHistory({ page: pageNum, limit: 10 });
      
      if (pageNum === 1) {
        setPayments(response.data);
      } else {
        setPayments(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.data.length === 10);
      setPage(pageNum);
    } catch (err) {
      console.error('Error loading payments:', err);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const getStatusBadge = (status: Payment['status']) => {
    const statusConfig = {
      completed: { variant: 'default' as const, label: 'Completed' },
      pending: { variant: 'secondary' as const, label: 'Pending' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
      refunded: { variant: 'outline' as const, label: 'Refunded' }
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methodLabels: Record<string, string> = {
      card: 'Credit/Debit Card',
      cash: 'Cash',
      cheque: 'Cheque',
      bank_transfer: 'Bank Transfer'
    };
    return methodLabels[method] || method;
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Payment History</h1>
          <p className="text-gray-600">View your payment records</p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => loadPayments()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment History</h1>
        <p className="text-gray-600">View your payment records</p>
      </div>

      {payments.length === 0 && !loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-gray-500">No payment records found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {formatCurrency(payment.amount)}
                    </CardTitle>
                    <CardDescription>
                      {getPaymentMethodLabel(payment.payment_method)}
                    </CardDescription>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Date:</span>
                    <p className="text-gray-600">
                      {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Transaction ID:</span>
                    <p className="text-gray-600 font-mono text-xs">
                      {payment.stripe_payment_intent_id || 'N/A'}
                    </p>
                  </div>
                  {payment.order_id && (
                    <div className="col-span-2">
                      <span className="font-medium">Order ID:</span>
                      <p className="text-gray-600 font-mono text-xs">
                        {payment.order_id}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button 
                onClick={() => loadPayments(page + 1)}
                disabled={loading}
                variant="outline"
              >
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 