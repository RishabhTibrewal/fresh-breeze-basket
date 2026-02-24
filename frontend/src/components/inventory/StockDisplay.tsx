import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Warehouse } from 'lucide-react';
import { warehousesService } from '@/api/warehouses';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StockDisplayProps {
  productId: string;
  variantId?: string;
  warehouseId?: string;
  format?: 'compact' | 'detailed';
  className?: string;
}

export const StockDisplay: React.FC<StockDisplayProps> = ({
  productId,
  variantId,
  warehouseId,
  format = 'compact',
  className,
}) => {
  // Fetch stock data
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['product-stock', productId, variantId, warehouseId],
    queryFn: async () => {
      if (warehouseId) {
        // Get stock for specific warehouse
        const inventory = await warehousesService.getWarehouseInventory(warehouseId, {
          product_id: productId,
        });
        const variantInventory = variantId
          ? inventory.find(item => item.variant_id === variantId)
          : inventory.find(item => item.product_id === productId);
        
        return {
          total: variantInventory?.stock_count || 0,
          reserved: variantInventory?.reserved_stock || 0,
          warehouses: variantInventory ? [variantInventory] : [],
        };
      } else {
        // Get stock across all warehouses
        const stockData = await warehousesService.getProductStockAcrossWarehouses(productId);
        const variantWarehouses = variantId
          ? stockData.warehouses.filter(w => w.variant_id === variantId)
          : stockData.warehouses;
        
        const total = variantWarehouses.reduce((sum, w) => sum + (w.stock_count || 0), 0);
        const reserved = variantWarehouses.reduce((sum, w) => sum + (w.reserved_stock || 0), 0);
        
        return {
          total,
          reserved,
          warehouses: variantWarehouses,
        };
      }
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No stock data
      </div>
    );
  }

  const available = stockData.total - stockData.reserved;
  const isLowStock = available <= 10;
  const isOutOfStock = available <= 0;

  // Compact format: Just show total available
  if (format === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Package className={cn('h-4 w-4', isOutOfStock && 'text-destructive')} />
        <span className={cn(
          'text-sm font-medium',
          isOutOfStock && 'text-destructive',
          isLowStock && !isOutOfStock && 'text-orange-600'
        )}>
          {available} {available === 1 ? 'unit' : 'units'}
        </span>
        {stockData.reserved > 0 && (
          <Badge variant="outline" className="text-xs">
            {stockData.reserved} reserved
          </Badge>
        )}
      </div>
    );
  }

  // Detailed format: Show breakdown by warehouse
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="text-sm font-medium">Stock Summary</span>
        </div>
        <div className="text-right">
          <div className={cn(
            'text-lg font-bold',
            isOutOfStock && 'text-destructive',
            isLowStock && !isOutOfStock && 'text-orange-600'
          )}>
            {available}
          </div>
          <div className="text-xs text-muted-foreground">Available</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-muted-foreground">Total</div>
          <div className="font-medium">{stockData.total}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Reserved</div>
          <div className="font-medium">{stockData.reserved}</div>
        </div>
      </div>

      {stockData.warehouses.length > 0 && (
        <div className="space-y-1 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-1">By Warehouse</div>
          {stockData.warehouses.map((warehouse) => (
            <div key={warehouse.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Warehouse className="h-3 w-3" />
                <span>{warehouse.warehouses?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{warehouse.stock_count}</span>
                {warehouse.reserved_stock > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {warehouse.reserved_stock} reserved
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

