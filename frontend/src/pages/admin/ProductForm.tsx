import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

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
import { productsService, type Product, type CreateProductInput } from "@/api/products";
import { categoriesService, type Category } from "@/api/categories";
import { BrandSelector } from "@/components/brands/BrandSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Catalog-only product form schema
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category_id: z.string().min(1, 'Category is required'),
  brand_id: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  nutritional_info: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  product_code: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
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

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category_id: "",
      brand_id: "",
      origin: "",
      nutritional_info: "",
      is_active: true,
      product_code: "",
      slug: "",
    },
  });

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: categoriesService.getAll,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsService.getAll,
  });

  const { data: product, isLoading: isProductLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => productsService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        category_id: product.category_id || "",
        brand_id: product.brand_id || "",
        origin: product.origin || "",
        nutritional_info: product.nutritional_info || "",
        is_active: product.is_active,
        product_code: product.product_code || "",
        slug: product.slug || "",
      });
    }
  }, [product, form]);

  const createProduct = useMutation({
    mutationFn: (data: CreateProductInput) => productsService.create(data),
    onSuccess: () => {
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
    onSuccess: () => {
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
      brand_id: data.brand_id || null,
      origin: data.origin || null,
      nutritional_info: data.nutritional_info || null,
      is_active: Boolean(data.is_active),
      product_code: data.product_code || null,
      slug,
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
    if (currentStep === 1 && form.watch('name') && form.watch('description')) {
      setCurrentStep(2);
    } else if (currentStep === 2 && form.watch('category_id')) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
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
            {[1, 2, 3, 4].map((step) => (
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
                {step < 4 && (
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
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the product..."
                          {...field}
                          className={isMobile ? 'min-h-32 text-base' : ''}
                          rows={isMobile ? 6 : 4}
                        />
                      </FormControl>
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

                {isMobile && form.watch('name') && form.watch('description') && (
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
                          {categories?.map((category) => (
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
                        Product origin or source location
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

                {!isMobile && (
                  <Button type="button" onClick={handleNext} variant="outline">
                    Next: Status & Review
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Status */}
          {(currentStep >= 4 || !isMobile) && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4: Status</CardTitle>
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
