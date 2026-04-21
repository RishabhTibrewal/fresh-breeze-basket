import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { productsService, Product } from '@/api/products';
import { Button } from '@/components/ui/button';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  Popover,
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
  product_code?: string | null;
  sku?: string | null;
  brand_name?: string | null;
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
        .map(variant => {
          const brandName = variant.brand?.name || product.brand?.name;
          const label = [
            brandName ? `[${brandName}]` : '',
            product.name,
            variant.name,
            variant.sku ? `(${variant.sku})` : (product.product_code ? `(#${product.product_code})` : '')
          ].filter(Boolean).join(' ');

          return {
            product_id: product.id,
            variant_id: variant.id,
            label,
            product_name: product.name,
            variant_name: variant.name,
            product_code: product.product_code,
            sku: variant.sku,
            brand_name: brandName,
          };
        })
    );

  // Filter options by search query (used by useListInModal)
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
                    'w-full flex items-start gap-2 px-3 py-2 text-left text-sm rounded-none border-b border-border last:border-b-0 hover:bg-accent group',
                    isSelected && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <Package className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {option.brand_name && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {option.brand_name}
                        </span>
                      )}
                      <span className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                        {option.product_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 font-medium">{option.variant_name}</span>
                      {(option.sku || option.product_code) && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 rounded">
                          {option.sku || `#${option.product_code}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 ml-auto text-primary self-center" />}
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-10', className)}
        >
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-1.5 truncate">
                {selectedOption.brand_name && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1 rounded leading-none shrink-0">
                    {selectedOption.brand_name}
                  </span>
                )}
                <span className="font-semibold text-gray-900 truncate">
                  {selectedOption.product_name}
                </span>
                <span className="text-gray-500 truncate text-xs">
                  - {selectedOption.variant_name}
                </span>
                {(selectedOption.sku || selectedOption.product_code) && (
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 rounded leading-none shrink-0">
                    {selectedOption.sku || `#${selectedOption.product_code}`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Select product/variant...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverPrimitive.Content 
        className={cn(
          "z-[100] w-[400px] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-hidden"
        )}
        align="start" 
        sideOffset={4}
        collisionPadding={8}
        onOpenAutoFocus={(e) => {
          // Allow opening the popover without focus fighting the dialog
          e.preventDefault();
        }}
      >
        <div className="flex flex-col">
          <Command shouldFilter={true} className="flex-1">
            <CommandInput 
              placeholder="Search products/variants..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                {isLoading ? 'Loading...' : 'No product/variant found.'}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={`${option.product_id}-${option.variant_id}`}
                    value={`${option.brand_name || ''} ${option.product_name} ${option.variant_name} ${option.sku || ''} ${option.product_code || ''}`}
                    onSelect={() => handleSelectOption(option)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedOption?.product_id === option.product_id &&
                        selectedOption?.variant_id === option.variant_id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {option.brand_name && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                            {option.brand_name}
                          </span>
                        )}
                        <span className="font-semibold text-gray-900">{option.product_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-gray-500 font-medium text-xs">{option.variant_name}</span>
                        {(option.sku || option.product_code) && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 rounded leading-none">
                            {option.sku || `#${option.product_code}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </PopoverPrimitive.Content>
    </Popover>
  );
};

