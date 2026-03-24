import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Play, Loader2 } from 'lucide-react';
import { repackService } from '@/api/repackService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
        map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200',
      )}
    >
      {status}
    </span>
  );
};

export default function RepackOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['repack-orders-v3'],
    queryFn: () => repackService.getRepackOrders(),
  });

  const confirmMutation = useMutation({
    mutationFn: (orderId: string) => repackService.confirmRepackOrder(orderId),
    onSuccess: () => {
      toast.success("Repack Executed Successfully!");
      queryClient.invalidateQueries({ queryKey: ['repack-orders-v3'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to execute repack order");
    }
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Repack Orders Execution Log</h1>
        </div>
        <Button onClick={() => navigate('/inventory/repack-orders/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Execute Repack
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <p className="text-sm text-muted-foreground">
            Log of all raw materials consumed and finished goods produced.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No repack activity recorded yet.</div>
          ) : (
            <div className="relative overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Consumed (Inputs)</TableHead>
                    <TableHead>Produced (Outputs)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(o.created_at), 'PPP')}
                      </TableCell>
                      <TableCell className="font-medium">{o.warehouse?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-1">
                          {o.inputs?.map((i: any) => (
                            <li key={i.id} className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                                  {i.input_quantity}
                                </span>
                                {i.product?.name} ({i.variant?.name})
                              </div>
                              {(i.wastage_quantity > 0 || i.wastage_quantity === 0) && (
                                <span className="text-[10px] text-destructive ml-8">
                                  Wastage: {i.wastage_quantity}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-1">
                          {o.outputs?.map((out: any) => (
                            <li key={out.id} className="flex flex-col gap-0.5 border-l-2 border-emerald-400 pl-2">
                              <div className="flex items-center gap-2 text-emerald-900">
                                <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-xs font-semibold">
                                  {out.output_quantity}
                                </span>
                                {out.product?.name} ({out.variant?.name})
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-1 flex gap-2">
                                <span>Unit Base Cost: ₹{out.unit_cost?.toFixed(2)}</span>
                                {out.additional_cost_per_unit > 0 && <span>+ Addl: ₹{out.additional_cost_per_unit?.toFixed(2)}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell>
                        {statusBadge(o.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.status === 'draft' && (
                          <div className="flex justify-end items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => navigate(`/inventory/repack-orders/${o.id}/edit`)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => confirmMutation.mutate(o.id)}
                              disabled={confirmMutation.isPending}
                              className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                            >
                              {confirmMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                              Execute
                            </Button>
                          </div>
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
    </div>
  );
}
