import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { productsService, type Product, type CreateProductInput } from "@/api/products";
import { categoriesService, type Category } from "@/api/categories";
import { BrandSelector } from "@/components/brands/BrandSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { uploadsService } from "@/api/uploads";
import { collectionsApi, type Collection } from "@/api/collections";
import { modifiersService, type ModifierGroup } from "@/api/modifiers";
import { Checkbox } from "@/components/ui/checkbox";

const bundleComponentSchema = z.object({
  component_variant_id: z.string().min(1, 'Please select a component'),
  quantity_included: z.number().min(0.01, 'Quantity must be > 0'),
  price_adjustment: z.number().optional().nullable(),
});

// Catalog-only product form schema
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional().nullable(),
  category_id: z.string().min(1, 'Category is required'),
  subcategory_id: z.string().optional().nullable(),
  brand_id: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  nutritional_info: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  product_code: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  collection_ids: z.array(z.string()).default([]),
  modifier_group_ids: z.array(z.string()).default([]),
  is_bundle: z.boolean().default(false),
  bundle_components: z.array(bundleComponentSchema).optional().nullable(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(1);
  const isEditMode = Boolean(id);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category_id: "",
      subcategory_id: "",
      brand_id: "",
      origin: "",
      nutritional_info: "",
      is_active: true,
      product_code: "",
      slug: "",
      collection_ids: [],
      modifier_group_ids: [],
      is_bundle: false,
      bundle_components: [],
    },
  });

  const watchedCategoryId = form.watch('category_id');

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: categoriesService.getAll,
  });

  // Fetch subcategories for the selected category
  const { data: subcategories } = useQuery<Category[]>({
    queryKey: ["subcategories", watchedCategoryId],
    queryFn: () => categoriesService.getSubcategories(watchedCategoryId!),
    enabled: !!watchedCategoryId,
  });

  const hasSubcategories = (subcategories?.length ?? 0) > 0;

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsService.getAll,
  });

  const availableVariants = useMemo(() => {
    if (!products) return [];
    return products.flatMap(p => 
      p.variants?.map(v => ({
        ...v,
        productName: p.name
      })) || []
    );
  }, [products]);

  const { data: product, isLoading: isProductLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => productsService.getById(id!),
    enabled: isEditMode,
  });

  const { data: collections } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.getAll(),
  });

  const { data: modifierGroups } = useQuery<ModifierGroup[]>({
    queryKey: ['modifierGroups'],
    queryFn: modifiersService.getModifierGroups,
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        category_id: product.category_id || "",
        subcategory_id: (product as any).subcategory_id || "",
        brand_id: product.brand_id || "",
        origin: product.origin || "",
        nutritional_info: product.nutritional_info || "",
        is_active: product.is_active,
        product_code: product.product_code || "",
        slug: product.slug || "",
        collection_ids: product.variants?.[0]?.collections?.map(c => c.id) || [],
        modifier_group_ids: product.variants?.[0]?.modifier_groups?.map(m => m.id) || [],
        is_bundle: product.variants?.[0]?.is_bundle || false,
        bundle_components: product.variants?.[0]?.bundle_components?.map(c => ({
          component_variant_id: c.component_variant_id,
          quantity_included: c.quantity_included,
          price_adjustment: c.price_adjustment,
        })) || [],
      });
      if (product.image_url) {
        setProductImageUrl(product.image_url);
      } else if (product.additional_images && product.additional_images.length > 0) {
        setProductImageUrl(product.additional_images[0]);
      }
    }
  }, [product, form]);

  const createProduct = useMutation({
    mutationFn: (data: CreateProductInput) => productsService.create(data),
    onSuccess: async (createdProduct) => {
      // Upload image if provided
      if (productImageFile && createdProduct.id) {
        try {
          setIsUploadingImage(true);
          
          // Verify file is still valid
          if (!(productImageFile instanceof File)) {
            throw new Error('Invalid file object');
          }
          
          console.log('[ProductForm] Uploading image:', {
            productId: createdProduct.id,
            fileName: productImageFile.name,
            fileSize: productImageFile.size,
            fileType: productImageFile.type
          });
          
          await uploadsService.uploadProductImage(createdProduct.id, productImageFile, true);
          toast.success("Product image uploaded successfully");
        } catch (error: any) {
          console.error('Error uploading product image:', error);
          const errorMessage = error.response?.data?.error || error.message || "Product created but image upload failed";
          toast.error(errorMessage);
        } finally {
          setIsUploadingImage(false);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
      navigate(`${basePath}/products`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create product");
    },
  });

  const updateProduct = useMutation({
    mutationFn: (data: { id: string; data: CreateProductInput }) => 
      productsService.update(data.id, data.data),
    onSuccess: async () => {
      // Upload image if a new file was selected
      if (productImageFile && id) {
        try {
          setIsUploadingImage(true);
          
          // Verify file is still valid
          if (!(productImageFile instanceof File)) {
            throw new Error('Invalid file object');
          }
          
          console.log('[ProductForm] Uploading image for update:', {
            productId: id,
            fileName: productImageFile.name,
            fileSize: productImageFile.size,
            fileType: productImageFile.type
          });
          
          await uploadsService.uploadProductImage(id, productImageFile, true);
          toast.success("Product image uploaded successfully");
        } catch (error: any) {
          console.error('Error uploading product image:', error);
          const errorMessage = error.response?.data?.error || error.message || "Product updated but image upload failed";
          toast.error(errorMessage);
        } finally {
          setIsUploadingImage(false);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Product updated successfully");
      navigate(`${basePath}/products`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update product");
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const onSubmit = async (data: FormSchema) => {
    const slug = data.slug || generateSlug(data.name);
    
    if (!isEditMode && products?.some(p => p.slug === slug)) {
      toast.error('A product with this slug already exists. Please use a different name or slug.');
      return;
    }

    const productData: CreateProductInput = {
      name: data.name,
      description: data.description || null,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      brand_id: data.brand_id || null,
      origin: data.origin || null,
      nutritional_info: data.nutritional_info || null,
      is_active: Boolean(data.is_active),
      product_code: data.product_code || null,
      slug,
      collection_ids: data.collection_ids,
      modifier_group_ids: data.modifier_group_ids,
      is_bundle: data.is_bundle,
      bundle_components: data.is_bundle && data.bundle_components ? data.bundle_components.map(c => ({
        component_variant_id: c.component_variant_id,
        quantity_included: c.quantity_included,
        price_adjustment: c.price_adjustment ?? null,
      })) : [],
    };

    if (isEditMode && product) {
      await updateProduct.mutateAsync({ 
        id: product.id, 
        data: productData
      });
    } else {
      await createProduct.mutateAsync(productData);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && form.watch('name')) {
      setCurrentStep(2);
    } else if (currentStep === 2 && form.watch('category_id')) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isEditMode && isProductLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`${basePath}/products`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? `Edit Product: ${product?.name}` : "Create Product"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode ? "Update product catalog information" : "Add a new product to your catalog"}
        </p>
      </div>

      {/* Step Indicator for Mobile */}
      {isMobile && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    currentStep >= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-2',
                      currentStep > step ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basic Information */}
          {(currentStep === 1 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Organic Tomatoes"
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the product..."
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={isMobile ? 'min-h-32 text-base' : ''}
                          rows={isMobile ? 6 : 4}
                        />
                      </FormControl>
                      <FormDescription>
                        Product description (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="product_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., PROD-001"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={isMobile ? 'h-12 text-base' : ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Unique product identifier (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="organic-tomatoes"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={isMobile ? 'h-12 text-base' : ''}
                        />
                      </FormControl>
                      <FormDescription>
                        URL-friendly identifier (auto-generated if left empty)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isMobile && form.watch('name') && (
                  <Button type="button" onClick={handleNext} className="w-full h-12">
                    Next: Category & Brand
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Category */}
          {form.watch('name') && (currentStep >= 2 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Clear subcategory when category changes
                          form.setValue('subcategory_id', '');
                          if (isMobile && value) {
                            setTimeout(() => handleNext(), 100);
                          }
                        }}
                        value={field.value}
                        disabled={isCategoriesLoading}
                      >
                        <FormControl>
                          <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                            {isCategoriesLoading ? (
                              <div className="flex items-center gap-2">
                                <Spinner className="h-4 w-4" />
                                <span>Loading categories...</span>
                              </div>
                            ) : (
                              <SelectValue placeholder="Select a category" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.filter(c => !c.parent_id).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose a category for your product
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subcategory — only shown if selected category has subcategories */}
                {hasSubcategories && (
                  <FormField
                    control={form.control}
                    name="subcategory_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)}
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                              <SelectValue placeholder="No subcategory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No subcategory</SelectItem>
                            {subcategories?.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Narrow down to a specific subcategory (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!isMobile && form.watch('category_id') && (
                  <Button type="button" onClick={handleNext} variant="outline">
                    Next: Brand & Details
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Brand & Additional Details */}
          {form.watch('category_id') && (currentStep >= 3 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Brand & Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <FormDescription>
                        Select a brand (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., India, United States"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={isMobile ? 'h-12 text-base' : ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Product origin or source location (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nutritional_info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nutritional Information</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter nutritional information..."
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={isMobile ? 'min-h-32 text-base' : ''}
                          rows={isMobile ? 6 : 4}
                        />
                      </FormControl>
                      <FormDescription>
                        Nutritional facts and information (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Product Image</Label>
                  <ImageUpload
                    value={productImageUrl}
                    onChange={(url) => {
                      setProductImageUrl(url);
                      if (!url) {
                        setProductImageFile(null);
                      }
                    }}
                    onFileSelect={(file) => {
                      setProductImageFile(file);
                      // Create preview URL
                      const previewUrl = URL.createObjectURL(file);
                      setProductImageUrl(previewUrl);
                    }}
                    disabled={isUploadingImage}
                    size="default"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a product image (optional). This will be set as the primary image.
                  </p>
                </div>

                {!isMobile && (
                  <Button type="button" onClick={handleNext} variant="outline">
                    Next: Product Groupings
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Product Groupings & Bundles */}
          {form.watch('category_id') && (currentStep >= 4 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4: Product Groupings & Bundles</CardTitle>
                <CardDescription>Assign collections, modifiers, and bundle settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-4 text-sm font-medium">Collections</h3>
                  {collections && collections.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {collections.map((collection) => (
                        <FormField
                          key={collection.id}
                          control={form.control}
                          name="collection_ids"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={collection.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(collection.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, collection.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== collection.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {collection.name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No collections found.</p>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="mb-4 text-sm font-medium">Modifier Groups</h3>
                  {modifierGroups && modifierGroups.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {modifierGroups.map((group) => (
                        <FormField
                          key={group.id}
                          control={form.control}
                          name="modifier_group_ids"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={group.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(group.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, group.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== group.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="cursor-pointer">
                                    {group.name}
                                  </FormLabel>
                                  <FormDescription>
                                    Min: {group.min_select} | Max: {group.max_select ?? 'Any'}
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No modifier groups found.</p>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="mb-4 text-sm font-medium">Bundle / Combo Settings</h3>
                  <FormField
                    control={form.control}
                    name="is_bundle"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Is Combo / Bundle</FormLabel>
                          <FormDescription>
                            Enable this if this product is made up of multiple inventory items
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

                  {form.watch('is_bundle') && (
                    <div className="space-y-4 mt-4 bg-muted/20 p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">Bundle Components</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const current = form.getValues('bundle_components') || [];
                            form.setValue('bundle_components', [
                              ...current,
                              { component_variant_id: '', quantity_included: 1, price_adjustment: null }
                            ]);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Add Component
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name="bundle_components"
                        render={() => (
                          <FormItem>
                            <div className="space-y-3">
                              {form.watch('bundle_components')?.map((component, index) => (
                                <div key={index} className="flex flex-col sm:flex-row gap-3 items-end p-3 bg-background border rounded-md">
                                  <div className="flex-1 w-full">
                                    <FormField
                                      control={form.control}
                                      name={`bundle_components.${index}.component_variant_id`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-xs">Inventory Item</FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select component" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {availableVariants.map(v => (
                                                <SelectItem key={v.id} value={v.id}>
                                                  {v.productName} - {v.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <div className="w-full sm:w-24">
                                    <FormField
                                      control={form.control}
                                      name={`bundle_components.${index}.quantity_included`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-xs">Qty</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0.01"
                                              {...field}
                                              value={field.value ?? ''}
                                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                              className="h-9"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <div className="w-full sm:w-32">
                                    <FormField
                                      control={form.control}
                                      name={`bundle_components.${index}.price_adjustment`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-xs">Price Adj.</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              {...field}
                                              value={field.value ?? ''}
                                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                              className="h-9"
                                              placeholder="0.00"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const current = form.getValues('bundle_components') || [];
                                      form.setValue('bundle_components', current.filter((_, i) => i !== index));
                                    }}
                                    className="text-destructive h-9 px-2"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              {(!form.watch('bundle_components') || form.watch('bundle_components')?.length === 0) && (
                                <p className="text-xs text-muted-foreground italic text-center py-2">
                                  No components added to this bundle yet.
                                </p>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {!isMobile && (
                  <Button type="button" onClick={handleNext} variant="outline">
                    Next: Status & Review
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 5: Status */}
          {(currentStep >= 5 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 5: Status</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive products won't appear in product listings
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
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {isMobile && currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="h-12"
              >
                Back
              </Button>
            )}
            <div className="flex flex-col sm:flex-row gap-4 flex-1 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`${basePath}/products`)}
                className={isMobile ? 'h-12' : ''}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createProduct.isPending ||
                  updateProduct.isPending ||
                  isCategoriesLoading
                }
                className={isMobile ? 'h-12' : ''}
              >
                {createProduct.isPending || updateProduct.isPending
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Product'
                  : 'Create Product'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
