import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, X, Plus, Image as ImageIcon } from 'lucide-react';
import { variantsService, CreateVariantInput } from '@/api/variants';
import { productsService, ProductVariant, Tax, ProductImage, ProductPrice } from '@/api/products';
import { brandsService } from '@/api/brands';
import { taxesService } from '@/api/taxes';
import { uploadsService, ProductImageUploadResponse } from '@/api/uploads';
import { warehousesService, Warehouse } from '@/api/warehouses';
import { pricesService } from '@/api/prices';
import apiClient from '@/lib/apiClient';
import { inventoryService, ProductWarehouseStock } from '@/api/inventory';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { BrandSelector } from '@/components/brands/BrandSelector';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

const UNIT_TYPES = ['kg', 'g', 'lb', 'oz', 'piece', 'bunch', 'pack', 'bag'];
const BADGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'sale', label: 'Sale' },
  { value: 'best-seller', label: 'Best Seller' },
  { value: 'organic', label: 'Organic' },
];

const PRICE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'sale', label: 'Sale' },
  { value: 'bulk', label: 'Bulk' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'promotional', label: 'Promotional' },
];

const priceEntrySchema = z.object({
  id: z.string().optional(), // For existing prices
  price_type: z.string().min(1, 'Price type is required'),
  sale_price: z.number().min(0, 'Sale price must be >= 0'),
  mrp_price: z.number().min(0, 'MRP must be >= 0'),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
}).refine((data) => data.sale_price <= data.mrp_price, {
  message: 'Sale price must be less than or equal to MRP',
  path: ['sale_price'],
});

const variantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sku: z.string().optional().nullable(),
  prices: z.array(priceEntrySchema).min(1, 'At least one price (standard) is required'),
  image_url: z.string().optional().nullable(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  unit: z.number().min(0).optional().nullable(),
  unit_type: z.string().default('piece'),
  best_before: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  hsn: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  brand_id: z.string().optional().nullable(),
  warehouse_id: z.string().optional().nullable(),
  initial_stock: z.number().min(0, 'Stock must be >= 0').optional().nullable(),
}).refine((data) => {
  // Ensure at least one standard price exists
  const hasStandardPrice = data.prices.some(p => p.price_type === 'standard');
  return hasStandardPrice;
}, {
  message: 'At least one standard price is required',
  path: ['prices'],
});

type VariantFormValues = z.infer<typeof variantSchema>;

