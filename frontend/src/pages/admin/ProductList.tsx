import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, Package, Building2, Table } from 'lucide-react';
import { productsService, Product } from '@/api/products';
import { categoriesService } from '@/api/categories';
import { brandsService } from '@/api/brands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ordersService, type OrdersResponse } from '@/api/orders';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function ProductList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>('all');

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';

  const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.getAll,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsService.getAll,
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const handleDelete = async () => {
    if (!deleteProductId) return;

    try {
      await productsService.delete(deleteProductId);
      await refetchProducts();
      toast.success('Product deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    }
    setDeleteProductId(null);
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = brandFilter === 'all' || product.brand_id === brandFilter;
    return matchesSearch && matchesBrand;
  }) || [];

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (product) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {product.variants?.[0]?.image_url ? (
              <img
                src={product.variants[0].image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-medium">{product.name}</div>
            {product.description && (
              <div className="text-sm text-muted-foreground line-clamp-1">
                {product.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (product) => getCategoryName(product.category_id),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (product) => (
        product.brand ? (
          <div className="flex items-center gap-2">
            {product.brand.logo_url && (
              <Avatar className="h-6 w-6">
                <AvatarImage src={product.brand.logo_url} alt={product.brand.name} />
                <AvatarFallback>
                  <Building2 className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
            )}
            <span>{product.brand.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">No brand</span>
        )
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
    {
      key: 'actions',
      header: 'Actions',
      render: (product) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${basePath}/products/${product.id}/variants`);
            }}
          >
            <Package className="h-4 w-4 mr-1" />
            Variants
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${basePath}/products/edit/${product.id}`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteProductId(product.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (product: Product) => (
    <Card className="cursor-pointer hover:bg-accent">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {product.variants?.[0]?.image_url ? (
              <img
                src={product.variants[0].image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {product.description}
                  </p>
                )}
              </div>
              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                {product.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {getCategoryName(product.category_id)}
              </Badge>
              {product.brand && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  {product.brand.logo_url && (
                    <Avatar className="h-3 w-3">
                      <AvatarImage src={product.brand.logo_url} alt={product.brand.name} />
                      <AvatarFallback>
                        <Building2 className="h-2 w-2" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {product.brand.name}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {product.variants?.length || 0} variant{product.variants?.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${basePath}/products/${product.id}/variants`);
                }}
              >
                <Package className="h-4 w-4 mr-1" />
                Manage Variants
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${basePath}/products/edit/${product.id}`);
                }}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteProductId(product.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">Manage product catalog</p>
        </div>
        <Link to={`${basePath}/products/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoadingProducts ? (
        <div className="text-center py-8">Loading products...</div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredProducts}
          renderCard={renderCard}
          emptyMessage="No products found"
          onRowClick={(product) => navigate(`${basePath}/products/${product.id}/variants`)}
        />
      )}

      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AdminOrderList() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ordersResponse, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders'],
    queryFn: () => ordersService.getAll(),
  });

  const orders = ordersResponse?.data ?? [];

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Orders (Admin)</h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search by Order ID or Status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-[300px]"
          />
        </div>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Spinner className="h-6 w-6 mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.id.split('-')[0]}</TableCell>
                  <TableCell>{order.userId || order.user_id || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'cancelled' ? 'destructive' : 'default'}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₹ {order.total_amount?.toFixed(2) ?? '0.00'}</TableCell>
                  <TableCell>{order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy, HH:mm') : 'Unknown'}</TableCell>
                  <TableCell className="text-right">
                    <Link to={`/admin/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        View / Manage
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
