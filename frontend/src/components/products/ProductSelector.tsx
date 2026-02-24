import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Check } from 'lucide-react';
import { productsService, Product } from '@/api/products';
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

interface ProductSelectorProps {
  selectedProductId: string | null;
  onSelect: (productId: string | null) => void;
  filterActive?: boolean; // Only show active products
  className?: string;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  selectedProductId,
  onSelect,
  filterActive = true,
  className,
}) => {
  const isMobile = useIsMobile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', filterActive],
    queryFn: () => productsService.getAll(),
  });

  // Filter products by active status and search query
  const filteredProducts = products.filter(product => {
    const matchesActive = !filterActive || product.is_active;
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesActive && matchesSearch;
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Desktop: Use Select component
  if (!isMobile) {
    return (
      <Select
        value={selectedProductId || undefined}
        onValueChange={(value) => {
          if (value) {
            onSelect(value);
          } else {
            onSelect(null);
          }
        }}
      >
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder="Select product">
            {selectedProduct ? (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>{selectedProduct.name}</span>
                {selectedProduct.product_code && (
                  <span className="text-muted-foreground text-sm">({selectedProduct.product_code})</span>
                )}
              </div>
            ) : (
              'Select product'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <SelectItem value="loading" disabled>Loading...</SelectItem>
          ) : filteredProducts.length === 0 ? (
            <SelectItem value="no-products" disabled>No products found</SelectItem>
          ) : (
            filteredProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>{product.name}</span>
                  {product.product_code && (
                    <span className="text-muted-foreground text-sm">({product.product_code})</span>
                  )}
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
        {selectedProduct ? (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="flex-1 text-left">{selectedProduct.name}</span>
            {selectedProduct.product_code && (
              <span className="text-muted-foreground text-sm">({selectedProduct.product_code})</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Select product</span>
          </div>
        )}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-full h-full max-h-screen m-0 rounded-none sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No products found</div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        onSelect(product.id);
                        setIsModalOpen(false);
                      }}
                      className={cn(
                        'w-full p-4 rounded-lg border text-left transition-colors',
                        selectedProductId === product.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5" />
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.product_code && (
                              <div className="text-sm text-muted-foreground">{product.product_code}</div>
                            )}
                          </div>
                        </div>
                        {selectedProductId === product.id && (
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

