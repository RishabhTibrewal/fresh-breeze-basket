import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Package, DollarSign } from 'lucide-react';
import { variantsService } from '@/api/variants';
import { productsService, ProductVariant } from '@/api/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { StockDisplay } from '@/components/inventory/StockDisplay';

export default function VariantList() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsService.getById(productId!),
    enabled: !!productId,
  });

  const { data: variants = [], isLoading } = useQuery<ProductVariant[]>({
    queryKey: ['variants', productId],
    queryFn: () => variantsService.getByProduct(productId!),
    enabled: !!productId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => variantsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Variant deleted successfully');
      setDeleteVariantId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete variant');
    },
  });

  const filteredVariants = variants.filter(variant =>
    variant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variant.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<ProductVariant>[] = [
    {
      key: 'name',
      header: 'Variant Name',
      render: (variant) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            {variant.name}
            {variant.is_default && (
              <Badge variant="secondary" className="text-xs">Default</Badge>
            )}
          </div>
          {variant.sku && (
            <div className="text-sm text-muted-foreground">SKU: {variant.sku}</div>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (variant) => variant.price ? (
        <PriceDisplay
          mrpPrice={variant.price.mrp_price}
          salePrice={variant.price.sale_price}
          size="sm"
        />
      ) : (
        <span className="text-muted-foreground text-sm">No price</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (variant) => productId ? (
        <StockDisplay
          productId={productId}
          variantId={variant.id}
          format="compact"
        />
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (variant) => (
        <div className="flex flex-col gap-1">
          <Badge variant={variant.is_active ? 'default' : 'secondary'}>
            {variant.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {variant.is_featured && (
            <Badge variant="outline" className="text-xs">Featured</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (variant) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${basePath}/variants/${variant.id}`);
            }}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${basePath}/variants/${variant.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteVariantId(variant.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (variant: ProductVariant) => (
    <Card className="cursor-pointer hover:bg-accent">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium truncate">{variant.name}</h3>
              {variant.is_default && (
                <Badge variant="secondary" className="text-xs">Default</Badge>
              )}
            </div>
            {variant.sku && (
              <p className="text-sm text-muted-foreground mb-2">SKU: {variant.sku}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {variant.price && (
                <PriceDisplay
                  mrpPrice={variant.price.mrp_price}
                  salePrice={variant.price.sale_price}
                  size="sm"
                />
              )}
              {productId && (
                <StockDisplay
                  productId={productId}
                  variantId={variant.id}
                  format="compact"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                {variant.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {variant.is_featured && (
                <Badge variant="outline">Featured</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${basePath}/variants/${variant.id}`);
                }}
              >
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${basePath}/variants/${variant.id}/edit`);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteVariantId(variant.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Variants {product && `- ${product.name}`}
          </h1>
          <p className="text-muted-foreground mt-1">Manage product variants</p>
        </div>
        {productId && (
          <Button onClick={() => navigate(`${basePath}/products/${productId}/variants/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Variant
          </Button>
        )}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading variants...</div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredVariants}
          renderCard={renderCard}
          emptyMessage="No variants found"
          onRowClick={(variant) => navigate(`${basePath}/variants/${variant.id}`)}
        />
      )}

      <AlertDialog open={!!deleteVariantId} onOpenChange={() => setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this variant? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVariantId && deleteMutation.mutate(deleteVariantId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

