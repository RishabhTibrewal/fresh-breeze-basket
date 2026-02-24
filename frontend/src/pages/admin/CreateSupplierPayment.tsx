import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supplierPaymentsService, CreateSupplierPaymentData } from '@/api/supplierPayments';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateSupplierPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const queryClient = useQueryClient();

  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(invoiceId || '');
  const [supplierId, setSupplierId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'>('cash');
  const [amount, setAmount] = useState(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch unpaid invoices only (status: pending, partial, or overdue)
  // Exclude paid and cancelled invoices
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['purchase-invoices'],
    queryFn: () => purchaseInvoicesService.getAll(),
  });

  // Filter to show only unpaid invoices (pending, partial, overdue)
  // Also filter out invoices with zero balance
  const invoices = allInvoices.filter((invoice: any) => {
    const isUnpaid = invoice.status !== 'paid' && invoice.status !== 'cancelled';
    const hasBalance = (invoice.total_amount - invoice.paid_amount) > 0;
    return isUnpaid && hasBalance;
  });

  // Fetch selected invoice
  const { data: selectedInvoice } = useQuery({
    queryKey: ['purchase-invoice', purchaseInvoiceId],
    queryFn: () => purchaseInvoicesService.getById(purchaseInvoiceId),
    enabled: !!purchaseInvoiceId,
  });

  // Set supplier and amount from invoice
  useEffect(() => {
    if (selectedInvoice) {
      if (selectedInvoice.purchase_orders?.suppliers?.id) {
        setSupplierId(selectedInvoice.purchase_orders.suppliers.id);
      }
      const balance = selectedInvoice.total_amount - selectedInvoice.paid_amount;
      setAmount(balance);
    }
  }, [selectedInvoice]);

  // Create payment mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSupplierPaymentData) => supplierPaymentsService.create(data),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      navigate('/admin/supplier-payments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseInvoiceId) {
      toast.error('Please select an invoice');
      return;
    }

    if (!supplierId) {
      toast.error('Supplier ID is required');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    createMutation.mutate({
      purchase_invoice_id: purchaseInvoiceId,
      supplier_id: supplierId,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      amount,
      reference_number: referenceNumber || undefined,
      bank_name: bankName || undefined,
      cheque_number: chequeNumber || undefined,
      transaction_id: transactionId || undefined,
      notes: notes || undefined,
    });
  };

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
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Record Payment</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Record a supplier payment
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Purchase Invoice *</Label>
                  <Select value={purchaseInvoiceId} onValueChange={setPurchaseInvoiceId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((invoice: any) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - ₹{invoice.total_amount.toFixed(2)} 
                          {' '}(Balance: ₹{(invoice.total_amount - invoice.paid_amount).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                {paymentMethod === 'bank_transfer' && (
                  <>
                    <div>
                      <Label>Bank Name</Label>
                      <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Transaction ID</Label>
                      <Input
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                {paymentMethod === 'cheque' && (
                  <>
                    <div>
                      <Label>Bank Name</Label>
                      <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Cheque Number</Label>
                      <Input
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label>Reference Number</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            {selectedInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-medium">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">
                      {selectedInvoice.purchase_orders?.suppliers?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="font-medium">₹{selectedInvoice.total_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Amount</p>
                    <p className="font-medium">₹{selectedInvoice.paid_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-medium">
                      ₹{(selectedInvoice.total_amount - selectedInvoice.paid_amount).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/admin/supplier-payments')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || !purchaseInvoiceId || !supplierId || amount <= 0}
                  >
                    {createMutation.isPending ? 'Recording...' : 'Record Payment'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