export default function VariantForm() {
  const { productId, variantId } = useParams<{ productId: string; variantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditMode = Boolean(variantId);

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Multiple warehouse stock adjustments
  interface WarehouseStockAdjustment {
    id: string;
    warehouse_id: string | null;
    stock: number | null;
  }
  const [warehouseStockAdjustments, setWarehouseStockAdjustments] = useState<WarehouseStockAdjustment[]>([
    { id: '1', warehouse_id: null, stock: null }
  ]);

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: '',
      sku: '',
      prices: [{
        price_type: 'standard',
        sale_price: 0,
        mrp_price: 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: null,
      }],
      image_url: '',
      is_featured: false,
      is_active: true,
      unit: null,
      unit_type: 'piece',
      best_before: null,
      tax_id: '',
      hsn: '',
      badge: '',
      brand_id: '',
      warehouse_id: '',
      initial_stock: null,
    },
  });

  const { data: variant, isLoading: isLoadingVariant } = useQuery<ProductVariant>({
    queryKey: ['variant', variantId],
    queryFn: () => variantsService.getById(variantId!),
    enabled: isEditMode,
  });

  // Get productId from params or from variant data
  const actualProductId = productId || variant?.product_id;

  const { data: product } = useQuery({
    queryKey: ['product', actualProductId],
    queryFn: () => productsService.getById(actualProductId!),
    enabled: !!actualProductId,
  });

  const { data: taxes = [] } = useQuery<Tax[]>({
    queryKey: ['taxes'],
    queryFn: taxesService.getAll,
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true), // Only active warehouses
  });

  // Load existing stock for this product+variant across warehouses
  const { data: productInventory } = useQuery<{
    warehouses: ProductWarehouseStock[];
    total_stock: number;
  }>({
    queryKey: ['product-inventory', actualProductId],
    queryFn: () => inventoryService.getInventoryByProductId(actualProductId!),
    enabled: !!actualProductId,
  });

  // Filter inventory to show only current variant's stock
  const variantInventory = useMemo(() => {
    if (!productInventory || !variantId) return null;
    const filtered = productInventory.warehouses.filter(
      (item) => item.variant_id === variantId
    );
    return {
      warehouses: filtered,
      total_stock: filtered.reduce((sum, item) => sum + (item.stock_count || 0), 0)
    };
  }, [productInventory, variantId]);

  // Fetch existing variant images in edit mode
  const { data: variantImages = [] } = useQuery<ProductImage[]>({
    queryKey: ['variant-images', variantId],
    queryFn: async () => {
      if (!variantId || !actualProductId) return [];
      const { data: response } = await apiClient.get<ApiResponse<ProductImage[]>>(
        `/product-images/${actualProductId}?variant_id=${variantId}`
      );
      return response.data.filter(img => img.variant_id === variantId);
    },
    enabled: isEditMode && !!variantId && !!actualProductId,
  });

  // Fetch existing prices for variant in edit mode
  const { data: existingPrices = [] } = useQuery<ProductPrice[]>({
    queryKey: ['variant-prices', variantId],
    queryFn: () => pricesService.getVariantPrices(variantId!),
    enabled: isEditMode && !!variantId,
  });

  useEffect(() => {
    if (variant && existingPrices.length > 0) {
      const prices = existingPrices.map(price => ({
        id: price.id,
        price_type: price.price_type,
        sale_price: price.sale_price,
        mrp_price: price.mrp_price,
        valid_from: price.valid_from ? new Date(price.valid_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        valid_until: price.valid_until ? new Date(price.valid_until).toISOString().split('T')[0] : null,
      }));


      form.reset({
        name: variant.name,
        sku: variant.sku || '',
        prices: prices.length > 0 ? prices : [{
          price_type: 'standard',
          sale_price: variant.price?.sale_price || 0,
          mrp_price: variant.price?.mrp_price || 0,
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: null,
        }],
        image_url: variant.image_url || '',
        is_featured: variant.is_featured,
        is_active: variant.is_active,
        unit: variant.unit || null,
        unit_type: variant.unit_type,
        best_before: variant.best_before || null,
        tax_id: variant.tax_id || '',
        hsn: variant.hsn || '',
        badge: variant.badge || '',
        brand_id: variant.brand_id || '',
      });
    } else if (variant && existingPrices.length === 0) {
      // Variant exists but no prices yet - use variant.price if available
      form.reset({
        name: variant.name,
        sku: variant.sku || '',
        prices: [{
          price_type: 'standard',
          sale_price: variant.price?.sale_price || 0,
          mrp_price: variant.price?.mrp_price || 0,
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: null,
        }],
        image_url: variant.image_url || '',
        is_featured: variant.is_featured,
        is_active: variant.is_active,
        unit: variant.unit || null,
        unit_type: variant.unit_type,
        best_before: variant.best_before || null,
        tax_id: variant.tax_id || '',
        hsn: variant.hsn || '',
        badge: variant.badge || '',
        brand_id: variant.brand_id || '',
      });
    }
  }, [variant, existingPrices, form]);

  // Update existing images when variantImages changes
  useEffect(() => {
    if (variantImages.length > 0) {
      setExistingImages(variantImages);
    } else {
      setExistingImages([]);
    }
  }, [variantImages]);

  const createMutation = useMutation({
    mutationFn: async (data: VariantFormValues) => {
      // Ensure all required fields are present and properly typed
      const createData: CreateVariantInput = {
        name: data.name,
        sku: data.sku || null,
        mrp_price: null, // Prices will be handled separately
        sale_price: null, // Prices will be handled separately
        image_url: data.image_url || null,
        is_featured: data.is_featured ?? false,
        is_active: data.is_active ?? true,
        unit: data.unit || null,
        unit_type: data.unit_type || 'piece',
        best_before: data.best_before && data.best_before.trim() !== '' ? data.best_before : null,
        tax_id: data.tax_id || null,
        hsn: data.hsn || null,
        badge: data.badge || null,
        brand_id: data.brand_id || null,
      };
      const variant = await variantsService.create(productId!, createData);
      
      // Create prices for the variant
      if (data.prices && data.prices.length > 0) {
        try {
          for (const priceEntry of data.prices) {
            await pricesService.create(variant.id, {
              variant_id: variant.id,
              product_id: productId!,
              price_type: priceEntry.price_type,
              sale_price: priceEntry.sale_price,
              mrp_price: priceEntry.mrp_price,
              valid_from: priceEntry.valid_from || new Date().toISOString(),
              valid_until: priceEntry.valid_until || null,
            });
          }
        } catch (priceError: any) {
          console.error('Error creating prices:', priceError);
          const errorMessage = priceError.response?.data?.error?.message || priceError.message || 'Unknown error';
          toast.warning('Variant created but failed to create some prices: ' + errorMessage);
        }
      }
      
      // Set initial stock for multiple warehouses if provided
      const validStockAdjustments = warehouseStockAdjustments.filter(
        adj => adj.warehouse_id && adj.stock !== null && adj.stock !== undefined && adj.stock >= 0
      );
      
      if (validStockAdjustments.length > 0) {
        try {
          // Small delay to ensure variant is fully committed to database
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Process all warehouse stock adjustments
          for (const adjustment of validStockAdjustments) {
            const stockQuantity = Math.floor(adjustment.stock!);
            await inventoryService.adjustStock({
              warehouse_id: adjustment.warehouse_id!,
              product_id: productId!,
              variant_id: variant.id,
              physical_quantity: stockQuantity,
              reason: 'Initial Stock Setup',
            });
          }
          
          if (validStockAdjustments.length > 0) {
            toast.success(`Initial stock set for ${validStockAdjustments.length} warehouse(s)`);
          }
        } catch (stockError: any) {
          console.error('Error setting initial stock:', stockError);
          // Don't fail the variant creation if stock setup fails
          const errorMessage = stockError.response?.data?.error || stockError.message || 'Unknown error';
          toast.warning('Variant created but failed to set initial stock: ' + errorMessage);
        }
      }
      
      return variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', productId] });
      queryClient.invalidateQueries({ queryKey: ['variant-prices'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory', productId] });
      toast.success('Variant created successfully');
      if (productId) {
        navigate(`${basePath}/products/${productId}/variants`);
      } else {
        navigate(`${basePath}/products`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create variant');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: VariantFormValues) => {
      // Ensure best_before is null instead of empty string
      const updateData = {
        ...data,
        best_before: data.best_before && data.best_before.trim() !== '' ? data.best_before : null,
        // Remove prices from variant update - they're handled separately
        prices: undefined,
      };
      const updatedVariant = await variantsService.update(variantId!, updateData);
      
      // Update prices
      if (data.prices && data.prices.length > 0) {
        try {
          const targetProductId = productId || variant?.product_id;
          if (!targetProductId) {
            throw new Error('Product ID is required to update prices');
          }

          // Get existing prices to compare
          const existingPriceIds = existingPrices.map(p => p.id);
          const formPriceIds = data.prices.filter(p => p.id).map(p => p.id!);

          // Delete prices that were removed
          const pricesToDelete = existingPriceIds.filter(id => !formPriceIds.includes(id));
          for (const priceId of pricesToDelete) {
            try {
              await pricesService.delete(priceId);
            } catch (deleteError: any) {
              console.error('Error deleting price:', deleteError);
              // Don't fail if deletion fails (might be standard price)
            }
          }

          // Create or update prices
          for (const priceEntry of data.prices) {
            if (priceEntry.id) {
              // Update existing price
              await pricesService.update(priceEntry.id, {
                price_type: priceEntry.price_type,
                sale_price: priceEntry.sale_price,
                mrp_price: priceEntry.mrp_price,
                valid_from: priceEntry.valid_from || new Date().toISOString(),
                valid_until: priceEntry.valid_until || null,
              });
            } else {
              // Create new price
              await pricesService.create(variantId!, {
                variant_id: variantId!,
                product_id: targetProductId,
                price_type: priceEntry.price_type,
                sale_price: priceEntry.sale_price,
                mrp_price: priceEntry.mrp_price,
                valid_from: priceEntry.valid_from || new Date().toISOString(),
                valid_until: priceEntry.valid_until || null,
              });
            }
          }
        } catch (priceError: any) {
          console.error('Error updating prices:', priceError);
          const errorMessage = priceError.response?.data?.error?.message || priceError.message || 'Unknown error';
          toast.warning('Variant updated but failed to update some prices: ' + errorMessage);
        }
      }
      
      // Update stock for multiple warehouses if provided
      const validStockAdjustments = warehouseStockAdjustments.filter(
        adj => adj.warehouse_id && adj.stock !== null && adj.stock !== undefined && adj.stock >= 0
      );
      
      if (validStockAdjustments.length > 0) {
        try {
          const targetProductId = productId || variant?.product_id;
          
          if (!targetProductId) {
            throw new Error('Product ID is required to update stock');
          }
          
          // Process all warehouse stock adjustments
          for (const adjustment of validStockAdjustments) {
            const stockQuantity = Math.floor(adjustment.stock!);
            await inventoryService.adjustStock({
              warehouse_id: adjustment.warehouse_id!,
              product_id: targetProductId,
              variant_id: variantId!,
              physical_quantity: stockQuantity,
              reason: 'Stock Update',
            });
          }
          
          if (validStockAdjustments.length > 0) {
            toast.success(`Stock updated for ${validStockAdjustments.length} warehouse(s)`);
          }
        } catch (stockError: any) {
          console.error('Error updating stock:', stockError);
          // Don't fail the variant update if stock update fails
          const errorMessage = stockError.response?.data?.error || stockError.message || 'Unknown error';
          toast.warning('Variant updated but failed to update stock: ' + errorMessage);
        }
      }
      
      return updatedVariant;
    },
    onSuccess: () => {
      const targetProductId = productId || variant?.product_id;
      queryClient.invalidateQueries({ queryKey: ['variants', targetProductId] });
      queryClient.invalidateQueries({ queryKey: ['variant', variantId] });
      queryClient.invalidateQueries({ queryKey: ['variant-prices', variantId] });
      queryClient.invalidateQueries({ queryKey: ['product', targetProductId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory', targetProductId] });
      toast.success('Variant updated successfully');
      if (targetProductId) {
        navigate(`${basePath}/products/${targetProductId}/variants`);
      } else {
        navigate(`${basePath}/products`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update variant');
    },
  });

  // Handle adding image files (store locally, upload on submit)
  const handleImageAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles = newFiles.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error('Please select valid image files');
      return;
    }

    // Create previews
    const newPreviews: string[] = [];
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        newPreviews.push(preview);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setImageFiles(prev => [...prev, ...validFiles]);
  };

  // Remove image from previews
  const handleImageRemove = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Remove existing image
  const handleExistingImageRemove = async (imageId: string) => {
    try {
      await apiClient.delete(`/product-images/${imageId}`);
      setExistingImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Image removed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove image');
    }
  };

  // Price management functions
  const addPrice = () => {
    const currentPrices = form.getValues('prices') || [];
    const usedTypes = currentPrices.map(p => p.price_type);
    const availableType = PRICE_TYPES.find(pt => !usedTypes.includes(pt.value));
    
    if (!availableType) {
      toast.error('All price types have been added');
      return;
    }

    form.setValue('prices', [
      ...currentPrices,
      {
        price_type: availableType.value,
        sale_price: 0,
        mrp_price: 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: null,
      }
    ]);

    const newIndex = currentPrices.length;
  };

  const removePrice = (index: number) => {
    const currentPrices = form.getValues('prices') || [];
    const priceToRemove = currentPrices[index];
    
    // Prevent removing standard price
    if (priceToRemove.price_type === 'standard') {
      toast.error('Standard price cannot be removed');
      return;
    }

    const newPrices = currentPrices.filter((_, i) => i !== index);
    form.setValue('prices', newPrices);
  };

  const onSubmit = async (data: VariantFormValues) => {
    // Ensure variant can only be active if product is active
    if (data.is_active && product && !product.is_active) {
      toast.error('Cannot activate variant: product is inactive. Activate the product first.');
      return;
    }

    if (isEditMode) {
      updateMutation.mutate(data, {
        onSuccess: async (updatedVariant) => {
          // Upload new images after variant is updated
          if (imageFiles.length > 0 && updatedVariant.id) {
            await uploadVariantImages(updatedVariant.id, updatedVariant.product_id);
          }
        },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: async (newVariant) => {
          // Upload new images after variant is created
          if (imageFiles.length > 0 && newVariant.id) {
            await uploadVariantImages(newVariant.id, newVariant.product_id);
          }
        },
      });
    }
  };

  // Upload variant images after variant is created/updated
  const uploadVariantImages = async (variantId: string, productId: string) => {
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    try {
      // Upload files first
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('images', file);
      });
      formData.append('isPrimary', 'false');

      const { data: uploadResponse } = await apiClient.post<ProductImageUploadResponse>(
        `/uploads/product/${productId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Then link them to the variant
      if (uploadResponse.images && uploadResponse.images.length > 0) {
        const imageUrls = uploadResponse.images.map(img => img.url);
        await apiClient.post(`/product-images/${productId}/bulk`, {
          images: imageUrls.map((url, idx) => ({
            image_url: url,
            variant_id: variantId,
            display_order: idx,
            is_primary: false,
          })),
        });

        toast.success(`${uploadResponse.images.length} image(s) uploaded successfully`);
        // Clear the image files and previews
        setImageFiles([]);
        setImagePreviews([]);
        // Refresh variant images
        queryClient.invalidateQueries({ queryKey: ['variant-images', variantId] });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoadingVariant) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => {
            const targetProductId = productId || variant?.product_id;
            if (targetProductId) {
              navigate(`${basePath}/products/${targetProductId}/variants`);
            } else {
              navigate(`${basePath}/products`);
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Variants
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Variant' : 'Create Variant'}
        </h1>
        {product && (
          <p className="text-muted-foreground mt-1">Product: {product.name}</p>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 500g Pack"
                        {...field}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., PROD-500G-001"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multiple Prices Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Prices *</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPrice}
                    disabled={form.watch('prices')?.length >= PRICE_TYPES.length}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Price Type
                  </Button>
                </div>
                
                <FormField
                  control={form.control}
                  name="prices"
                  render={() => (
                    <FormItem>
                      <div className="space-y-4">
                        {form.watch('prices')?.map((price, index) => (
                          <Card key={index} className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <FormField
                                  control={form.control}
                                  name={`prices.${index}.price_type`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Price Type *</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={price.price_type === 'standard'}
                                      >
                                        <FormControl>
                                          <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {PRICE_TYPES.map((pt) => {
                                            const isUsed = form.watch('prices')?.some((p, i) => 
                                              i !== index && p.price_type === pt.value
                                            );
                                            return (
                                              <SelectItem
                                                key={pt.value}
                                                value={pt.value}
                                                disabled={isUsed && pt.value !== price.price_type}
                                              >
                                                {pt.label}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              {price.price_type !== 'standard' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePrice(index)}
                                  className="ml-4 mt-8"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`prices.${index}.mrp_price`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>MRP (Maximum Retail Price) *</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                                        className={isMobile ? 'h-12 text-base' : ''}
                                        inputMode="numeric"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`prices.${index}.sale_price`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Sale Price *</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        {...field}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                                        className={isMobile ? 'h-12 text-base' : ''}
                                        inputMode="numeric"
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Must be ≤ MRP
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <FormField
                                control={form.control}
                                name={`prices.${index}.valid_from`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Valid From</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`prices.${index}.valid_until`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Valid Until (Optional)</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </Card>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Main Image</CardTitle>
              <FormDescription>
                This is the primary image displayed for this variant. It will be saved to the variant record.
              </FormDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Image URL</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value || ''}
                        onChange={(url) => {
                          field.onChange(url || null);
                        }}
                        onFileSelect={async (file) => {
                          if (!actualProductId) {
                            toast.error('Product ID is required to upload image');
                            return;
                          }
                          try {
                            setIsUploading(true);
                            const uploadResponse = await uploadsService.uploadProductImage(actualProductId, file);
                            field.onChange(uploadResponse.url);
                            toast.success('Main image uploaded successfully');
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to upload image');
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                        disabled={isUploading || !actualProductId}
                        size="small"
                      />
                    </FormControl>
                    <FormDescription>
                      Upload or enter a URL for the main variant image. This will be used as the default display image.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Images</CardTitle>
              <FormDescription>
                These images are stored in the product_images table and will be shown as additional gallery images.
              </FormDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div>
                  <FormLabel className="mb-2 block">Existing Additional Images</FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {existingImages.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.image_url}
                          alt={`Variant image ${image.display_order}`}
                          className="w-full h-24 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleExistingImageRemove(image.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Image Previews */}
              {(imagePreviews.length > 0 || existingImages.length === 0) && (
                <div>
                  <FormLabel className="mb-2 block">
                    {existingImages.length > 0 ? 'New Additional Images' : 'Additional Images'}
                  </FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleImageRemove(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Image Button */}
              <div>
                <input
                  type="file"
                  id="variant-images"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageAdd(e.target.files)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('variant-images')?.click()}
                  disabled={isUploading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Additional Images
                </Button>
                <FormDescription className="mt-2">
                  Select one or more images. Images will be uploaded to the product_images table when you save the variant.
                </FormDescription>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="1"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          className={isMobile ? 'h-12 text-base' : ''}
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                            <SelectValue placeholder="Select unit type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="best_before"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Best Before</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hsn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 12345678"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="badge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select badge" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {BADGE_OPTIONS.map((badge) => (
                          <SelectItem key={badge.value} value={badge.value}>
                            {badge.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax & Brand</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        {taxes.map((tax) => (
                          <SelectItem key={tax.id} value={tax.id}>
                            {tax.name} ({tax.rate}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <BrandSelector
                        selectedBrandId={field.value || null}
                        onSelect={field.onChange}
                        allowClear
                        className={isMobile ? 'h-12' : ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Stock Management */}
            <Card>
              <CardHeader>
              <CardTitle>Stock by Warehouse</CardTitle>
                <FormDescription>
                View current stock for this product across warehouses and optionally adjust stock for one warehouse.
                For bulk or cross‑warehouse movements, use the Stock Adjustment / Stock Transfer screens.
                </FormDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              {/* Existing stock table - filtered by variant */}
              {variantInventory && variantInventory.warehouses.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 bg-muted px-3 py-2 text-xs font-medium">
                    <div>Warehouse</div>
                    <div className="text-center">Current Stock</div>
                    <div className="text-right">Location</div>
                  </div>
                  {variantInventory.warehouses.map((row) => {
                    const warehouse = warehouses.find(w => w.id === row.warehouse_id);
                    return (
                      <div
                        key={`${row.warehouse_id}-${row.variant_id || 'all'}`}
                        className="grid grid-cols-3 px-3 py-2 text-xs border-t"
                      >
                        <div>
                          <div className="font-medium">
                            {warehouse?.name || row.warehouses?.name || 'Unknown'}
                          </div>
                          <div className="text-muted-foreground">
                            {warehouse?.code || row.warehouses?.code || row.warehouse_id}
                          </div>
                        </div>
                        <div className="text-center font-semibold">
                          {row.stock_count ?? 0}
                        </div>
                        <div className="text-right text-muted-foreground">
                          {row.location || '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No stock records found yet for this product.
                </p>
              )}

              {/* Multiple warehouse stock adjustments */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Adjust Stock in Warehouses</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWarehouseStockAdjustments([
                        ...warehouseStockAdjustments,
                        { id: Date.now().toString(), warehouse_id: null, stock: null }
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Warehouse
                  </Button>
                </div>
                
                {warehouseStockAdjustments.map((adjustment, index) => (
                  <div key={adjustment.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        value={adjustment.warehouse_id || 'none'}
                        onValueChange={(value) => {
                          const updated = [...warehouseStockAdjustments];
                          updated[index].warehouse_id = value === 'none' ? null : value;
                          setWarehouseStockAdjustments(updated);
                        }}
                      >
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Warehouse</SelectItem>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} {warehouse.code && `(${warehouse.code})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Stock quantity"
                        value={adjustment.stock ?? ''}
                        onChange={(e) => {
                          const updated = [...warehouseStockAdjustments];
                          const value = e.target.value;
                          updated[index].stock = value === '' ? null : Math.floor(parseFloat(value) || 0);
                          setWarehouseStockAdjustments(updated);
                        }}
                      />
                    </div>
                    {warehouseStockAdjustments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setWarehouseStockAdjustments(
                            warehouseStockAdjustments.filter((_, i) => i !== index)
                          );
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Legacy single warehouse fields (hidden, kept for form schema compatibility) */}
              <FormField
                control={form.control}
                name="warehouse_id"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="initial_stock"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="is_featured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Featured</FormLabel>
                      <FormDescription>
                        Show this variant prominently
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        {product && !product.is_active && (
                          <span className="text-destructive">Product is inactive. Variant cannot be activated.</span>
                        )}
                        {product && product.is_active && (
                          <span>Inactive variants won't appear in product listings</span>
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value && (product?.is_active ?? true)}
                        onCheckedChange={(checked) => {
                          if (checked && product && !product.is_active) {
                            toast.error('Cannot activate variant: product is inactive');
                            return;
                          }
                          field.onChange(checked);
                        }}
                        disabled={product ? !product.is_active : false}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const targetProductId = productId || variant?.product_id;
                if (targetProductId) {
                  navigate(`${basePath}/products/${targetProductId}/variants`);
                } else {
                  navigate(`${basePath}/products`);
                }
              }}
              className={isMobile ? 'h-12' : ''}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || isUploading}
              className={isMobile ? 'h-12' : ''}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEditMode
                ? 'Update Variant'
                : 'Create Variant'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

