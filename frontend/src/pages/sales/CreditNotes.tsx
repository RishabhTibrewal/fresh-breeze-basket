import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { creditNotesService, CreditNote } from '@/api/creditNotes';
import { FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-400',
  issued: 'bg-blue-500',
  applied: 'bg-green-600',
  cancelled: 'bg-red-500',
};

export default function CreditNotes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: creditNotes = [], isLoading } = useQuery<CreditNote[]>({
    queryKey: ['credit-notes'],
    queryFn: () => creditNotesService.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CreditNote['status'] }) =>
      creditNotesService.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Credit note status updated');
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      setUpdatingId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
      setUpdatingId(null);
    },
  });

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-xl sm:text-2xl font-bold">Credit Notes</h1>
        </div>
        <Button 
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => navigate('/sales/credit-notes/new')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Credit Note
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">All Credit Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-3">CN #</TableHead>
                <TableHead className="px-3">Date</TableHead>
                <TableHead className="px-3">Customer</TableHead>
                <TableHead className="px-3">Order</TableHead>
                <TableHead className="px-3">Reason</TableHead>
                <TableHead className="text-right px-3">Amount</TableHead>
                <TableHead className="px-3">Status</TableHead>
                <TableHead className="px-3 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : creditNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No credit notes found.
                  </TableCell>
                </TableRow>
              ) : (
                creditNotes.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell className="px-3 font-mono text-xs">{cn.cn_number}</TableCell>
                    <TableCell className="px-3 text-xs">
                      {cn.cn_date ? format(new Date(cn.cn_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="px-3 text-xs">{cn.customer?.name || '—'}</TableCell>
                    <TableCell className="px-3 text-xs font-mono">
                      {cn.order?.order_number || (cn.order_id ? cn.order_id.substring(0, 8) : '—')}
                    </TableCell>
                    <TableCell className="px-3 text-xs italic text-muted-foreground">{cn.reason}</TableCell>
                    <TableCell className="text-right px-3 text-xs font-medium">
                      ₹{parseFloat(cn.total_amount.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge className={`${STATUS_COLORS[cn.status] || 'bg-gray-400'} text-white text-xs`}>
                        {cn.status.charAt(0).toUpperCase() + cn.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3">
                      {updatingId === cn.id ? (
                         <Select
                          value={cn.status}
                          onValueChange={(val) => {
                            updateStatusMutation.mutate({ id: cn.id, status: val as CreditNote['status'] });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-32 ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={cn.status === 'applied' || cn.status === 'cancelled'}
                            onClick={() => setUpdatingId(cn.id)}
                          >
                            Update Status
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
