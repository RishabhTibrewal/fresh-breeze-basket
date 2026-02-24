import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, Building2, Package } from 'lucide-react';
import { brandsService, Brand } from '@/api/brands';
import { productsService, Product } from '@/api/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Skeleton } from '@/components/ui/skeleton';

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const { data: brand, isLoading: isLoadingBrand } = useQuery<Brand>({
    queryKey: ['brand', id],
    queryFn: () => brandsService.getById(id!),
    enabled: !!id,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['brand-products', id],
    queryFn: () => brandsService.getProducts(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => brandsService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand deleted successfully');
      navigate('/admin/brands');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete brand');
    },
  });

  if (isLoadingBrand) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Brand not found</p>
          <Button onClick={() => navigate('/admin/brands')} className="mt-4">
            Back to Brands
          </Button>
        </div>
      </div>
    );
  }

  const productColumns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      render: (product) => (
        <div>
          <div className="font-medium">{product.name}</div>
          {product.description && (
            <div className="text-sm text-muted-foreground truncate max-w-md">
              {product.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (product) => (
        <Badge variant="outline">
          {product.variants?.length || 0} variant{product.variants?.length !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (product) => (
        <Badge variant={product.is_active ? 'default' : 'secondary'}>
          {product.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const renderProductCard = (product: Product) => (
    <Card
      className="cursor-pointer hover:bg-accent"
      onClick={() => navigate(`/admin/products/${product.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {product.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                {product.variants?.length || 0} variant{product.variants?.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                {product.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/brands')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Brands
        </Button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={brand.logo_url || ''} alt={brand.name} />
              <AvatarFallback>
                <Building2 className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{brand.name}</h1>
              {brand.legal_name && (
                <p className="text-muted-foreground mt-1">{brand.legal_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/brands/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                    {brand.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              {brand.slug && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Slug</label>
                  <div className="mt-1 text-sm">{brand.slug}</div>
                </div>
              )}
            </div>
            {brand.legal_name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Legal Name</label>
                <div className="mt-1 text-sm">{brand.legal_name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products ({products.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProducts ? (
              <div className="text-center py-8">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products found for this brand
              </div>
            ) : (
              <ResponsiveTable
                columns={productColumns}
                data={products}
                renderCard={renderProductCard}
                emptyMessage="No products found"
                onRowClick={(product) => navigate(`/admin/products/${product.id}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{brand.name}"? This action cannot be undone.
              {products.length > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This brand is associated with {products.length} product{products.length !== 1 ? 's' : ''}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
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

