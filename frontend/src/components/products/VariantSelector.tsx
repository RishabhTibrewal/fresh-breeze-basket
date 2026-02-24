import React, { useState } from 'react';
import { Package, Check } from 'lucide-react';
import { ProductVariant } from '@/api/products';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { PriceDisplay } from './PriceDisplay';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
  showStock?: boolean;
  productId?: string;
  className?: string;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariantId,
  onSelect,
  showStock = false,
  productId,
  className,
}) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const activeVariants = variants.filter(v => v.is_active);

  if (variants.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No variants available
      </div>
    );
  }

  // Desktop: Use Select component
  if (!isMobile) {
    return (
      <Select
        value={selectedVariantId || ''}
        onValueChange={onSelect}
      >
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder="Select variant">
            {selectedVariant ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>{selectedVariant.name}</span>
                  {selectedVariant.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
                {selectedVariant.price && (
                  <PriceDisplay
                    mrpPrice={selectedVariant.price.mrp_price}
                    salePrice={selectedVariant.price.sale_price}
                    size="sm"
                  />
                )}
              </div>
            ) : (
              'Select variant'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {activeVariants.map((variant) => (
            <SelectItem key={variant.id} value={variant.id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>{variant.name}</span>
                  {variant.sku && (
                    <span className="text-muted-foreground text-xs">({variant.sku})</span>
                  )}
                  {variant.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
                {variant.price && (
                  <PriceDisplay
                    mrpPrice={variant.price.mrp_price}
                    salePrice={variant.price.sale_price}
                    size="sm"
                  />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile: Use bottom sheet
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn('w-full justify-start', className)}
        onClick={() => setIsSheetOpen(true)}
      >
        {selectedVariant ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>{selectedVariant.name}</span>
              {selectedVariant.is_default && (
                <Badge variant="secondary" className="text-xs">Default</Badge>
              )}
            </div>
            {selectedVariant.price && (
              <PriceDisplay
                mrpPrice={selectedVariant.price.mrp_price}
                salePrice={selectedVariant.price.sale_price}
                size="sm"
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Select variant</span>
          </div>
        )}
      </Button>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Select Variant</SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 space-y-2 overflow-y-auto">
            {activeVariants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => {
                  onSelect(variant.id);
                  setIsSheetOpen(false);
                }}
                className={cn(
                  'w-full p-4 rounded-lg border text-left transition-colors',
                  selectedVariantId === variant.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4" />
                      <span className="font-medium">{variant.name}</span>
                      {variant.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    {variant.sku && (
                      <div className="text-sm text-muted-foreground mb-2">SKU: {variant.sku}</div>
                    )}
                    {variant.price && (
                      <PriceDisplay
                        mrpPrice={variant.price.mrp_price}
                        salePrice={variant.price.sale_price}
                        size="sm"
                      />
                    )}
                    {showStock && productId && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Stock: Check availability
                      </div>
                    )}
                  </div>
                  {selectedVariantId === variant.id && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

