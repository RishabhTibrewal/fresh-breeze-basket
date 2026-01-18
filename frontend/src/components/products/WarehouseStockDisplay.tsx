import { useQuery } from '@tanstack/react-query';
import { warehousesService } from '@/api/warehouses';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

interface WarehouseStockDisplayProps {
  productId: string;
  totalStock?: number; // Optional fallback total stock
  showTotal?: boolean; // Whether to show total stock
  compact?: boolean; // Compact display mode
  bulkStockData?: { warehouses: any[], total_stock: number }; // Pre-fetched stock data
}

export default function WarehouseStockDisplay({
  productId,
  totalStock,
  showTotal = true,
  compact = false,
  bulkStockData,
}: WarehouseStockDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Use bulk data if provided, otherwise fetch individually
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['product-warehouse-stock', productId],
    queryFn: () => warehousesService.getProductStockAcrossWarehouses(productId),
    enabled: !!productId && !bulkStockData, // Only fetch if bulk data not provided
  });

  // Use bulk data if available, otherwise use fetched data
  const warehouses = bulkStockData?.warehouses || stockData?.warehouses || [];
  const totalWarehouseStock = bulkStockData?.total_stock ?? stockData?.total_stock ?? totalStock ?? 0;
  const isLoadingStock = !bulkStockData && isLoading;

  if (isLoadingStock) {
    return (
      <span className="text-xs text-muted-foreground">
        {compact ? 'Loading...' : 'Loading stock...'}
      </span>
    );
  }

  if (warehouses.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {totalWarehouseStock > 0 ? totalWarehouseStock : 'N/A'}
      </span>
    );
  }

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="text-xs text-muted-foreground hover:text-foreground underline">
            {showTotal ? totalWarehouseStock : `${warehouses.length} warehouses`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-2">
            <div className="font-medium text-sm mb-2">Stock by Warehouse</div>
            {warehouses.map((item) => (
              <div
                key={item.warehouse_id}
                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {item.warehouses?.code || 'N/A'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {item.warehouses?.name}
                  </span>
                </div>
                <Badge
                  variant={
                    item.stock_count > 10
                      ? 'default'
                      : item.stock_count > 0
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="text-xs"
                >
                  {item.stock_count}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t font-medium">
              <span>Total</span>
              <span>{totalWarehouseStock}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-1">
      {showTotal && (
        <div className="text-sm font-medium">
          Total: {totalWarehouseStock}
        </div>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="text-xs text-muted-foreground hover:text-foreground underline">
            View by warehouse ({warehouses.length})
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-2">
            <div className="font-medium text-sm mb-2">Stock by Warehouse</div>
            {warehouses.map((item) => (
              <div
                key={item.warehouse_id}
                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {item.warehouses?.code || 'N/A'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {item.warehouses?.name}
                  </span>
                </div>
                <Badge
                  variant={
                    item.stock_count > 10
                      ? 'default'
                      : item.stock_count > 0
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="text-xs"
                >
                  {item.stock_count}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t font-medium">
              <span>Total</span>
              <span>{totalWarehouseStock}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
