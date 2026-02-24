import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Warehouse, Plus, Trash2, AlertCircle } from 'lucide-react';
import { inventoryService, TransferStockItem } from '@/api/inventory';
import { warehousesService } from '@/api/warehouses';
import { productsService, Product } from '@/api/products';
import { ProductVariant } from '@/api/variants';
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
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface TransferItem {
  product_id: string;
  variant_id: string;
  quantity: number;
  product?: Product;
  variant?: ProductVariant;
  availableStock?: number;
}

export default function StockTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [notes, setNotes] = useState('');

  // Fetch warehouse details
  const { data: sourceWarehouse } = useQuery({
    queryKey: ['warehouse', sourceWarehouseId],
    queryFn: () => warehousesService.getById(sourceWarehouseId!),
    enabled: !!sourceWarehouseId,
  });

  const { data: destinationWarehouse } = useQuery({
    queryKey: ['warehouse', destinationWarehouseId],
    queryFn: () => warehousesService.getById(destinationWarehouseId!),
    enabled: !!destinationWarehouseId,
  });

  // Fetch stock for items
  const fetchItemStock = async (productId: string, variantId: string) => {
    if (!sourceWarehouseId) return 0;
    try {
      const inventory = await warehousesService.getWarehouseInventory(sourceWarehouseId, {
        product_id: productId,
      });
      const variantInventory = inventory.find(item => item.variant_id === variantId);
      return variantInventory?.stock_count || 0;
    } catch {
      return 0;
    }
  };

  const handleAddRow = async (productId?: string, variantId?: string) => {
    const newItem: TransferItem = {
      product_id: productId || '',
      variant_id: variantId || '',
      quantity: 0,
    };
    
    if (productId && variantId && sourceWarehouseId) {
      const stock = await fetchItemStock(productId, variantId);
      newItem.availableStock = stock;
      
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

  const handleUpdateItem = async (index: number, updates: Partial<TransferItem>) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    
    // If product/variant changed, fetch stock
    if (updates.product_id || updates.variant_id) {
      const item = updatedItems[index];
      if (item.product_id && item.variant_id && sourceWarehouseId) {
        const stock = await fetchItemStock(item.product_id, item.variant_id);
        updatedItems[index].availableStock = stock;
        
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
    
    setItems(updatedItems);
  };

  const transferMutation = useMutation({
    mutationFn: (transferData: {
      source_warehouse_id: string;
      destination_warehouse_id: string;
      items: TransferStockItem[];
      notes?: string;
    }) => inventoryService.transferStock(transferData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-stock'] });
      toast.success('Stock transferred successfully');
      // Reset form
      setSourceWarehouseId(null);
      setDestinationWarehouseId(null);
      setItems([]);
      setNotes('');
      setCurrentStep(1);
      navigate('/admin/warehouses');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to transfer stock');
    },
  });


  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!sourceWarehouseId || !destinationWarehouseId) {
      toast.error('Please select source and destination warehouses');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item to transfer');
      return;
    }

    transferMutation.mutate({
      source_warehouse_id: sourceWarehouseId,
      destination_warehouse_id: destinationWarehouseId,
      items: items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
      notes: notes || undefined,
    });
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
        <h1 className="text-3xl font-bold">Stock Transfer</h1>
        <p className="text-muted-foreground mt-1">
          Transfer stock between warehouses
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
        {/* Source Warehouse */}
        {(currentStep === 1 || !isMobile) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                {isMobile ? 'Step 1: Select Source Warehouse' : 'Source Warehouse'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WarehouseSelector
                selectedWarehouseId={sourceWarehouseId}
                onSelect={(id) => {
                  setSourceWarehouseId(id);
                  if (isMobile && id) {
                    setTimeout(() => setCurrentStep(2), 100);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Destination Warehouse */}
        {(!isMobile || (isMobile && sourceWarehouseId && currentStep >= 2)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                {isMobile ? 'Step 2: Select Destination Warehouse' : 'Destination Warehouse'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceWarehouseId === destinationWarehouseId && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Source and destination warehouses cannot be the same
                  </AlertDescription>
                </Alert>
              )}
              <WarehouseSelector
                selectedWarehouseId={destinationWarehouseId}
                onSelect={(id) => {
                  if (id === sourceWarehouseId) {
                    toast.error('Source and destination warehouses cannot be the same');
                    return;
                  }
                  setDestinationWarehouseId(id);
                  if (isMobile && id) {
                    setTimeout(() => setCurrentStep(3), 100);
                  }
                }}
                filterActive
              />
            </CardContent>
          </Card>
        )}

        {/* Add Items */}
        {(!isMobile || (isMobile && destinationWarehouseId && currentStep >= 3)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {isMobile ? 'Step 3: Add Items to Transfer' : 'Items to Transfer'}
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
                      <TableHead className="w-[120px]">Available Stock</TableHead>
                      <TableHead className="w-[150px]">Transfer Quantity</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                            <div className="font-medium">{item.availableStock ?? '-'}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              max={item.availableStock}
                              value={item.quantity || ''}
                              onChange={async (e) => {
                                const qty = parseInt(e.target.value) || 0;
                                if (item.availableStock !== undefined && qty > item.availableStock) {
                                  toast.error(`Insufficient stock. Available: ${item.availableStock}`);
                                  return;
                                }
                                await handleUpdateItem(index, { quantity: qty });
                              }}
                              className="w-full"
                              placeholder="0"
                            />
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
                    <span>{totalItems} units</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {(!isMobile || (isMobile && items.length > 0 && currentStep >= 4)) && (
          <Card>
            <CardHeader>
              <CardTitle>{isMobile ? 'Step 4: Review & Notes' : 'Notes'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isMobile && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Source Warehouse</label>
                      <div className="mt-1 font-medium">{sourceWarehouse?.name || sourceWarehouseId}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Destination Warehouse</label>
                      <div className="mt-1 font-medium">{destinationWarehouse?.name || destinationWarehouseId}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Transfer Items ({items.length})
                    </label>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>{item.product?.name} - {item.variant?.name}</span>
                          <span className="font-medium">{item.quantity} units</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between font-bold">
                      <span>Total:</span>
                      <span>{totalItems} units</span>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this transfer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={isMobile ? 'min-h-24 text-base' : ''}
                  rows={isMobile ? 4 : 3}
                />
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
              onClick={() => setCurrentStep(currentStep - 1)}
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
                setSourceWarehouseId(null);
                setDestinationWarehouseId(null);
                setItems([]);
                setNotes('');
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
                transferMutation.isPending ||
                !sourceWarehouseId ||
                !destinationWarehouseId ||
                items.length === 0
              }
              className={isMobile ? 'h-12' : ''}
            >
              {transferMutation.isPending ? 'Transferring...' : `Transfer ${totalItems} Units`}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}

