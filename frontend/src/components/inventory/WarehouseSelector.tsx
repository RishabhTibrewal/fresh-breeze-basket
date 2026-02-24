import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Warehouse, Check } from 'lucide-react';
import { warehousesService, Warehouse as WarehouseType } from '@/api/warehouses';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface WarehouseSelectorProps {
  selectedWarehouseId: string | null;
  onSelect: (warehouseId: string | null) => void;
  showAllOption?: boolean;
  filterActive?: boolean; // Only show active warehouses
  className?: string;
}

export const WarehouseSelector: React.FC<WarehouseSelectorProps> = ({
  selectedWarehouseId,
  onSelect,
  showAllOption = false,
  filterActive = true,
  className,
}) => {
  const isMobile = useIsMobile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: warehouses = [], isLoading } = useQuery<WarehouseType[]>({
    queryKey: ['warehouses', filterActive],
    queryFn: () => warehousesService.getAll(filterActive ? true : undefined),
  });

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    warehouse.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  // Desktop: Use Select component
  if (!isMobile) {
    // Determine the display value for the Select
    // Use 'all' if showAllOption and nothing selected, otherwise use selectedWarehouseId or undefined
    const selectValue = selectedWarehouseId || (showAllOption ? 'all' : undefined);
    
    return (
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value === 'all' || value === 'loading') {
            onSelect(null);
          } else {
            onSelect(value);
          }
        }}
      >
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder="Select warehouse">
            {selectedWarehouse ? (
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4" />
                <span>{selectedWarehouse.name}</span>
                <span className="text-muted-foreground text-sm">({selectedWarehouse.code})</span>
              </div>
            ) : (
              'Select warehouse'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">All Warehouses</SelectItem>
          )}
          {isLoading ? (
            <SelectItem value="loading" disabled>Loading...</SelectItem>
          ) : (
            filteredWarehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  <span>{warehouse.name}</span>
                  <span className="text-muted-foreground text-sm">({warehouse.code})</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }

  // Mobile: Use full-screen modal
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn('w-full justify-start', className)}
        onClick={() => setIsModalOpen(true)}
      >
        {selectedWarehouse ? (
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            <span className="flex-1 text-left">{selectedWarehouse.name}</span>
            <span className="text-muted-foreground text-sm">({selectedWarehouse.code})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            <span>Select warehouse</span>
          </div>
        )}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-full h-full max-h-screen m-0 rounded-none sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Select Warehouse</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search warehouses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Warehouse List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading warehouses...</div>
              ) : filteredWarehouses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No warehouses found</div>
              ) : (
                <div className="space-y-2">
                  {showAllOption && (
                    <button
                      onClick={() => {
                        onSelect(null);
                        setIsModalOpen(false);
                      }}
                      className={cn(
                        'w-full p-4 rounded-lg border text-left transition-colors',
                        !selectedWarehouseId
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Warehouse className="h-5 w-5" />
                          <span className="font-medium">All Warehouses</span>
                        </div>
                        {!selectedWarehouseId && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  )}
                  {filteredWarehouses.map((warehouse) => (
                    <button
                      key={warehouse.id}
                      onClick={() => {
                        onSelect(warehouse.id);
                        setIsModalOpen(false);
                      }}
                      className={cn(
                        'w-full p-4 rounded-lg border text-left transition-colors',
                        selectedWarehouseId === warehouse.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Warehouse className="h-5 w-5" />
                          <div>
                            <div className="font-medium">{warehouse.name}</div>
                            <div className="text-sm text-muted-foreground">{warehouse.code}</div>
                          </div>
                        </div>
                        {selectedWarehouseId === warehouse.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

