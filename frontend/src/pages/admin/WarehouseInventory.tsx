import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Package,
  Search,
  Plus,
} from "lucide-react";
import { toast } from 'sonner';
import { warehousesService, WarehouseInventory as WarehouseInventoryType } from '@/api/warehouses';
import { productsService } from '@/api/products';
import apiClient from '@/lib/apiClient';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const inventorySchema = z.object({
  product_id: z.string().min(1, 'Product is required').optional().or(z.literal('')),
  stock_count: z.number(), // Allow negative for subtracting stock when updating
  location: z.string().optional(),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

export default function WarehouseInventory() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WarehouseInventoryType | null>(null);

  // Fetch warehouse details
  const { data: warehouse } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: () => warehousesService.getById(warehouseId!),
    enabled: !!warehouseId,
  });

  // Fetch warehouse inventory
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['warehouse-inventory', warehouseId],
    queryFn: () => warehousesService.getWarehouseInventory(warehouseId!),
    enabled: !!warehouseId,
  });

  // Fetch all products for adding new inventory
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      product_id: undefined,
      stock_count: 0,
      location: '',
    },
  });

  // Handle add new product
  const handleAdd = () => {
    setSelectedProduct(null);
    form.reset({
      product_id: undefined,
      stock_count: 0,
      location: '',
    });
    setIsEditDialogOpen(true);
  };

  // Update form when editing
  const handleEdit = (item: WarehouseInventoryType) => {
    setSelectedProduct(item);
    form.reset({
      stock_count: 0, // Reset to 0 for adding stock, not replacing
      location: item.location || '',
    });
    setIsEditDialogOpen(true);
  };

  // Update inventory mutation
  const updateMutation = useMutation({
    mutationFn: async (values: InventoryFormValues) => {
      if (!warehouseId || !selectedProduct) return;
      
      const { data } = await apiClient.put(
        `/inventory/${selectedProduct.product_id}`,
        {
          warehouse_id: warehouseId,
          stock_count: values.stock_count,
          location: values.location,
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', warehouseId] });
      queryClient.invalidateQueries({ queryKey: ['product-warehouse-stock'] });
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      toast.success('Inventory updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update inventory');
    },
  });

  // Add new inventory mutation
  const addMutation = useMutation({
    mutationFn: async ({ productId, values }: { productId: string; values: InventoryFormValues }) => {
      if (!warehouseId) return;
      
      const { data } = await apiClient.put(
        `/inventory/${productId}`,
        {
          warehouse_id: warehouseId,
          stock_count: values.stock_count,
          location: values.location,
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', warehouseId] });
      queryClient.invalidateQueries({ queryKey: ['product-warehouse-stock'] });
      setIsEditDialogOpen(false);
      form.reset();
      toast.success('Inventory added successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add inventory');
    },
  });

  const onSubmit = (values: InventoryFormValues) => {
    if (selectedProduct) {
      // Update existing inventory
      updateMutation.mutate(values);
    } else {
      // Add new inventory
      if (!values.product_id || values.product_id === '') {
        form.setError('product_id', { message: 'Please select a product' });
        return;
      }
      addMutation.mutate({ productId: values.product_id, values });
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.products?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get products not yet in inventory
  const productsNotInInventory = products.filter(
    product => !inventory.some(item => item.product_id === product.id)
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/warehouses')}
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">
            Warehouse Inventory
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {warehouse ? `${warehouse.code} - ${warehouse.name}` : 'Loading...'}
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 sm:pl-8 h-9 sm:h-10 text-sm sm:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">
                Inventory ({filteredInventory.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Manage stock levels for products in this warehouse
              </CardDescription>
            </div>
            <Button onClick={handleAdd} className="w-full sm:w-auto text-sm sm:text-base">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {isLoading ? (
            <div className="text-center py-8 text-sm">Loading inventory...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <Package className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">No inventory found</p>
                <p>Add products to this warehouse to get started.</p>
              </div>
              <Button onClick={handleAdd} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="min-w-[100px]">Available</TableHead>
                    <TableHead className="min-w-[100px]">Reserved</TableHead>
                    <TableHead className="min-w-[150px]">Location</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {item.products?.image_url && (
                            <img
                              src={item.products.image_url}
                              alt={item.products.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <div>{item.products?.name || `Product ${item.product_id}`}</div>
                            {item.products?.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {item.products.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {item.stock_count}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.reserved_stock || 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.location || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.stock_count > 10
                              ? 'default'
                              : item.stock_count > 0
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {item.stock_count > 10
                            ? 'In Stock'
                            : item.stock_count > 0
                            ? 'Low Stock'
                            : 'Out of Stock'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          className="h-8 w-8"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Inventory Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? 'Update Inventory' : 'Add Inventory'}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? `Update stock for ${selectedProduct.products?.name || 'product'}`
                : 'Add inventory for a product in this warehouse'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!selectedProduct && (
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoadingProducts}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingProducts ? "Loading products..." : "Select a product"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {products.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No products available
                            </div>
                          ) : (
                            products.map((product) => {
                              const isInInventory = inventory.some(item => item.product_id === product.id);
                              return (
                                <SelectItem key={product.id} value={product.id}>
                                  <div className="flex items-center gap-2">
                                    {product.image_url && (
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-6 h-6 rounded object-cover"
                                      />
                                    )}
                                    <span className="flex-1">{product.name}</span>
                                    {isInInventory && (
                                      <Badge variant="secondary" className="text-xs">
                                        In Stock
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select a product to add to this warehouse
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {selectedProduct && (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  <div className="font-medium mb-1">Current Stock: {selectedProduct.stock_count}</div>
                  <div className="text-xs">Enter the amount to add to current stock</div>
                </div>
              )}
              <FormField
                control={form.control}
                name="stock_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedProduct ? 'Add Stock *' : 'Stock Count *'}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value}
                        placeholder={selectedProduct ? "Enter quantity to add (can be negative to subtract)" : "Enter stock quantity"}
                      />
                    </FormControl>
                    <FormDescription>
                      {selectedProduct 
                        ? `Enter the quantity to add to current stock (${selectedProduct.stock_count})`
                        : 'Initial stock quantity for this product'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Aisle 3, Shelf B" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional location within the warehouse
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedProduct(null);
                    form.reset();
                  }}
                  disabled={updateMutation.isPending || addMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || addMutation.isPending}
                >
                  {updateMutation.isPending || addMutation.isPending
                    ? 'Saving...'
                    : selectedProduct
                    ? 'Update'
                    : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
