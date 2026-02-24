import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { pricesService, ProductPrice } from '@/api/prices';
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
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { format } from 'date-fns';

export default function PriceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVariantId, setFilterVariantId] = useState<string>(searchParams.get('variant_id') || '');
  const [filterProductId, setFilterProductId] = useState<string>(searchParams.get('product_id') || '');

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  const { data: variants = [] } = useQuery<ProductVariant[]>({
    queryKey: ['all-variants'],
    queryFn: async () => {
      // Fetch variants for all products
      const allVariants: ProductVariant[] = [];
      for (const product of products) {
        try {
          const productVariants = await variantsService.getByProduct(product.id);
          allVariants.push(...productVariants);
        } catch (error) {
          console.error(`Failed to fetch variants for product ${product.id}:`, error);
        }
      }
      return allVariants;
    },
    enabled: products.length > 0,
  });

  // Fetch prices - this would need a backend endpoint to get all prices
  // For now, we'll fetch prices for filtered variant/product
  const { data: prices = [], isLoading } = useQuery<ProductPrice[]>({
    queryKey: ['prices', filterVariantId, filterProductId],
    queryFn: async () => {
      if (filterVariantId) {
        return pricesService.getVariantPrices(filterVariantId);
      }
      // If filtering by product, get prices for all variants of that product
      if (filterProductId) {
        const productVariants = await variantsService.getByProduct(filterProductId);
        const allPrices: ProductPrice[] = [];
        for (const variant of productVariants) {
          try {
            const variantPrices = await pricesService.getVariantPrices(variant.id);
            allPrices.push(...variantPrices);
          } catch (error) {
            console.error(`Failed to fetch prices for variant ${variant.id}:`, error);
          }
        }
        return allPrices;
      }
      return [];
    },
    enabled: !!filterVariantId || !!filterProductId,
  });

  const filteredPrices = prices.filter(price => {
    const variant = variants.find(v => v.id === price.variant_id);
    const product = products.find(p => p.id === price.product_id);
    const searchLower = searchTerm.toLowerCase();
    return (
      variant?.name.toLowerCase().includes(searchLower) ||
      product?.name.toLowerCase().includes(searchLower) ||
      price.price_type.toLowerCase().includes(searchLower)
    );
  });

  const columns: Column<ProductPrice>[] = [
    {
      key: 'variant',
      header: 'Variant',
      render: (price) => {
        const variant = variants.find(v => v.id === price.variant_id);
        const product = products.find(p => p.id === price.product_id);
        return (
          <div>
            <div className="font-medium">{variant?.name || 'N/A'}</div>
            {product && (
              <div className="text-sm text-muted-foreground">{product.name}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'price_type',
      header: 'Type',
      render: (price) => <Badge variant="outline">{price.price_type}</Badge>,
    },
    {
      key: 'prices',
      header: 'Prices',
      render: (price) => (
        <PriceDisplay
          mrpPrice={price.mrp_price}
          salePrice={price.sale_price}
          size="sm"
        />
      ),
    },
    {
      key: 'validity',
      header: 'Validity',
      render: (price) => (
        <div className="text-sm">
          <div>From: {format(new Date(price.valid_from), 'MMM dd, yyyy')}</div>
          {price.valid_until && (
            <div className="text-muted-foreground">
              Until: {format(new Date(price.valid_until), 'MMM dd, yyyy')}
            </div>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (price: ProductPrice) => {
    const variant = variants.find(v => v.id === price.variant_id);
    const product = products.find(p => p.id === price.product_id);
    
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{variant?.name || 'N/A'}</h3>
                {product && (
                  <p className="text-sm text-muted-foreground">{product.name}</p>
                )}
              </div>
              <Badge variant="outline">{price.price_type}</Badge>
            </div>
            <PriceDisplay
              mrpPrice={price.mrp_price}
              salePrice={price.sale_price}
              size="sm"
            />
            <div className="text-sm text-muted-foreground">
              Valid from: {format(new Date(price.valid_from), 'PPP')}
              {price.valid_until && ` until ${format(new Date(price.valid_until), 'PPP')}`}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Prices</h1>
          <p className="text-muted-foreground mt-1">Manage product variant prices</p>
        </div>
        <Button onClick={() => window.location.href = '/admin/prices/new'}>
          <Plus className="h-4 w-4 mr-2" />
          Add Price
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterProductId} onValueChange={setFilterProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by product" />
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
        <Select value={filterVariantId} onValueChange={setFilterVariantId}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by variant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Variants</SelectItem>
            {variants
              .filter(v => !filterProductId || v.product_id === filterProductId)
              .map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading prices...</div>
      ) : filteredPrices.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {filterVariantId || filterProductId
            ? 'No prices found for selected filters'
            : 'Select a product or variant to view prices'}
        </div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredPrices}
          renderCard={renderCard}
          emptyMessage="No prices found"
        />
      )}
    </div>
  );
}

