import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { partiesService } from '@/api/parties';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, DollarSign, Printer } from 'lucide-react';
import { invoicesService } from '@/api/invoices';

export default function PartyLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['party-ledger', id, dateFrom, dateTo],
    queryFn: () => partiesService.getPartyLedger(id!, dateFrom || undefined, dateTo || undefined),
    enabled: !!id,
  });

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    let entries = [...data.entries];
    
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      entries = entries.filter(e => new Date(e.doc_date).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86400000;
      entries = entries.filter(e => new Date(e.doc_date).getTime() <= toTime);
    }
    
    return entries.sort((a, b) => new Date(b.doc_date).getTime() - new Date(a.doc_date).getTime());
  }, [data?.entries, dateFrom, dateTo]);

  const handlePrintLedger = async () => {
    if (!id) return;
    try {
      await invoicesService.printPartyLedger(id, dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      console.error('Error printing ledger:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 py-6">
        <div className="text-center text-sm text-muted-foreground">Loading trading partner ledger...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full px-4 py-6 space-y-4">
        <div className="text-center text-sm text-red-500">Failed to load trading partner ledger.</div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  const { party, totals } = data;

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">
            Trading Partner Ledger
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {party.name}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {party.is_customer && <Badge variant="outline">Customer</Badge>}
            {party.is_supplier && <Badge variant="outline">Supplier</Badge>}
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-semibold text-orange-600">
              ₹{totals.totalReceivable.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-semibold text-blue-600">
              ₹{totals.totalPayable.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Net Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-semibold">
              ₹{Math.abs(totals.netPosition).toFixed(2)}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {totals.netPosition > 0
                ? 'They owe us (Dr)'
                : totals.netPosition < 0
                ? 'We owe them (Cr)'
                : 'Balanced position'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-base sm:text-lg">Ledger Entries</CardTitle>
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
        <CardContent className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No ledger entries found for the selected range.
            </div>
          ) : (
            <Table className="min-w-[720px]">
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
                {filteredEntries.map((entry) => {
                  const amt = Number(entry.amount || 0);
                  const isDebit = entry.doc_type === 'sale' || entry.doc_type === 'payment_out';
                  const isCredit = entry.doc_type === 'purchase' || entry.doc_type === 'payment_in' || entry.doc_type === 'credit_note';
                  
                  return (
                    <TableRow key={`${entry.doc_type}-${entry.doc_id}`}>
                      <TableCell>{new Date(entry.doc_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="font-mono text-xs break-all">
                        {entry.doc_type.replace(/_/g, ' ').toUpperCase()} #{entry.doc_id.substring(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="capitalize">{entry.doc_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-orange-600 font-medium">
                        {isDebit ? `₹${amt.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium">
                        {isCredit ? `₹${amt.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="capitalize">{entry.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
