import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, PackagePlus, FolderTree, Package, Image as ImageIcon } from 'lucide-react';
import { collectionsApi, Collection } from '@/api/collections';
import { productsService, Product, ProductVariant } from '@/api/products';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';

// Helper type to map products + variants for the table
interface CollectionItem {
  id: string;
  product: Product;
  variant: ProductVariant;
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedVariantsToAdd, setSelectedVariantsToAdd] = useState<string[]>([]);

  // Queries
  const { data: collection, isLoading: isLoadingCollection } = useQuery<Collection>({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.getByIdOrSlug(id!),
    enabled: !!id,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['collection-products', collection?.slug],
    queryFn: () => productsService.getAll({ collection_slug: collection?.slug }),
    enabled: !!collection?.slug,
  });

  // Flat list of variants currently in this collection
  const collectionItems = useMemo<CollectionItem[]>(() => {
    return products.flatMap(product => 
      (product.variants || []).map(variant => ({
        id: variant.id,
        product,
        variant
      }))
    );
  }, [products]);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: () => collectionsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection deleted successfully');
      navigate('/inventory/collections');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete collection');
    },
  });

  const assignVariantsMutation = useMutation({
    mutationFn: (variantIds: string[]) => {
      const assignments = variantIds.map((vId, idx) => ({ variant_id: vId, display_order: idx }));
      return collectionsApi.assignVariants(id!, { assignments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-products', collection?.slug] });
      setShowAddDialog(false);
      setSelectedVariantsToAdd([]);
      toast.success('Collection items updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update collection items');
    },
  });

  const handleAddItem = () => {
    if (selectedVariantsToAdd.length === 0) return;
    const currentVariantIds = collectionItems.map(item => item.variant.id);
    const newVariantIds = selectedVariantsToAdd.filter(id => !currentVariantIds.includes(id));
    if (newVariantIds.length === 0) {
      toast.error('All selected variants are already in the collection');
      return;
    }
    assignVariantsMutation.mutate([...currentVariantIds, ...newVariantIds]);
  };

  const handleRemoveItem = (variantIdToRemove: string) => {
    const newVariantIds = collectionItems
      .filter(item => item.variant.id !== variantIdToRemove)
      .map(item => item.variant.id);
    assignVariantsMutation.mutate(newVariantIds);
  };

  if (isLoadingCollection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Collection not found</p>
          <Button onClick={() => navigate('/inventory/collections')} className="mt-4">
            Back to Collections
          </Button>
        </div>
      </div>
    );
  }

  const columns: Column<CollectionItem>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 rounded border">
             <AvatarImage src={item.variant.image_url || undefined} alt={item.variant.name} />
             <AvatarFallback className="rounded"><Package className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{item.product.name}</div>
            <div className="text-xs text-muted-foreground">
              {item.product.product_code ? `#${item.product.product_code}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'variant',
      header: 'Variant',
      render: (item) => (
        <div>
          <div className="font-medium">{item.variant.name}</div>
          {item.variant.sku && <div className="text-xs text-muted-foreground font-mono">{item.variant.sku}</div>}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item) => {
        const salePrice = item.variant.price?.sale_price;
        return (
          <div className="font-medium">
            {salePrice !== undefined ? `$${salePrice.toFixed(2)}` : 'N/A'}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveItem(item.variant.id);
            }}
            disabled={assignVariantsMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const renderItemCard = (item: CollectionItem) => (
    <Card
      className="cursor-pointer hover:bg-accent"
      onClick={() => navigate(`/inventory/products/${item.product.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
             <Avatar className="h-12 w-12 rounded border">
                 <AvatarImage src={item.variant.image_url || undefined} alt={item.variant.name} />
                 <AvatarFallback className="rounded"><Package className="h-5 w-5" /></AvatarFallback>
             </Avatar>
             <div className="min-w-0">
               <h3 className="font-medium truncate">{item.product.name}</h3>
               <p className="text-sm text-muted-foreground truncate">{item.variant.name}</p>
               {item.variant.price?.sale_price !== undefined && (
                 <div className="mt-1 font-medium text-sm">
                   ${item.variant.price.sale_price.toFixed(2)}
                 </div>
               )}
             </div>
          </div>
          <Button 
             variant="ghost" 
             size="sm"
             className="text-destructive"
             onClick={(e) => {
               e.stopPropagation();
               handleRemoveItem(item.variant.id);
             }}
             disabled={assignVariantsMutation.isPending}
          >
             <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/inventory/collections')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded border bg-muted">
              <AvatarImage src={collection.image_url || ''} alt={collection.name} className="object-cover" />
              <AvatarFallback className="rounded">
                <FolderTree className="h-8 w-8 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              {collection.slug && (
                <p className="text-muted-foreground mt-1">Slug: {collection.slug}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/inventory/collections/${id}/edit`)}
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
            <CardTitle>Collection Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={collection.is_active ? 'default' : 'secondary'}>
                    {collection.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div>
                 <label className="text-sm font-medium text-muted-foreground">Display Order</label>
                 <div className="mt-1 text-sm">{collection.display_order}</div>
              </div>
            </div>
            {collection.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="mt-1 text-sm whitespace-pre-wrap">{collection.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items in Collection ({collectionItems.length})
            </CardTitle>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <PackagePlus className="h-4 w-4 mr-2" />
              Add Items
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingProducts ? (
              <div className="text-center py-8">Loading items...</div>
            ) : collectionItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <FolderTree className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No items found in this collection.</p>
                <Button variant="link" onClick={() => setShowAddDialog(true)}>Add items now</Button>
              </div>
            ) : (
              <ResponsiveTable
                columns={columns}
                data={collectionItems}
                renderCard={renderItemCard}
                emptyMessage="No items found"
                onRowClick={(item) => navigate(`/inventory/products/${item.product.id}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Collection Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{collection.name}"? This action cannot be undone.
              {collectionItems.length > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This collection contains {collectionItems.length} item{collectionItems.length !== 1 ? 's' : ''}.
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

      {/* Add Items Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
         setShowAddDialog(open);
         if (!open) setSelectedVariantsToAdd([]);
      }}>
         <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
               <DialogTitle>Add Item to Collection</DialogTitle>
               <DialogDescription>
                  Search and select products or variants to add to this collection.
               </DialogDescription>
            </DialogHeader>
            <div className="py-4">
               <ProductVariantCombobox
                  useListInModal={true}
                  multiple={true}
                  selectedVariantIds={selectedVariantsToAdd}
                  onSelect={(_, variantId) => {
                    setSelectedVariantsToAdd(prev => 
                      prev.includes(variantId) 
                        ? prev.filter(id => id !== variantId)
                        : [...prev, variantId]
                    );
                  }}
               />
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
               <Button 
                  onClick={handleAddItem} 
                  disabled={selectedVariantsToAdd.length === 0 || assignVariantsMutation.isPending}
               >
                  {assignVariantsMutation.isPending ? 'Adding...' : `Add Item${selectedVariantsToAdd.length > 1 ? 's' : ''}`}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
