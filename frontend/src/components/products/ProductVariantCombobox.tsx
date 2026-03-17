import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { productsService, Product } from '@/api/products';
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

interface ProductVariantOption {
  product_id: string;
  variant_id: string;
  label: string;
  product_name: string;
  variant_name: string;
}

interface ProductVariantComboboxProps {
  selectedProductId?: string | null;
  selectedVariantId?: string | null;
  onSelect: (productId: string, variantId: string) => void;
  filterActive?: boolean;
  /** Use a simple list instead of Command/Popover when inside a Dialog to avoid focus-trap blocking selection */
  useListInModal?: boolean;
  className?: string;
}

export const ProductVariantCombobox: React.FC<ProductVariantComboboxProps> = ({
  selectedProductId,
  selectedVariantId,
  onSelect,
  filterActive = true,
  useListInModal = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', filterActive],
    queryFn: () => productsService.getAll(),
  });

  // Build options from products and variants (when filterActive is false, include all variants)
  const options: ProductVariantOption[] = products
    .filter(p => !filterActive || p.is_active)
    .flatMap(product =>
      (product.variants || [])
        .filter(v => !filterActive || v.is_active !== false)
        .map(variant => ({
          product_id: product.id,
          variant_id: variant.id,
          label: `${product.name} - ${variant.name}`,
          product_name: product.name,
          variant_name: variant.name,
        }))
    );

  // Filter options by search query
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.variant_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find(
    o => o.product_id === selectedProductId && o.variant_id === selectedVariantId
  );

  const handleSelectOption = (option: ProductVariantOption) => {
    onSelect(option.product_id, option.variant_id);
    setOpen(false);
    setSearchQuery('');
  };

  // Simple list mode: no Popover/Command, works reliably inside Radix Dialog (avoids focus trap)
  if (useListInModal) {
    const listOptions = filteredOptions;
    return (
      <div className={cn('space-y-1', className)}>
        <input
          type="text"
          placeholder="Search products/variants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="border rounded-md max-h-[200px] overflow-y-auto">
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : listOptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No product/variant found.</div>
          ) : (
            listOptions.map((option) => {
              const isSelected = selectedProductId === option.product_id && selectedVariantId === option.variant_id;
              return (
                <button
                  key={`${option.product_id}-${option.variant_id}`}
                  type="button"
                  onClick={() => onSelect(option.product_id, option.variant_id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-none border-b border-border last:border-b-0 hover:bg-accent',
                    isSelected && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 ml-auto text-primary" />}
                </button>
              );
            })
          )}
        </div>
        {selectedOption && (
          <p className="text-xs text-muted-foreground">Selected: {selectedOption.label}</p>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-9', className)}
        >
          {selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-muted-foreground">Select product/variant...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-[100]" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search products/variants..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Loading...' : 'No product/variant found.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={`${option.product_id}-${option.variant_id}`}
                  value={`${option.product_id}|${option.variant_id}`}
                  onSelect={() => handleSelectOption(option)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleSelectOption(option);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOption?.product_id === option.product_id &&
                      selectedOption?.variant_id === option.variant_id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{option.label}</span>
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

