import React, { useState } from 'react';
import { Check, ChevronsUpDown, Warehouse as WarehouseIcon } from 'lucide-react';
import { Warehouse } from '@/api/warehouses';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface WarehouseComboboxProps {
  warehouses: Warehouse[];
  selectedWarehouseId?: string | null;
  onSelect: (warehouseId: string) => void;
  className?: string;
  placeholder?: string;
}

export const WarehouseCombobox: React.FC<WarehouseComboboxProps> = ({
  warehouses,
  selectedWarehouseId,
  onSelect,
  className,
  placeholder = "Select warehouse...",
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-10', className)}
        >
          {selectedWarehouse ? (
            <div className="flex items-center gap-2 truncate">
              <WarehouseIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{selectedWarehouse.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-1 rounded uppercase">
                {selectedWarehouse.code}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search warehouse by name or code..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No warehouse found.</CommandEmpty>
            <CommandGroup>
              {filteredWarehouses.map((w) => (
                <CommandItem
                  key={w.id}
                  value={w.id}
                  onSelect={() => handleSelect(w.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedWarehouseId === w.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                       <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                       <span className="font-semibold text-gray-900">{w.name}</span>
                    </div>
                    {w.code && (
                      <span className="text-[10px] font-mono text-gray-400 mt-0.5">
                        Code: {w.code}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
