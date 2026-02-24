import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Filter, X } from 'lucide-react';
import { inventoryService, StockMovement } from '@/api/inventory';
import { warehousesService } from '@/api/warehouses';
import { productsService, Product } from '@/api/products';
import { variantsService, ProductVariant } from '@/api/variants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

const MOVEMENT_TYPES = [
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER',
  'RECEIPT',
];

const ITEMS_PER_PAGE = 20;

export default function StockMovements() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<{
    warehouse_id?: string;
    product_id?: string;
    variant_id?: string;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
  }>({});
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, startDate, endDate, searchTerm]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  const selectedProductId = filters.product_id;
  const { data: variants = [] } = useQuery<ProductVariant[]>({
    queryKey: ['variants', selectedProductId],
    queryFn: () => variantsService.getByProduct(selectedProductId!),
    enabled: !!selectedProductId,
  });

  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements', filters],
    queryFn: () => inventoryService.getStockMovements({
      ...filters,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    }),
  });

  const filteredMovements = useMemo(() => {
    return movements.filter(movement => {
      const searchLower = searchTerm.toLowerCase();
      return (
        movement.product?.name.toLowerCase().includes(searchLower) ||
        movement.variant?.name.toLowerCase().includes(searchLower) ||
        movement.warehouse?.name.toLowerCase().includes(searchLower) ||
        movement.movement_type.toLowerCase().includes(searchLower) ||
        movement.notes?.toLowerCase().includes(searchLower)
      );
    });
  }, [movements, searchTerm]);

  // Pagination calculations
  const totalItems = filteredMovements.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedMovements = filteredMovements.slice(startIndex, endIndex);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'SALE':
      case 'ADJUSTMENT_OUT':
      case 'TRANSFER':
        return 'destructive';
      case 'RETURN':
      case 'ADJUSTMENT_IN':
      case 'RECEIPT':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Product', 'Variant', 'Warehouse', 'Quantity', 'Reference', 'User', 'Notes'];
    const rows = filteredMovements.map(m => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm:ss'),
      m.movement_type,
      m.product?.name || 'N/A',
      m.variant?.name || 'N/A',
      m.warehouse?.name || 'N/A',
      m.quantity.toString(),
      m.reference_id || '',
      m.user?.email || 'System',
      m.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (movement) => (
        <div className="text-sm">
          <div>{format(new Date(movement.created_at), 'MMM dd, yyyy')}</div>
          <div className="text-muted-foreground text-xs">
            {format(new Date(movement.created_at), 'HH:mm:ss')}
          </div>
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (movement) => (
        <Badge variant={getMovementTypeColor(movement.movement_type) as any}>
          {movement.movement_type}
        </Badge>
      ),
    },
    {
      key: 'product',
      header: 'Product / Variant',
      render: (movement) => (
        <div>
          <div className="font-medium">{movement.product?.name || 'N/A'}</div>
          {movement.variant && (
            <div className="text-sm text-muted-foreground">
              {movement.variant.name}
              {movement.variant.sku && ` (${movement.variant.sku})`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (movement) => movement.warehouse?.name || 'N/A',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (movement) => (
        <div className={cn(
          'font-medium',
          movement.quantity < 0 ? 'text-destructive' : 'text-green-600'
        )}>
          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (movement) => (
        <div className="text-sm">
          {movement.reference_type && (
            <div className="text-muted-foreground">{movement.reference_type}</div>
          )}
          {movement.reference_id && (
            <div className="font-mono text-xs">{movement.reference_id.slice(0, 8)}...</div>
          )}
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (movement) => movement.user?.email || 'System',
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (movement) => (
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {movement.notes || '-'}
        </div>
      ),
      mobileHide: true,
    },
  ];

  const renderCard = (movement: StockMovement) => (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">{movement.product?.name || 'N/A'}</div>
              {movement.variant && (
                <div className="text-sm text-muted-foreground">{movement.variant.name}</div>
              )}
            </div>
            <Badge variant={getMovementTypeColor(movement.movement_type) as any}>
              {movement.movement_type}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span>{format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Warehouse: </span>
              <span>{movement.warehouse?.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity: </span>
              <span className={cn(
                'font-medium',
                movement.quantity < 0 ? 'text-destructive' : 'text-green-600'
              )}>
                {movement.quantity > 0 ? '+' : ''}{movement.quantity}
              </span>
            </div>
            {movement.user && (
              <div>
                <span className="text-muted-foreground">User: </span>
                <span>{movement.user.email}</span>
              </div>
            )}
          </div>
          {movement.notes && (
            <div className="text-sm text-muted-foreground pt-2 border-t">
              {movement.notes}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const activeFiltersCount = Object.values(filters).filter(v => v).length +
    (startDate ? 1 : 0) + (endDate ? 1 : 0);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground mt-1">View stock movement history</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search movements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <Label>Warehouse</Label>
                    <Select
                      value={filters.warehouse_id || ''}
                      onValueChange={(value) =>
                        setFilters({ ...filters, warehouse_id: value || undefined })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All warehouses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Warehouses</SelectItem>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Product</Label>
                    <Select
                      value={filters.product_id || ''}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          product_id: value || undefined,
                          variant_id: undefined, // Reset variant when product changes
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Products</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {filters.product_id && (
                    <div>
                      <Label>Variant</Label>
                      <Select
                        value={filters.variant_id || ''}
                        onValueChange={(value) =>
                          setFilters({ ...filters, variant_id: value || undefined })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All variants" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Variants</SelectItem>
                          {variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Movement Type</Label>
                    <Select
                      value={filters.movement_type || ''}
                      onValueChange={(value) =>
                        setFilters({ ...filters, movement_type: value || undefined })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Types</SelectItem>
                        {MOVEMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {startDate ? format(startDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {endDate ? format(endDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFilters({});
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading movements...</div>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {totalItems === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} movements
          </div>
          <ResponsiveTable
            columns={columns}
            data={paginatedMovements}
            renderCard={renderCard}
            emptyMessage="No stock movements found"
          />
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => handlePageChange(Number(page))}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}

