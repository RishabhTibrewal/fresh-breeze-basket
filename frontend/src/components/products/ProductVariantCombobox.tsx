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
  className?: string;
}

export const ProductVariantCombobox: React.FC<ProductVariantComboboxProps> = ({
  selectedProductId,
  selectedVariantId,
  onSelect,
  filterActive = true,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', filterActive],
    queryFn: () => productsService.getAll(),
  });

  // Build options from products and variants
  const options: ProductVariantOption[] = products
    .filter(p => !filterActive || p.is_active)
    .flatMap(product =>
      (product.variants || [])
        .filter(v => v.is_active)
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
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
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.product_id, option.variant_id);
                    setOpen(false);
                    setSearchQuery('');
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

