import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { 
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  DollarSign,
  CreditCard,
  ArrowLeft,
  Clock,
  ShoppingCart,
  Receipt,
  Search,
  Link as LinkIcon,
  Plus,
  Printer
} from 'lucide-react';
import { suppliersService } from '@/api/suppliers';
import { purchaseOrdersService } from '@/api/purchaseOrders';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { supplierPaymentsService } from '@/api/supplierPayments';
import { partiesService } from '@/api/parties';
import { invoicesService } from '@/api/invoices';
import { ErrorMessage } from '@/components/ui/error-message';

export default function SupplierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  // Determine back route
  const getBackRoute = () => {
    if (location.pathname.startsWith('/procurement')) {
      return '/procurement/suppliers';
    }
    return '/admin/suppliers';
  };

  // Fetch supplier details
  const { data: supplier, isLoading, isError, error } = useQuery({
    queryKey: ['admin-supplier', id],
    queryFn: () => suppliersService.getById(id!),
    enabled: !!id
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['supplier-pos', id],
    queryFn: () => purchaseOrdersService.getAll({ supplier_id: id }),
    enabled: !!id
  });

  // Fetch purchase invoices
  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ['supplier-invoices', id],
    queryFn: () => purchaseInvoicesService.getAll({ supplier_id: id }),
    enabled: !!id
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['supplier-payments-list', id],
    queryFn: () => supplierPaymentsService.getAll({ supplier_id: id }),
    enabled: !!id
  });

  // Fetch party ledger
  const { data: partyLedger } = useQuery({
    queryKey: ['supplier-party-ledger', supplier?.party_id, dateFrom, dateTo],
    queryFn: () => partiesService.getPartyLedger(supplier!.party_id!, dateFrom || undefined, dateTo || undefined),
    enabled: !!supplier?.party_id,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy, h:mm a');
  };

  // Filter party ledger entries locally for the UI table
  const filteredLedgerEntries = React.useMemo(() => {
    if (!partyLedger?.entries) return [];
    let entries = [...partyLedger.entries];
    
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      entries = entries.filter(e => new Date(e.doc_date).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86400000; // include full day
      entries = entries.filter(e => new Date(e.doc_date).getTime() <= toTime);
    }

    return entries.sort((a, b) => new Date(b.doc_date).getTime() - new Date(a.doc_date).getTime());
  }, [partyLedger?.entries, dateFrom, dateTo]);

  const handlePrintLedger = async () => {
    if (!supplier?.party_id) return;
    try {
      await invoicesService.printPartyLedger(supplier.party_id, dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      console.error('Error printing ledger:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 py-6 flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="w-full px-4 py-6">
        <ErrorMessage 
          title="Error loading supplier" 
          message={error instanceof Error ? error.message : 'Supplier details not found'}
        />
        <Button variant="outline" onClick={() => navigate(getBackRoute())} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Suppliers
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">
            Supplier Details
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {supplier.name} {supplier.supplier_code ? `(${supplier.supplier_code})` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(getBackRoute())} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Suppliers
        </Button>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4 grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="details" className="text-xs sm:text-sm">Supplier Details</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">Purchase History</TabsTrigger>
          {supplier.party_id && (
            <TabsTrigger value="party-ledger" className="text-xs sm:text-sm">Party Ledger</TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Details */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Primary Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  Primary Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplier.legal_name && (
                  <div>
                    <span className="text-xs text-muted-foreground">Legal Name</span>
                    <p className="font-medium text-sm sm:text-base">{supplier.legal_name}</p>
                  </div>
                )}
                {supplier.trade_name && (
                  <div>
                    <span className="text-xs text-muted-foreground">Trade Name</span>
                    <p className="font-medium text-sm sm:text-base">{supplier.trade_name}</p>
                  </div>
                )}
                {supplier.vendor_name && (
                  <div>
                    <span className="text-xs text-muted-foreground">Vendor Name</span>
                    <p className="font-medium text-sm sm:text-base">{supplier.vendor_name}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Supplier Name</span>
                  <p className="font-medium text-sm sm:text-base">{supplier.name}</p>
                </div>
                {supplier.contact_name && (
                  <div>
                    <span className="text-xs text-muted-foreground">Contact Representative</span>
                    <p className="font-medium text-sm sm:text-base">{supplier.contact_name}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Email</span>
                  <p className="font-medium text-sm sm:text-base break-all">{supplier.email || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <p className="font-medium text-sm sm:text-base">{supplier.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Address Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Address</span>
                  <p className="font-medium text-sm sm:text-base whitespace-pre-line">{supplier.address || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">City</span>
                    <p className="font-medium text-sm">{supplier.city || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">State</span>
                    <p className="font-medium text-sm">{supplier.state || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Country</span>
                    <p className="font-medium text-sm">{supplier.country || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Postal Code</span>
                    <p className="font-medium text-sm">{supplier.postal_code || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tax & Financial Identifiers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  Tax & Identifiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">GST No.</span>
                  <p className="font-medium text-sm sm:text-base">{supplier.gst_no || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">PAN Number</span>
                  <p className="font-medium text-sm sm:text-base">{supplier.pan_number || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Udyam Registration</span>
                  <p className="font-medium text-sm sm:text-base">{supplier.udyam_registration_number || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <span className="text-xs text-muted-foreground">Opening Balance</span>
                    <p className="font-medium text-sm">₹ {supplier.opening_balance?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Closing Balance</span>
                    <p className="font-medium text-sm">₹ {supplier.closing_balance?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional info & Bank Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                  Terms & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Payment Terms</span>
                  <p className="font-medium text-sm">{supplier.payment_terms || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <p className="font-medium text-sm whitespace-pre-line">{supplier.notes || 'No notes available.'}</p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Bank Accounts List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Supplier Bank Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {!supplier.supplier_bank_accounts || supplier.supplier_bank_accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">No bank accounts linked to this supplier.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Holder</TableHead>
                        <TableHead>Bank Name</TableHead>
                        <TableHead>Account Number</TableHead>
                        <TableHead>IFSC Code</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.supplier_bank_accounts.map((acc: any) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_holder_name || '-'}</TableCell>
                          <TableCell>{acc.bank_name || '-'}</TableCell>
                          <TableCell>{acc.account_number || '-'}</TableCell>
                          <TableCell>{acc.ifsc_code || '-'}</TableCell>
                          <TableCell>
                            {acc.is_primary ? (
                              <Badge className="bg-green-100 text-green-800">Primary</Badge>
                            ) : (
                              <Badge variant="secondary">Secondary</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Purchase History */}
        <TabsContent value="history" className="space-y-6">
          
          {/* Purchase Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                Purchase Orders ({purchaseOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No purchase orders found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.map((po: any) => (
                        <TableRow key={po.id}>
                          <TableCell>{formatDate(po.order_date || po.created_at)}</TableCell>
                          <TableCell className="font-mono">{po.po_number}</TableCell>
                          <TableCell className="capitalize">
                            <Badge variant={po.status === 'received' ? 'default' : 'outline'}>{po.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">₹ {po.total_amount?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                Purchase Invoices ({purchaseInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No purchase invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>System Inv No.</TableHead>
                        <TableHead>Supplier Inv No.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right font-medium">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseInvoices.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell>{formatDate(inv.invoice_date || inv.created_at)}</TableCell>
                          <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.supplier_invoice_number || '-'}</TableCell>
                          <TableCell className="capitalize">
                            <Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>{inv.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">₹ {inv.total_amount?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                Outgoing Payments ({payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payments history found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Payment No.</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.payment_date || p.created_at)}</TableCell>
                          <TableCell className="font-mono">{p.payment_number}</TableCell>
                          <TableCell className="capitalize">{p.payment_method}</TableCell>
                          <TableCell className="capitalize">
                            <Badge variant={p.status === 'completed' ? 'default' : 'outline'}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">₹ {p.amount?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Tab 3: Party Ledger (Unified receivables/payables) */}
        {supplier.party_id && (
          <TabsContent value="party-ledger" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    Trading Partner Ledger
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Standard debit/credit double entry ledger statement.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>From</span>
                    <Input 
                      type="date" 
                      value={dateFrom} 
                      onChange={(e) => setDateFrom(e.target.value)} 
                      className="h-8 text-xs py-1"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>To</span>
                    <Input 
                      type="date" 
                      value={dateTo} 
                      onChange={(e) => setDateTo(e.target.value)} 
                      className="h-8 text-xs py-1"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="h-8 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                  <Button size="sm" onClick={handlePrintLedger} className="h-8 text-xs ml-auto sm:ml-0">
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Print Ledger
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {partyLedger ? (
                  <>
                    {/* Summary row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total Receivable (Sales)</p>
                        <p className="text-base font-semibold text-orange-600">₹ {partyLedger.totals.totalReceivable.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total Payable (Purchases)</p>
                        <p className="text-base font-semibold text-blue-600">₹ {partyLedger.totals.totalPayable.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Net Position</p>
                        <p className={`text-base font-semibold ${
                          partyLedger.totals.netPosition > 0 ? 'text-orange-600' :
                          partyLedger.totals.netPosition < 0 ? 'text-blue-600' : 'text-muted-foreground'
                        }`}>
                          ₹ {Math.abs(partyLedger.totals.netPosition).toFixed(2)} {partyLedger.totals.netPosition > 0 ? 'Dr (They owe)' : partyLedger.totals.netPosition < 0 ? 'Cr (We owe)' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Particulars</TableHead>
                            <TableHead>Vch Type</TableHead>
                            <TableHead>Debit (Dr)</TableHead>
                            <TableHead>Credit (Cr)</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLedgerEntries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                No ledger entries found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredLedgerEntries.map((entry) => {
                              const amt = Number(entry.amount);
                              
                              // Check side:
                              // Debit: sale, payment_out
                              // Credit: purchase, payment_in, credit_note
                              const isDebit = entry.doc_type === 'sale' || entry.doc_type === 'payment_out';
                              const isCredit = entry.doc_type === 'purchase' || entry.doc_type === 'payment_in' || entry.doc_type === 'credit_note';
                              
                              return (
                                <TableRow key={entry.doc_id}>
                                  <TableCell>{formatDate(entry.doc_date)}</TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {entry.doc_type.replace(/_/g, ' ').toUpperCase()} #{entry.doc_id.substring(0, 8).toUpperCase()}
                                  </TableCell>
                                  <TableCell className="capitalize">{entry.doc_type.replace(/_/g, ' ')}</TableCell>
                                  <TableCell className="text-orange-600 font-medium">
                                    {isDebit ? `₹ ${amt.toFixed(2)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-blue-600 font-medium">
                                    {isCredit ? `₹ ${amt.toFixed(2)}` : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs capitalize">{entry.status}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/party/${partyLedger.party.id}/ledger`)}
                    >
                      View Full Party Ledger Page
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading party ledger...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}
