import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Play, Trash2, Eye, Package, History, Calculator,
  ChevronDown, ChevronUp, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  inventoryService,
  RepackOrder,
  RepackOrderWithItems,
  CreateRepackOrderInput,
  PackagingRecipe,
} from '@/api/inventory';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ─── Pure price calculation (no side-effects) ────────────────────────────────

export interface RepackPreview {
  usableQty: number;
  outputQty: number;
  actualWastage: number;
  totalRawCost: number;
  baseCostPerUnit: number;
  finalUnitCost: number;
  isValid: boolean;
}

export function computeRepackPreview(
  inputUnitCapacity: number, // variant.unit (kg per bag, etc.)
  inputQty: number,
  targetSize: number,
  wastage: number,
  additionalCost: number,
  inputPrice: number,
): RepackPreview {
  const usableQty = inputUnitCapacity * inputQty - wastage;
  const outputQty = targetSize > 0 ? Math.floor(usableQty / targetSize) : 0;
  const actualWastage = inputUnitCapacity * inputQty - outputQty * targetSize;
  const totalRawCost = inputQty * inputPrice;
  const baseCostPerUnit = outputQty > 0 ? totalRawCost / outputQty : 0;
  const finalUnitCost = baseCostPerUnit + additionalCost;
  return {
    usableQty,
    outputQty,
    actualWastage,
    totalRawCost,
    baseCostPerUnit,
    finalUnitCost,
    isValid: outputQty > 0 && usableQty > 0,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200',
      )}
    >
      {status}
    </span>
  );
};

// ─── New Order Form ───────────────────────────────────────────────────────────

interface NewOrderFormProps {
  warehouses: { id: string; name: string }[];
  recipes: PackagingRecipe[];
  onSuccess: () => void;
}

