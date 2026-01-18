import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";
import { ImageUpload } from "@/components/ui/image-upload";
import { MultiImageUpload } from "@/components/ui/multi-image-upload";
import { productsService, type Product, type CreateProductInput } from "@/api/products";
import { categoriesService, type Category } from "@/api/categories";
import { uploadsService } from "@/api/uploads";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Price must be a valid number greater than or equal to 0",
  }),
  sale_price: z.string().optional().nullable().refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
    message: "Sale price must be a valid number greater than or equal to 0",
  }),
  stock_count: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 0, {
    message: "Stock must be a valid number greater than or equal to 0",
  }),
  category_id: z.string(),
  origin: z.string(),
  unit: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Unit must be a valid number greater than or equal to 0",
  }),
  unit_type: z.string(),
  badge: z.string().optional().nullable(),
  image_url: z.string(),
  additional_images: z.array(z.string()).default([]),
  nutritional_info: z.string().optional(),
  best_before: z.string().optional(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type FormSchema = z.infer<typeof formSchema>;

const UNIT_TYPES = ['kg', 'g', 'lb', 'oz', 'piece', 'bunch', 'pack', 'bag'];
const BADGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'sale', label: 'Sale' },
  { value: 'best-seller', label: 'Best Seller' },
  { value: 'organic', label: 'Organic' },
];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isEditMode = Boolean(id);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      sale_price: undefined,
      stock_count: "",
      category_id: "",
      origin: "",
      unit: "",
      unit_type: "",
      badge: "",
      image_url: "",
      additional_images: [],
      nutritional_info: "",
      best_before: "",
      is_featured: false,
      is_active: true,
    },
  });

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: categoriesService.getAll,
  });

  const { data: product, isLoading: isProductLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => productsService.getById(id!),
    enabled: isEditMode,
  });

  const { data: products, isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsService.getAll,
  });

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      // Clean up blob URLs when component unmounts
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
      additionalImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageUrl, additionalImages]);

  const createProduct = useMutation({
    mutationFn: (data: CreateProductInput) => productsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
      navigate("/admin/products");
    },
    onError: () => {
      toast.error("Failed to create product");
    },
  });

  const updateProduct = useMutation({
    mutationFn: (data: { id: string; data: CreateProductInput }) => 
      productsService.update(data.id, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated successfully");
      navigate("/admin/products");
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        sale_price: product.sale_price?.toString(),
        stock_count: product.stock_count.toString(),
        category_id: product.category_id || "",
        origin: product.origin,
        unit: product.unit.toString(),
        unit_type: product.unit_type,
        badge: product.badge || "",
        image_url: product.image_url,
        additional_images: product.additional_images || [],
        nutritional_info: product.nutritional_info || "",
        best_before: product.best_before || "",
        is_featured: product.is_featured,
        is_active: product.is_active,
      });
      setImageUrl(product.image_url);
      setAdditionalImages(product.additional_images || []);

      // Set form values for all fields
      Object.keys(form.getValues()).forEach(key => {
        const value = product[key as keyof Product];
        if (value !== undefined) {
          if (typeof value === 'number') {
            form.setValue(key as keyof FormSchema, value.toString());
          } else {
            form.setValue(key as keyof FormSchema, value);
          }
        }
      });
    }
  }, [product, form]);

  const onSubmit = async (data: FormSchema) => {
    setIsLoading(true);
    try {
      const slug = data.name.toLowerCase().replace(/\s+/g, '-');
      if (!isEditMode && products?.some(p => p.slug === slug)) {
        toast.error('A product with this slug already exists. Please use a different name.');
        setIsLoading(false);
        return;
      }
      // Don't include blob URLs in product data - only use real URLs or null
      // If imageFile exists, we'll upload it separately and update the product
      const imageUrlToSave = imageFile 
        ? (isEditMode && product?.image_url ? product.image_url : null) // Keep existing URL if editing, null if creating
        : (data.image_url && !data.image_url.startsWith('blob:') ? data.image_url : null); // Only use non-blob URLs

      const productData: CreateProductInput = {
        name: data.name,
        description: data.description || null,
        price: data.price,
        sale_price: data.sale_price || null,
        stock_count: data.stock_count,
        category_id: data.category_id || null,
        origin: data.origin || null,
        unit: data.unit,
        unit_type: data.unit_type,
        badge: data.badge || null,
        image_url: imageUrlToSave, // Use existing URL or null, not blob URL
        nutritional_info: data.nutritional_info || null,
        best_before: data.best_before || null,
        is_featured: Boolean(data.is_featured),
        is_active: Boolean(data.is_active),
        slug
      };

      console.log("Sending product data to API:", productData);

      let productId: string | undefined;
      if (isEditMode && product) {
        const updated = await updateProduct.mutateAsync({ 
          id: product.id, 
          data: productData
        });
        productId = updated.id;
      } else {
        const created = await createProduct.mutateAsync(productData);
        productId = created.id;
      }

      // Upload main image if file provided
      if (productId && imageFile) {
        try {
          setIsUploading(true);
          const uploadResult = await uploadsService.uploadProductImage(productId, imageFile, true);
          
          // Validate that we got a real URL (not a blob URL)
          if (!uploadResult.url || uploadResult.url.startsWith('blob:')) {
            throw new Error('Invalid upload URL received');
          }
          
          // Clean up blob URL if it exists
          if (imageUrl && imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrl);
          }
          
          // Update product with the uploaded image URL
          await productsService.update(productId, {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            sale_price: productData.sale_price,
            stock_count: productData.stock_count,
            category_id: productData.category_id,
            origin: productData.origin,
            unit: productData.unit,
            unit_type: productData.unit_type,
            badge: productData.badge,
            image_url: uploadResult.url, // Real uploaded URL
            nutritional_info: productData.nutritional_info,
            best_before: productData.best_before,
            is_featured: productData.is_featured,
            is_active: productData.is_active,
            slug: productData.slug
          });
          
          // Update form and state with the real URL
          form.setValue('image_url', uploadResult.url);
          setImageUrl(uploadResult.url);
          
          toast.success('Product and image saved successfully!');
        } catch (imgErr: any) {
          console.error('Main image upload failed:', imgErr);
          const errorMessage = imgErr?.response?.data?.error?.message || imgErr?.message || 'Unknown error';
          toast.error(`Product saved, but image upload failed: ${errorMessage}. Please try uploading the image again.`);
          // Clean up blob URL on error
          if (imageUrl && imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrl);
            setImageUrl('');
            form.setValue('image_url', '');
          }
        } finally {
          setIsUploading(false);
        }
      }

      // Upload additional images if files provided
      if (productId && additionalImageFiles.length > 0) {
        try {
          setIsUploading(true);
          await uploadsService.uploadProductImages(productId, additionalImageFiles);
        } catch (imgErr) {
          console.error('Additional images upload failed:', imgErr);
          toast.error('Product saved, but failed to upload additional images.');
        } finally {
          setIsUploading(false);
        }
      }

      navigate("/admin/products");
    } catch (error) {
      console.error("Error submitting form:", error);
      
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      
      toast.error(`Failed to save product: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
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
    <div className="container py-4">
      <div className="">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? `Edit Product: ${product?.name}` : "Add New Product"}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? "Update product information" : "Add a new product to your store"}
            </p>
          </div>
          {isEditMode && (
            <Link to={`/products/${product?.id}`}>
              <Button variant="outline" className="bg-green-600 text-white hover:bg-green-700">
                View Product
              </Button>
            </Link>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (AED)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01" 
                            min="0"
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01" 
                            min="0"
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                          disabled={isCategoriesLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
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

                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origin</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. United States" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="stock_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0"
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Value</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="e.g. 500"
                            onChange={(e) => field.onChange(e.target.value)}
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a unit type" />
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="badge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Badge (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a badge" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BADGE_OPTIONS.map((badge) => (
                              <SelectItem key={badge.value} value={badge.value}>
                                {badge.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Highlight the product with a special badge
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="best_before"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Best Before</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="nutritional_info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nutritional Information</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="is_featured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Featured Product</FormLabel>
                          <FormDescription>
                            Show this product in featured sections
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Active Status</FormLabel>
                          <FormDescription>
                            Product is visible in the store
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Image</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Clean up previous blob URL if it exists
                                if (imageUrl && imageUrl.startsWith('blob:')) {
                                  URL.revokeObjectURL(imageUrl);
                                }
                                
                                setImageFile(file);
                                const previewUrl = URL.createObjectURL(file);
                                setImageUrl(previewUrl);
                                // Don't set blob URL in form field - it will be updated after upload
                                // field.onChange is not called here to prevent blob URLs in form data
                              }
                            }}
                          />
                          {/* Show real image URL (from product or uploaded) */}
                          {field.value && !field.value.startsWith('blob:') && (
                            <div className="w-48 h-48 rounded-lg overflow-hidden border relative">
                              <img
                                src={field.value}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {/* Show blob preview only temporarily while file is selected but not uploaded */}
                          {imageUrl && imageUrl.startsWith('blob:') && !field.value && (
                            <div className="w-48 h-48 rounded-lg overflow-hidden border relative">
                              <img
                                src={imageUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                              {isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">
                                  Uploading...
                                </div>
                              )}
                            </div>
                          )}
                          {!field.value && !imageUrl && product?.image_url && (
                            <div className="w-48 h-48 rounded-lg overflow-hidden border">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Upload the main product image (will be compressed automatically)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additional_images"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Images</FormLabel>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              setAdditionalImageFiles([...additionalImageFiles, ...files]);
                              const previewUrls = files.map(file => URL.createObjectURL(file));
                              const newUrls = [...field.value, ...previewUrls];
                              field.onChange(newUrls);
                              setAdditionalImages(newUrls);
                            }
                          }}
                        />
                        {field.value.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {field.value.map((url, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={`Additional ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-md border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                                  onClick={() => {
                                    const newUrls = field.value.filter((_, i) => i !== index);
                                    field.onChange(newUrls);
                                    setAdditionalImages(newUrls);
                                    setAdditionalImageFiles(additionalImageFiles.filter((_, i) => i !== index));
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Existing images would be shown here if product has images property */}
                      </div>
                      <FormDescription>
                        Upload additional product images (will be compressed automatically)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/products")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createProduct.isPending ||
                  updateProduct.isPending ||
                  isCategoriesLoading ||
                  isUploading ||
                  isLoading
                }
              >
                {(createProduct.isPending || updateProduct.isPending || isUploading || isLoading) && (
                  <Spinner className="mr-2" />
                )}
                {isUploading ? 'Uploading images...' : isEditMode ? "Update" : "Create"} Product
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
