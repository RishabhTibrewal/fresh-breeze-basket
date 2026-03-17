import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Play, Trash2, Eye } from 'lucide-react';
import { inventoryService, RepackOrder, CreateRepackOrderInput, PackagingRecipe } from '@/api/inventory';
import { warehousesService } from '@/api/warehouses';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface RepackItemRow {
  input_product_id: string;
  input_variant_id: string;
  output_product_id: string;
  output_variant_id: string;
  input_quantity: number;
  output_quantity: number;
}

export default function RepackOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RepackItemRow[]>([]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['repack-orders'],
    queryFn: () => inventoryService.getRepackOrders(),
  });

  const { data: detailOrder } = useQuery({
    queryKey: ['repack-order', detailId],
    queryFn: () => inventoryService.getRepackOrderById(detailId!),
    enabled: !!detailId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['packaging-recipes'],
    queryFn: () => inventoryService.getPackagingRecipes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRepackOrderInput) => inventoryService.createRepackOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      toast.success('Repack order created');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create repack order'),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => inventoryService.processRepackOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Repack order processed');
      setDetailId(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to process'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteRepackOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      toast.success('Repack order deleted');
      setDetailId(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  });

  const resetForm = () => {
    setWarehouseId('');
    setNotes('');
    setItems([]);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        input_product_id: '',
        input_variant_id: '',
        output_product_id: '',
        output_variant_id: '',
        input_quantity: 0,
        output_quantity: 0,
      },
    ]);
  };

  const updateItem = (index: number, updates: Partial<RepackItemRow>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    setItems(next);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!warehouseId) {
      toast.error('Select warehouse');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const valid = items.every(
      (i) =>
        i.input_product_id &&
        i.input_variant_id &&
        i.output_product_id &&
        i.output_variant_id &&
        i.input_quantity > 0 &&
        i.output_quantity > 0
    );
    if (!valid) {
      toast.error('Fill all item fields and ensure quantities > 0');
      return;
    }
    createMutation.mutate({
      warehouse_id: warehouseId,
      notes: notes || undefined,
      items: items.map((i) => ({
        input_product_id: i.input_product_id,
        input_variant_id: i.input_variant_id,
        output_product_id: i.output_product_id,
        output_variant_id: i.output_variant_id,
        input_quantity: i.input_quantity,
        output_quantity: i.output_quantity,
      })),
    });
  };

  const getRecipeForItem = (inputVid: string, outputVid: string): PackagingRecipe | undefined =>
    recipes.find((r) => r.input_variant_id === inputVid && r.output_variant_id === outputVid);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Repack Orders</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Repack Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <p className="text-sm text-muted-foreground">Break down bulk into retail units. Create draft, then process.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No repack orders yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{(o.warehouses as any)?.name || o.warehouse_id}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'completed' ? 'default' : 'secondary'}>{o.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(o.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {o.status === 'draft' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => processMutation.mutate(o.id)}
                            disabled={processMutation.isPending}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm('Delete this draft?')) deleteMutation.mutate(o.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn(isMobile && 'max-w-[95vw] max-h-[90vh] overflow-y-auto')} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New Repack Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Items</label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  Add line
                </Button>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {items.map((item, idx) => {
                  const recipe = getRecipeForItem(item.input_variant_id, item.output_variant_id);
                  return (
                    <div key={idx} className="border rounded p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium">Line {idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ProductVariantCombobox
                          selectedProductId={item.input_product_id || null}
                          selectedVariantId={item.input_variant_id || null}
                          onSelect={(pid, vid) => updateItem(idx, { input_product_id: pid, input_variant_id: vid })}
                          filterActive={false}
                          useListInModal
                        />
                        <ProductVariantCombobox
                          selectedProductId={item.output_product_id || null}
                          selectedVariantId={item.output_variant_id || null}
                          onSelect={(pid, vid) => updateItem(idx, { output_product_id: pid, output_variant_id: vid })}
                          filterActive={false}
                          useListInModal
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Input qty"
                          value={item.input_quantity || ''}
                          onChange={(e) => updateItem(idx, { input_quantity: parseFloat(e.target.value) || 0 })}
                          min={0}
                          step="0.01"
                        />
                        <Input
                          type="number"
                          placeholder="Output qty"
                          value={item.output_quantity || ''}
                          onChange={(e) => updateItem(idx, { output_quantity: parseInt(e.target.value, 10) || 0 })}
                          min={0}
                        />
                        {recipe && (
                          <span className="text-xs text-muted-foreground self-center">ratio: {recipe.conversion_ratio}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Repack Order</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Status:</span>{' '}
                <Badge variant={detailOrder.status === 'completed' ? 'default' : 'secondary'}>
                  {detailOrder.status}
                </Badge>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Warehouse:</span>{' '}
                {(detailOrder.warehouses as any)?.name}
              </div>
              {detailOrder.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Notes:</span> {detailOrder.notes}
                </div>
              )}
              {(detailOrder.items || []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Input</TableHead>
                      <TableHead>Output</TableHead>
                      <TableHead>In Qty</TableHead>
                      <TableHead>Out Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrder.items!.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          {((it as any).input_products || (it as any).input_product)?.name} /{' '}
                          {((it as any).input_product_variants || (it as any).input_variant)?.name}
                        </TableCell>
                        <TableCell>
                          {((it as any).output_products || (it as any).output_product)?.name} /{' '}
                          {((it as any).output_product_variants || (it as any).output_variant)?.name}
                        </TableCell>
                        <TableCell>{it.input_quantity}</TableCell>
                        <TableCell>{it.output_quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {detailOrder.status === 'draft' && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailId(null)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => processMutation.mutate(detailOrder.id)}
                    disabled={processMutation.isPending}
                  >
                    Process
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
