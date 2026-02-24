import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Package,
  Search,
  Scale,
  ArrowRightLeft,
  Edit,
} from "lucide-react";
import { toast } from 'sonner';
import { warehousesService, WarehouseInventory as WarehouseInventoryType } from '@/api/warehouses';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { StockDisplay } from '@/components/inventory/StockDisplay';
import { useIsMobile } from '@/hooks/use-mobile';

export default function WarehouseInventory() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  // Fetch warehouse details
  const { data: warehouse } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: () => warehousesService.getById(warehouseId!),
    enabled: !!warehouseId,
  });

  // Fetch warehouse inventory
  const { data: inventory = [], isLoading } = useQuery<WarehouseInventoryType[]>({
    queryKey: ['warehouse-inventory', warehouseId],
    queryFn: () => warehousesService.getWarehouseInventory(warehouseId!),
    enabled: !!warehouseId,
  });

  const filteredInventory = inventory.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.products?.name?.toLowerCase().includes(searchLower) ||
      item.variant?.name?.toLowerCase().includes(searchLower) ||
      item.products?.description?.toLowerCase().includes(searchLower)
    );
  });

  // Group inventory by product
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const productId = item.product_id;
    if (!acc[productId]) {
      acc[productId] = {
        product: item.products,
        variants: [],
      };
    }
    acc[productId].variants.push(item);
    return acc;
  }, {} as Record<string, { product: any; variants: WarehouseInventoryType[] }>);

  const inventoryGroups = Object.values(groupedInventory);

  const columns: Column<WarehouseInventoryType>[] = [
    {
      key: 'product',
      header: 'Product / Variant',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {item.variant?.image_url ? (
              <img
                src={item.variant.image_url}
                alt={item.variant.name}
                className="w-full h-full object-cover"
              />
            ) : item.products?.image_url ? (
              <img
                src={item.products.image_url}
                alt={item.products.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-medium">{item.products?.name || `Product ${item.product_id}`}</div>
            {item.variant && (
              <div className="text-sm text-muted-foreground">
                Variant: {item.variant.name}
                {item.variant.sku && ` (${item.variant.sku})`}
              </div>
            )}
            {item.products?.description && (
              <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {item.products.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (item) => (
        <div className="space-y-1">
          <div className="font-medium text-lg">{item.stock_count}</div>
          {item.reserved_stock > 0 && (
            <div className="text-xs text-muted-foreground">
              Reserved: {item.reserved_stock}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.location || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge
          variant={
            item.stock_count > 10
              ? 'default'
              : item.stock_count > 0
              ? 'secondary'
              : 'destructive'
          }
        >
          {item.stock_count > 10
            ? 'In Stock'
            : item.stock_count > 0
            ? 'Low Stock'
            : 'Out of Stock'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/inventory/adjust?warehouse_id=${warehouseId}&product_id=${item.product_id}&variant_id=${item.variant_id}`)}
          >
            <Scale className="h-4 w-4 mr-1" />
            Adjust
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (item: WarehouseInventoryType) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {item.variant?.image_url ? (
              <img
                src={item.variant.image_url}
                alt={item.variant.name}
                className="w-full h-full object-cover"
              />
            ) : item.products?.image_url ? (
              <img
                src={item.products.image_url}
                alt={item.products.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.products?.name || `Product ${item.product_id}`}</h3>
                {item.variant && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Variant: {item.variant.name}
                    {item.variant.sku && ` (${item.variant.sku})`}
                  </p>
                )}
                {item.products?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {item.products.description}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  item.stock_count > 10
                    ? 'default'
                    : item.stock_count > 0
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {item.stock_count > 10
                  ? 'In Stock'
                  : item.stock_count > 0
                  ? 'Low Stock'
                  : 'Out of Stock'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div>
                <span className="text-muted-foreground">Stock: </span>
                <span className="font-medium text-lg">{item.stock_count}</span>
              </div>
              {item.reserved_stock > 0 && (
                <div>
                  <span className="text-muted-foreground">Reserved: </span>
                  <span className="font-medium">{item.reserved_stock}</span>
                </div>
              )}
              {item.location && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Location: </span>
                  <span>{item.location}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/inventory/adjust?warehouse_id=${warehouseId}&product_id=${item.product_id}&variant_id=${item.variant_id}`)}
                className="flex-1"
              >
                <Scale className="h-4 w-4 mr-1" />
                Adjust Stock
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/warehouses')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Warehouse Inventory</h1>
          <p className="text-muted-foreground mt-1">
            {warehouse ? `${warehouse.code} - ${warehouse.name}` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products or variants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => navigate(`/admin/inventory/transfer?source_warehouse_id=${warehouseId}`)}
          variant="outline"
        >
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Transfer Stock
        </Button>
        <Button
          onClick={() => navigate(`/admin/inventory/adjust?warehouse_id=${warehouseId}`)}
        >
          <Scale className="h-4 w-4 mr-2" />
          Adjust Stock
        </Button>
      </div>

      {/* Inventory List */}
      {isLoading ? (
        <div className="text-center py-8">Loading inventory...</div>
      ) : filteredInventory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No inventory found</p>
            <Button
              onClick={() => navigate(`/admin/inventory/adjust?warehouse_id=${warehouseId}`)}
              variant="outline"
            >
              <Scale className="h-4 w-4 mr-2" />
              Add Stock via Adjustment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredInventory}
          renderCard={renderCard}
          emptyMessage="No inventory found"
        />
      )}
    </div>
  );
}
