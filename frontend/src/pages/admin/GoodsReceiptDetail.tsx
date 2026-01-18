import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { goodsReceiptsService } from '@/api/goodsReceipts';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: grn, isLoading } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => goodsReceiptsService.getById(id!),
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: () => goodsReceiptsService.complete(id!),
    onSuccess: () => {
      toast.success('GRN completed and inventory updated');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
    },
  });

  if (isLoading || !grn) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/goods-receipts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{grn.grn_number}</h1>
        <Badge>{grn.status.toUpperCase()}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Batch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.goods_receipt_items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell>{item.quantity_received}</TableCell>
                  <TableCell>{item.quantity_accepted}</TableCell>
                  <TableCell>{item.quantity_rejected}</TableCell>
                  <TableCell>{item.batch_number || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {grn.status !== 'completed' && (
        <Button onClick={() => completeMutation.mutate()}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete GRN
        </Button>
      )}
    </div>
  );
}
