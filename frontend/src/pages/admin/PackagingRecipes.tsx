import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { inventoryService, PackagingRecipe, CreatePackagingRecipeInput } from '@/api/inventory';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function PackagingRecipes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePackagingRecipeInput>({
    input_product_id: '',
    input_variant_id: '',
    output_product_id: '',
    output_variant_id: '',
    conversion_ratio: 0,
  });

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['packaging-recipes'],
    queryFn: () => inventoryService.getPackagingRecipes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePackagingRecipeInput) => inventoryService.createPackagingRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-recipes'] });
      toast.success('Recipe created');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create recipe'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePackagingRecipeInput> }) =>
      inventoryService.updatePackagingRecipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-recipes'] });
      toast.success('Recipe updated');
      setDialogOpen(false);
      setEditingId(null);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update recipe'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deletePackagingRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-recipes'] });
      toast.success('Recipe deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete recipe'),
  });

  const resetForm = () => {
    setForm({
      input_product_id: '',
      input_variant_id: '',
      output_product_id: '',
      output_variant_id: '',
      conversion_ratio: 0,
    });
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (r: PackagingRecipe) => {
    setEditingId(r.id);
    setForm({
      input_product_id: r.input_product_id,
      input_variant_id: r.input_variant_id,
      output_product_id: r.output_product_id,
      output_variant_id: r.output_variant_id,
      conversion_ratio: r.conversion_ratio,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.input_product_id || !form.input_variant_id || !form.output_product_id || !form.output_variant_id) {
      toast.error('Select input and output product + variant');
      return;
    }
    if (form.conversion_ratio <= 0) {
      toast.error('Conversion ratio must be > 0');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { conversion_ratio: form.conversion_ratio } });
    } else {
      createMutation.mutate(form);
    }
  };

  const inputLabel = (r: PackagingRecipe) => {
    const p = r.input_products || (r as any).input_product;
    const v = r.input_product_variants || (r as any).input_variant;
    return `${p?.name || '?'} / ${v?.name || '?'}`;
  };
  const outputLabel = (r: PackagingRecipe) => {
    const p = r.output_products || (r as any).output_product;
    const v = r.output_product_variants || (r as any).output_variant;
    return `${p?.name || '?'} / ${v?.name || '?'}`;
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Packaging Recipes</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Recipe
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define conversions from bulk to retail. conversion_ratio = input qty (in input variant unit) per 1 output unit.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : recipes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No recipes. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input (Bulk)</TableHead>
                  <TableHead>Output (Retail)</TableHead>
                  <TableHead>Conversion Ratio</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{inputLabel(r)}</TableCell>
                    <TableCell>{outputLabel(r)}</TableCell>
                    <TableCell>{r.conversion_ratio}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm('Delete this recipe?')) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn(isMobile && 'max-w-[95vw]')} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingId && (
              <p className="text-sm text-muted-foreground">Only conversion ratio can be edited.</p>
            )}
            <div>
              <label className="text-sm font-medium">Input (Bulk) - Product + Variant</label>
              <ProductVariantCombobox
                selectedProductId={form.input_product_id || null}
                selectedVariantId={form.input_variant_id || null}
                onSelect={(productId, variantId) => setForm((f) => ({ ...f, input_product_id: productId, input_variant_id: variantId }))}
                filterActive={false}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Output (Retail) - Product + Variant</label>
              <ProductVariantCombobox
                selectedProductId={form.output_product_id || null}
                selectedVariantId={form.output_variant_id || null}
                onSelect={(productId, variantId) => setForm((f) => ({ ...f, output_product_id: productId, output_variant_id: variantId }))}
                filterActive={false}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conversion Ratio (input qty per 1 output)</label>
              <Input
                type="number"
                step="0.000001"
                min="0"
                value={form.conversion_ratio || ''}
                onChange={(e) => setForm((f) => ({ ...f, conversion_ratio: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 0.25"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">e.g. 0.25 = 0.25 kg bulk per 1×250g packet</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