function NewOrderForm({ warehouses, recipes, onSuccess }: NewOrderFormProps) {
  const queryClient = useQueryClient();

  // Form state
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  // Input side
  const [inputProductId, setInputProductId] = useState('');
  const [inputVariantId, setInputVariantId] = useState('');
  const [inputQty, setInputQty] = useState<number | ''>('');

  // Calculation params
  const [targetSize, setTargetSize] = useState<number | ''>('');
  const [wastage, setWastage] = useState<number | ''>('');
  const [additionalCost, setAdditionalCost] = useState<number | ''>('');

  // Output side
  const [outputProductId, setOutputProductId] = useState('');
  const [outputVariantId, setOutputVariantId] = useState('');

  // Variant metadata (fetched from existing recipe or stock)
  const [inputVariantUnit, setInputVariantUnit] = useState<number>(1);
  const [inputVariantPrice, setInputVariantPrice] = useState<number>(0);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [unitType, setUnitType] = useState('');

  // Stock fetch
  const { data: stockData } = useQuery({
    queryKey: ['repack-stock', inputProductId, warehouseId],
    queryFn: () => inventoryService.getInventoryByProductId(inputProductId),
    enabled: !!inputProductId,
  });

  // When warehoused or variant changes, look up stock
  React.useEffect(() => {
    if (!stockData || !warehouseId || !inputVariantId) { setCurrentStock(null); return; }
    const wh = stockData.warehouses.find(
      (w) => w.warehouse_id === warehouseId && w.variant_id === inputVariantId,
    );
    setCurrentStock(wh ? wh.stock_count : 0);
  }, [stockData, warehouseId, inputVariantId]);

  // Auto-fill from packaging recipe when both variants are selected
  React.useEffect(() => {
    if (!inputVariantId || !outputVariantId) return;
    const recipe = recipes.find(
      (r) => r.input_variant_id === inputVariantId && r.output_variant_id === outputVariantId,
    );
    if (recipe) {
      if (recipe.input_product_variants?.unit) {
        setInputVariantUnit(recipe.input_product_variants.unit);
        setUnitType(recipe.input_product_variants.unit_type ?? '');
      }
      if (recipe.wastage_per_input && inputQty !== '') {
        setWastage(Number(recipe.wastage_per_input) * Number(inputQty));
      }
      if (recipe.additional_cost_per_unit) {
        setAdditionalCost(Number(recipe.additional_cost_per_unit));
      }
      // conversion_ratio = output size = input_unit / conversion_ratio → target_size = variant.unit / conversion_ratio
      if (recipe.conversion_ratio && recipe.input_product_variants?.unit) {
        setTargetSize(recipe.input_product_variants.unit / recipe.conversion_ratio);
      }
    }
  }, [inputVariantId, outputVariantId, recipes]);

  // Live price preview
  const preview = useMemo<RepackPreview | null>(() => {
    if (!inputQty || !targetSize) return null;
    return computeRepackPreview(
      inputVariantUnit,
      Number(inputQty),
      Number(targetSize),
      Number(wastage ?? 0),
      Number(additionalCost ?? 0),
      inputVariantPrice,
    );
  }, [inputQty, targetSize, wastage, additionalCost, inputVariantUnit, inputVariantPrice]);

  const createMutation = useMutation({
    mutationFn: (data: CreateRepackOrderInput) => inventoryService.createRepackOrder(data),
    onError: (err: Error) => toast.error(err.message || 'Failed to create order'),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => inventoryService.processRepackOrder(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      const summary = result?.data?.items?.[0];
      if (summary) {
        toast.success(
          `✅ Repack done! ${summary.output_quantity} units produced @ ₹${fmt(summary.final_unit_cost)} each. Wastage: ${fmt(summary.wastage_quantity)}`,
          { duration: 6000 }
        );
      } else {
        toast.success('Repack order completed! Inventory updated.');
      }
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || 'Execution failed'),
  });

  const isExecuting = createMutation.isPending || processMutation.isPending;

  const handleExecute = useCallback(async () => {
    if (!warehouseId) { toast.error('Select a warehouse'); return; }
    if (!inputProductId || !inputVariantId) { toast.error('Select input product & variant'); return; }
    if (!outputProductId || !outputVariantId) { toast.error('Select output product & variant'); return; }
    if (!inputQty || Number(inputQty) <= 0) { toast.error('Enter valid input quantity'); return; }
    if (!targetSize || Number(targetSize) <= 0) { toast.error('Enter valid target size'); return; }
    if (!preview || !preview.isValid) { toast.error('Invalid parameters — computed output quantity is 0'); return; }
    if (currentStock !== null && Number(inputQty) > currentStock) {
      toast.error(`Insufficient stock. Available: ${currentStock}`);
      return;
    }

    try {
      const order = await createMutation.mutateAsync({
        warehouse_id: warehouseId,
        notes: notes || undefined,
        items: [{
          input_product_id: inputProductId,
          input_variant_id: inputVariantId,
          input_quantity: Number(inputQty),
          output_product_id: outputProductId,
          output_variant_id: outputVariantId,
          output_quantity: preview.outputQty,
          wastage_quantity: Number(wastage ?? 0),
          additional_cost_per_unit: Number(additionalCost ?? 0),
        }],
      });
      await processMutation.mutateAsync(order.id);
    } catch {
      // errors handled in onError
    }
  }, [
    warehouseId, inputProductId, inputVariantId, outputProductId, outputVariantId,
    inputQty, targetSize, wastage, additionalCost, preview, currentStock, notes,
    createMutation, processMutation,
  ]);

  const resetForm = () => {
    setWarehouseId(''); setNotes(''); setInputProductId(''); setInputVariantId('');
    setInputQty(''); setTargetSize(''); setWastage(''); setAdditionalCost('');
    setOutputProductId(''); setOutputVariantId('');
    setInputVariantUnit(1); setInputVariantPrice(0); setCurrentStock(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── Left panel: Form ── */}
      <div className="lg:col-span-3 space-y-5">
        {/* Warehouse */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Warehouse</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          >
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Input product */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Input Product &amp; Variant</label>
            {currentStock !== null && (
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                currentStock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
              )}>
                Stock: {currentStock} units
              </span>
            )}
          </div>
          <ProductVariantCombobox
            selectedProductId={inputProductId || null}
            selectedVariantId={inputVariantId || null}
            onSelect={(pid, vid) => { setInputProductId(pid); setInputVariantId(vid); }}
            filterActive={false}
            useListInModal
          />
          <p className="text-xs text-gray-400">Select bulk/input variant (bags, cartons, etc.)</p>
        </div>

        {/* Quantities row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Input Quantity (bags)</label>
            <Input
              type="number" min={1} step={1} placeholder="e.g. 10"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Target Size ({unitType || 'unit'})</label>
            <Input
              type="number" min={0.001} step={0.001} placeholder="e.g. 0.5"
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Wastage & Additional cost */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Wastage ({unitType || 'unit'})</label>
            <Input
              type="number" min={0} step={0.001} placeholder="0"
              value={wastage}
              onChange={(e) => setWastage(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Additional Cost / Unit (₹)</label>
            <Input
              type="number" min={0} step={0.01} placeholder="e.g. 2.50"
              value={additionalCost}
              onChange={(e) => setAdditionalCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Output product */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Output Product &amp; Variant</label>
          <ProductVariantCombobox
            selectedProductId={outputProductId || null}
            selectedVariantId={outputVariantId || null}
            onSelect={(pid, vid) => { setOutputProductId(pid); setOutputVariantId(vid); }}
            filterActive={false}
            useListInModal
          />
          <p className="text-xs text-gray-400">Select retail/output variant (packets, pouches, etc.)</p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Notes (optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any processing notes…"
            className="resize-none h-20 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !preview?.isValid}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
          >
            {isExecuting ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Execute Repack</>
            )}
          </Button>
          <Button variant="outline" onClick={resetForm} disabled={isExecuting}>
            Reset
          </Button>
        </div>
      </div>

      {/* ── Right panel: Live Price Preview ── */}
      <div className="lg:col-span-2">
        <div className={cn(
          'rounded-2xl border-2 p-5 h-full transition-all duration-300',
          preview?.isValid
            ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50'
            : 'border-dashed border-gray-200 bg-gray-50',
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Calculator className={cn('h-5 w-5', preview?.isValid ? 'text-indigo-600' : 'text-gray-400')} />
            <h3 className="font-semibold text-sm text-gray-700">Live Price Preview</h3>
          </div>

          {!preview ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Fill in input qty and target size to see calculations
            </p>
          ) : !preview.isValid ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg px-3 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-xs">Output quantity is 0 — check target size or wastage</span>
            </div>
          ) : (
            <div className="space-y-3">
              <PreviewRow label="Total capacity" value={`${fmt(preview.usableQty + Number(wastage ?? 0))} ${unitType}`} />
              <PreviewRow label="Wastage declared" value={`${fmt(Number(wastage ?? 0))} ${unitType}`} muted />
              <PreviewRow label="Usable quantity" value={`${fmt(preview.usableQty)} ${unitType}`} />
              <Separator className="my-1" />
              <PreviewRow
                label="Output units (bags)"
                value={String(preview.outputQty)}
                highlight
              />
              <PreviewRow label="Actual wastage" value={`${fmt(preview.actualWastage)} ${unitType}`} muted />
              <Separator className="my-1" />
              {inputVariantPrice > 0 && (
                <>
                  <PreviewRow label="Total raw cost" value={`₹${fmt(preview.totalRawCost)}`} />
                  <PreviewRow label="Base cost / unit" value={`₹${fmt(preview.baseCostPerUnit)}`} />
                  <PreviewRow label="+ Additional cost" value={`₹${fmt(Number(additionalCost ?? 0))}`} muted />
                  <div className="rounded-xl bg-white border border-indigo-200 px-4 py-3 mt-2">
                    <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-0.5">Final Unit Cost</p>
                    <p className="text-2xl font-bold text-indigo-700">₹{fmt(preview.finalUnitCost)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Will update product price on execution</p>
                  </div>
                </>
              )}
              {inputVariantPrice === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠️ Input variant has no price set — unit cost calculation will be ₹0. Set a price in the product catalog first.
                </p>
              )}
              <div className="flex items-center gap-1.5 text-green-600 mt-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Ready to execute</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn('text-xs', muted ? 'text-gray-400' : 'text-gray-600')}>{label}</span>
      <span className={cn('text-xs font-semibold', highlight ? 'text-indigo-700 text-sm' : muted ? 'text-gray-400' : 'text-gray-800')}>
        {value}
      </span>
    </div>
  );
}

// ─── Order History ────────────────────────────────────────────────────────────

interface OrderHistoryProps {
  warehouses: { id: string; name: string }[];
}

function OrderHistory({ warehouses }: OrderHistoryProps) {
  const queryClient = useQueryClient();
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['repack-orders', filterWarehouse, filterStatus],
    queryFn: () =>
      inventoryService.getRepackOrders({
        warehouse_id: filterWarehouse || undefined,
        status: filterStatus || undefined,
      }),
  });

  const { data: detailOrder } = useQuery({
    queryKey: ['repack-order', detailId],
    queryFn: () => inventoryService.getRepackOrderById(detailId!),
    enabled: !!detailId,
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => inventoryService.processRepackOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      toast.success('Order processed!');
      setDetailId(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to process'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteRepackOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repack-orders'] });
      toast.success('Draft deleted');
      setDetailId(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  });

  // Client-side date filter
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (startDate && o.created_at < startDate) return false;
      if (endDate && o.created_at > endDate + 'T23:59:59') return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterWarehouse}
          onChange={(e) => setFilterWarehouse(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm min-w-[160px] focus:ring-2 focus:ring-indigo-400 outline-none"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-400 outline-none"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex items-center gap-2">
          <Input
            type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="text-sm w-36"
          />
          <span className="text-gray-400 text-sm">–</span>
          <Input
            type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="text-sm w-36"
          />
        </div>
        {(filterWarehouse || filterStatus || startDate || endDate) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setFilterWarehouse(''); setFilterStatus(''); setStartDate(''); setEndDate(''); }}
            className="text-gray-400"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Loading orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No repack orders found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Input</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Output</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Bags In</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Bags Out</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Wastage</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Unit Cost</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onView={() => setDetailId(o.id)}
                  onProcess={() => processMutation.mutate(o.id)}
                  onDelete={() => {
                    if (window.confirm('Delete this draft repack order?')) deleteMutation.mutate(o.id);
                  }}
                  isProcessing={processMutation.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-500" />
              Repack Order Detail
            </DialogTitle>
          </DialogHeader>
          {detailOrder && <OrderDetail order={detailOrder} />}
          {detailOrder?.status === 'draft' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>
              <Button
                onClick={() => processMutation.mutate(detailOrder.id)}
                disabled={processMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {processMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <><Play className="h-4 w-4 mr-2" />Execute</>}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Order Row (expandable) ───────────────────────────────────────────────────

interface OrderRowProps {
  order: RepackOrder;
  onView: () => void;
  onProcess: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}

function OrderRow({ order, onView, onProcess, onDelete, isProcessing }: OrderRowProps) {
  const { data: detail } = useQuery({
    queryKey: ['repack-order', order.id],
    queryFn: () => inventoryService.getRepackOrderById(order.id),
    staleTime: 60_000,
  });

  const firstItem = detail?.items?.[0];
  const inputName = firstItem
    ? `${(firstItem as any).input_products?.name ?? '–'} / ${(firstItem as any).input_product_variants?.name ?? '–'}`
    : '—';
  const outputName = firstItem
    ? `${(firstItem as any).output_products?.name ?? '–'} / ${(firstItem as any).output_product_variants?.name ?? '–'}`
    : '—';

  return (
    <TableRow className="hover:bg-indigo-50/30 transition-colors">
      <TableCell className="text-sm text-gray-600">
        {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </TableCell>
      <TableCell className="text-sm font-medium text-gray-700">
        {(order.warehouses as any)?.name ?? '—'}
      </TableCell>
      <TableCell className="text-sm text-gray-600 max-w-[140px] truncate" title={inputName}>{inputName}</TableCell>
      <TableCell className="text-sm text-gray-600 max-w-[140px] truncate" title={outputName}>{outputName}</TableCell>
      <TableCell className="text-sm text-right font-mono">{firstItem ? firstItem.input_quantity : '—'}</TableCell>
      <TableCell className="text-sm text-right font-mono">{firstItem ? firstItem.output_quantity : '—'}</TableCell>
      <TableCell className="text-sm text-right font-mono text-amber-600">
        {firstItem ? fmt(Number(firstItem.wastage_quantity ?? 0)) : '—'}
      </TableCell>
      <TableCell className="text-sm text-right font-mono text-indigo-700">
        {firstItem && firstItem.unit_cost > 0 ? `₹${fmt(Number(firstItem.unit_cost))}` : '—'}
      </TableCell>
      <TableCell>{statusBadge(order.status)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="View details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {order.status === 'draft' && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600" onClick={onProcess} disabled={isProcessing} title="Execute">
                <Play className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onDelete} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────

function OrderDetail({ order }: { order: RepackOrderWithItems }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-gray-400">Status: </span>
          {statusBadge(order.status)}
        </div>
        <div>
          <span className="text-gray-400">Warehouse: </span>
          <span className="font-medium">{(order.warehouses as any)?.name ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-400">Date: </span>
          <span className="font-medium">
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
      {order.notes && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 border">
          📝 {order.notes}
        </div>
      )}
      {(order.items ?? []).length > 0 && (
        <div className="rounded-xl overflow-hidden border">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">Input</TableHead>
                <TableHead className="text-xs">Output</TableHead>
                <TableHead className="text-xs text-right">Bags In</TableHead>
                <TableHead className="text-xs text-right">Bags Out</TableHead>
                <TableHead className="text-xs text-right">Wastage</TableHead>
                <TableHead className="text-xs text-right">Unit Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items!.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-sm">
                    {((it as any).input_products)?.name} / {((it as any).input_product_variants)?.name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {((it as any).output_products)?.name} / {((it as any).output_product_variants)?.name}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono">{it.input_quantity}</TableCell>
                  <TableCell className="text-sm text-right font-mono">{it.output_quantity}</TableCell>
                  <TableCell className="text-sm text-right font-mono text-amber-600">
                    {fmt(Number(it.wastage_quantity ?? 0))}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono text-indigo-700">
                    {it.unit_cost > 0 ? `₹${fmt(Number(it.unit_cost))}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepackOrders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('new');

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['packaging-recipes'],
    queryFn: () => inventoryService.getPackagingRecipes(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repacking / Job Work</h1>
            <p className="text-sm text-gray-400 mt-0.5">Convert bulk inventory into retail units</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm rounded-xl p-1 h-auto gap-1">
            <TabsTrigger
              value="new"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Package className="h-4 w-4" />
              New Order
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <History className="h-4 w-4" />
              Order History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-5">
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-white px-6 py-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-500" />
                  Create &amp; Execute Repack Order
                </CardTitle>
                <p className="text-xs text-gray-400">Fill in the details below. The order will be created and immediately executed.</p>
              </CardHeader>
              <CardContent className="p-6">
                <NewOrderForm
                  warehouses={warehouses}
                  recipes={recipes}
                  onSuccess={() => setActiveTab('history')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-white px-6 py-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-500" />
                  Order History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <OrderHistory warehouses={warehouses} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
