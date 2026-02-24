import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Warehouse, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { inventoryService, AdjustStockInput } from '@/api/inventory';
import { warehousesService } from '@/api/warehouses';
import { productsService, Product } from '@/api/products';
import { variantsService, ProductVariant } from '@/api/variants';
import { WarehouseSelector } from '@/components/inventory/WarehouseSelector';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const ADJUSTMENT_REASONS = [
  'Physical count discrepancy',
  'Damaged goods',
  'Expired products',
  'Theft/Loss',
  'Found stock',
  'Returned goods',
  'Other',
];

interface AdjustmentItem {
  product_id: string;
  variant_id: string;
  physical_quantity: number;
  system_stock: number;
  difference: number;
  product?: Product;
  variant?: ProductVariant;
}

export default function StockAdjustment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [reason, setReason] = useState('');

  // Get URL parameters
  const urlWarehouseId = searchParams.get('warehouse_id');
  const urlProductId = searchParams.get('product_id');
  const urlVariantId = searchParams.get('variant_id');

  // Pre-populate warehouse from URL
  useEffect(() => {
    if (urlWarehouseId && !warehouseId) {
      setWarehouseId(urlWarehouseId);
      if (urlProductId && urlVariantId) {
        // Pre-populate single item from URL
        handleAddRow(urlProductId, urlVariantId);
      }
    }
  }, [urlWarehouseId, urlProductId, urlVariantId, warehouseId]);

  // Fetch stock for items
  const fetchItemStock = async (productId: string, variantId: string) => {
    if (!warehouseId) return 0;
    try {
      const inventory = await warehousesService.getWarehouseInventory(warehouseId, {
        product_id: productId,
      });
      const variantInventory = inventory.find(item => item.variant_id === variantId);
      return variantInventory?.stock_count || 0;
    } catch {
      return 0;
    }
  };

  const handleAddRow = async (productId?: string, variantId?: string) => {
    const newItem: AdjustmentItem = {
      product_id: productId || '',
      variant_id: variantId || '',
      physical_quantity: 0,
      system_stock: 0,
      difference: 0,
    };
    
    if (productId && variantId && warehouseId) {
      const stock = await fetchItemStock(productId, variantId);
      newItem.system_stock = stock;
      
      // Fetch product and variant details
      try {
        const product = await productsService.getById(productId);
        newItem.product = product;
        newItem.variant = product.variants?.find(v => v.id === variantId);
      } catch {
        // Ignore errors
      }
    }
    
    setItems([...items, newItem]);
  };

  const handleUpdateItem = async (index: number, updates: Partial<AdjustmentItem>) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    
    // If product/variant changed, fetch stock
    if (updates.product_id || updates.variant_id) {
      const item = updatedItems[index];
      if (item.product_id && item.variant_id && warehouseId) {
        const stock = await fetchItemStock(item.product_id, item.variant_id);
        updatedItems[index].system_stock = stock;
        
        // Fetch product and variant details
        try {
          const product = await productsService.getById(item.product_id);
          updatedItems[index].product = product;
          updatedItems[index].variant = product.variants?.find(v => v.id === item.variant_id);
        } catch {
          // Ignore errors
        }
      }
    }
    
    // Recalculate difference if physical_quantity changed
    if (updates.physical_quantity !== undefined) {
      updatedItems[index].difference = updates.physical_quantity - updatedItems[index].system_stock;
    } else if (updates.system_stock !== undefined) {
      updatedItems[index].difference = updatedItems[index].physical_quantity - updates.system_stock;
    }
    
    setItems(updatedItems);
  };

  const bulkAdjustmentMutation = useMutation({
    mutationFn: async (adjustmentData: {
      warehouse_id: string;
      items: Array<{
        product_id: string;
        variant_id: string;
        physical_quantity: number;
      }>;
      reason: string;
    }) => {
      // Call adjustStock for each item sequentially
      const results = [];
      for (const item of adjustmentData.items) {
        const result = await inventoryService.adjustStock({
          warehouse_id: adjustmentData.warehouse_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          physical_quantity: item.physical_quantity,
          reason: adjustmentData.reason,
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-stock'] });
      const totalAdjusted = results.filter(r => r.movement_id).length;
      toast.success(`Successfully adjusted ${totalAdjusted} item${totalAdjusted !== 1 ? 's' : ''}`);
      // Reset form
      setWarehouseId(null);
      setItems([]);
      setReason('');
      setCurrentStep(1);
      navigate('/admin/warehouses');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to adjust stock');
    },
  });


  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!warehouseId) {
      toast.error('Please select a warehouse');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item to adjust');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      toast.error('Please enter a reason (at least 5 characters)');
      return;
    }

    bulkAdjustmentMutation.mutate({
      warehouse_id: warehouseId,
      items: items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        physical_quantity: item.physical_quantity,
      })),
      reason: reason.trim(),
    });
  };

  const handleNext = () => {
    if (currentStep === 1 && warehouseId) {
      setCurrentStep(2);
    } else if (currentStep === 2 && items.length > 0) {
      setCurrentStep(3);
    } else if (currentStep === 3 && reason.trim().length >= 5) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const totalItems = items.length;
  const totalDifference = items.reduce((sum, item) => sum + item.difference, 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/warehouses')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Warehouses
        </Button>
        <h1 className="text-3xl font-bold">Stock Adjustment</h1>
        <p className="text-muted-foreground mt-1">
          Reconcile physical stock count with system stock (bulk)
        </p>
      </div>

      {/* Step Indicator */}
      {isMobile && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    currentStep >= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-2',
                      currentStep > step ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Warehouse Selection */}
        {(currentStep === 1 || !isMobile) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                {isMobile ? 'Step 1: Select Warehouse' : 'Warehouse'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WarehouseSelector
                selectedWarehouseId={warehouseId}
                onSelect={(id) => {
                  setWarehouseId(id);
                  if (isMobile && id) {
                    setTimeout(() => handleNext(), 100);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Add Items */}
        {(!isMobile || (isMobile && warehouseId && currentStep >= 2)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {isMobile ? 'Step 2: Add Items to Adjust' : 'Items to Adjust'}
                </span>
                <Button
                  type="button"
                  onClick={() => handleAddRow()}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Product / Variant</TableHead>
                      <TableHead className="w-[120px]">System Stock</TableHead>
                      <TableHead className="w-[150px]">Physical Quantity</TableHead>
                      <TableHead className="w-[120px]">Difference</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No items added. Click "Add Row" to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <ProductVariantCombobox
                              selectedProductId={item.product_id || null}
                              selectedVariantId={item.variant_id || null}
                              onSelect={async (productId, variantId) => {
                                await handleUpdateItem(index, { product_id: productId, variant_id: variantId });
                              }}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.system_stock}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={item.physical_quantity || ''}
                              onChange={async (e) => {
                                const qty = parseInt(e.target.value) || 0;
                                await handleUpdateItem(index, { physical_quantity: qty });
                              }}
                              className="w-full"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.difference > 0 ? 'default' : item.difference < 0 ? 'destructive' : 'secondary'}>
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {items.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Items:</span>
                    <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Net Adjustment:</span>
                    <Badge variant={totalDifference > 0 ? 'default' : totalDifference < 0 ? 'destructive' : 'secondary'}>
                      {totalDifference > 0 ? '+' : ''}{totalDifference}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reason */}
        {(!isMobile || (isMobile && items.length > 0 && currentStep >= 3)) && (
          <Card>
            <CardHeader>
              <CardTitle>{isMobile ? 'Step 3: Enter Reason' : 'Adjustment Reason'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Adjustment Reason *</label>
                <Textarea
                  placeholder="Enter reason for stock adjustment..."
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (isMobile && e.target.value.trim().length >= 5) {
                      setTimeout(() => handleNext(), 500);
                    }
                  }}
                  className={isMobile ? 'min-h-24 text-base' : ''}
                  rows={isMobile ? 4 : 3}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Common reasons: {ADJUSTMENT_REASONS.slice(0, 3).join(', ')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review & Confirm - Only show on mobile */}
        {isMobile && items.length > 0 && reason.trim().length >= 5 && currentStep >= 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Review & Confirm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                <div className="mt-1 font-medium">{warehouseId}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Adjustment Items ({items.length})
                </label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                      <span>{item.product?.name} - {item.variant?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">System: {item.system_stock}</span>
                        <span>→</span>
                        <span className="font-medium">Physical: {item.physical_quantity}</span>
                        <Badge variant={item.difference > 0 ? 'default' : item.difference < 0 ? 'destructive' : 'secondary'}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t flex justify-between font-bold">
                  <span>Net Adjustment:</span>
                  <Badge variant={totalDifference > 0 ? 'default' : totalDifference < 0 ? 'destructive' : 'secondary'}>
                    {totalDifference > 0 ? '+' : ''}{totalDifference}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <div className="mt-1 p-2 bg-muted/50 rounded text-sm">{reason}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {isMobile && currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="h-12"
            >
              Back
            </Button>
          )}
          <div className="flex flex-col sm:flex-row gap-4 flex-1 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWarehouseId(null);
                setItems([]);
                setReason('');
                setCurrentStep(1);
                navigate('/admin/warehouses');
              }}
              className={isMobile ? 'h-12' : ''}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                bulkAdjustmentMutation.isPending ||
                !warehouseId ||
                items.length === 0 ||
                reason.trim().length < 5
              }
              className={isMobile ? 'h-12' : ''}
            >
              {bulkAdjustmentMutation.isPending
                ? 'Adjusting...'
                : `Adjust ${totalItems} Item${totalItems !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
