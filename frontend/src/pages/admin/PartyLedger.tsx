import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { partiesService } from '@/api/parties';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign } from 'lucide-react';

export default function PartyLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['party-ledger', id],
    queryFn: () => partiesService.getPartyLedger(id!),
    enabled: !!id,
  });

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

  const { party, entries, totals } = data;

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
            <div className="text-lg sm:text-xl font-semibold">
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
            <div className="text-lg sm:text-xl font-semibold">
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
              ₹{totals.netPosition.toFixed(2)}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {totals.netPosition > 0
                ? 'Customer owes us'
                : totals.netPosition < 0
                ? 'We owe this partner'
                : 'Balanced position'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {entries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No ledger entries found for this partner yet.
            </div>
          ) : (
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Document ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={`${entry.doc_type}-${entry.doc_id}`}>
                    <TableCell>{new Date(entry.doc_date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{entry.ledger_side}</TableCell>
                    <TableCell className="capitalize">{entry.doc_type}</TableCell>
                    <TableCell className="font-mono text-xs break-all">{entry.doc_id}</TableCell>
                    <TableCell className="capitalize">{entry.status}</TableCell>
                    <TableCell className="text-right">
                      ₹{Number(entry.amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

