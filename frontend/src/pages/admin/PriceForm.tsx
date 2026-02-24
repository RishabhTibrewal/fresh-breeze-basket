import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Calendar } from 'lucide-react';
import { pricesService, CreatePriceInput } from '@/api/prices';
import { productsService, Product } from '@/api/products';
import { variantsService, ProductVariant } from '@/api/variants';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const priceSchema = z.object({
  variant_id: z.string().min(1, 'Variant is required'),
  product_id: z.string().optional().nullable(),
  outlet_id: z.string().optional().nullable(),
  price_type: z.string().min(1, 'Price type is required'),
  mrp_price: z.number().min(0, 'MRP must be >= 0'),
  sale_price: z.number().min(0, 'Sale price must be >= 0'),
  brand_id: z.string().optional().nullable(),
  valid_from: z.string().min(1, 'Valid from date is required'),
  valid_until: z.string().optional().nullable(),
}).refine((data) => data.sale_price <= data.mrp_price, {
  message: 'Sale price must be less than or equal to MRP',
  path: ['sale_price'],
});

type PriceFormValues = z.infer<typeof priceSchema>;

const PRICE_TYPES = ['DEFAULT', 'PROMOTIONAL', 'BULK', 'WHOLESALE', 'RETAIL'];

export default function PriceForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const priceId = searchParams.get('id');
  const variantIdParam = searchParams.get('variant_id');
  const isEditMode = Boolean(priceId);
  const [validFromDate, setValidFromDate] = React.useState<Date | undefined>();
  const [validUntilDate, setValidUntilDate] = React.useState<Date | undefined>();

  const form = useForm<PriceFormValues>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      variant_id: variantIdParam || '',
      product_id: '',
      outlet_id: '',
      price_type: 'DEFAULT',
      mrp_price: 0,
      sale_price: 0,
      brand_id: '',
      valid_from: format(new Date(), 'yyyy-MM-dd'),
      valid_until: '',
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  const selectedVariantId = form.watch('variant_id');
  const selectedProductId = form.watch('product_id');

  const { data: variants = [] } = useQuery<ProductVariant[]>({
    queryKey: ['variants', selectedProductId],
    queryFn: async () => {
      if (selectedProductId) {
        return variantsService.getByProduct(selectedProductId);
      }
      // If no product selected, get variants from selected variant's product
      if (selectedVariantId) {
        const variant = await variantsService.getById(selectedVariantId);
        return variantsService.getByProduct(variant.product_id);
      }
      return [];
    },
    enabled: !!selectedProductId || !!selectedVariantId,
  });

  const { data: price } = useQuery({
    queryKey: ['price', priceId],
    queryFn: () => pricesService.getById(priceId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (price) {
      form.reset({
        variant_id: price.variant_id || '',
        product_id: price.product_id || '',
        outlet_id: price.outlet_id || '',
        price_type: price.price_type,
        mrp_price: price.mrp_price,
        sale_price: price.sale_price,
        brand_id: price.brand_id || '',
        valid_from: price.valid_from.split('T')[0],
        valid_until: price.valid_until ? price.valid_until.split('T')[0] : '',
      });
      setValidFromDate(new Date(price.valid_from));
      if (price.valid_until) {
        setValidUntilDate(new Date(price.valid_until));
      }
    }
  }, [price, form]);

  useEffect(() => {
    if (selectedVariantId && variants.length > 0) {
      const variant = variants.find(v => v.id === selectedVariantId);
      if (variant && variant.product_id) {
        form.setValue('product_id', variant.product_id);
      }
    }
  }, [selectedVariantId, variants, form]);

  const createMutation = useMutation({
    mutationFn: (data: PriceFormValues) => {
      // Ensure all required fields are present and properly typed
      const createData: CreatePriceInput = {
        variant_id: data.variant_id || null,
        product_id: data.product_id || null,
        outlet_id: data.outlet_id || null,
        price_type: data.price_type,
        mrp_price: data.mrp_price,
        sale_price: data.sale_price,
        brand_id: data.brand_id || null,
        valid_from: data.valid_from,
        valid_until: data.valid_until || null,
      };
      return pricesService.create(createData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['variant-prices'] });
      toast.success('Price created successfully');
      navigate('/admin/prices');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create price');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PriceFormValues) => pricesService.update(priceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['price', priceId] });
      toast.success('Price updated successfully');
      navigate('/admin/prices');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update price');
    },
  });

  const onSubmit = async (data: PriceFormValues) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/prices')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Prices
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Price' : 'Create Price'}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product & Variant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value || null);
                        form.setValue('variant_id', ''); // Reset variant when product changes
                      }}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select product (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select product to filter variants
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="variant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {variants.length === 0 ? (
                          <SelectItem value="" disabled>
                            {selectedProductId ? 'No variants found' : 'Select a product first'}
                          </SelectItem>
                        ) : (
                          variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.name}
                            </SelectItem>
                          ))
                        )}
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
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="price_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={isMobile ? 'h-12 text-base' : ''}>
                          <SelectValue placeholder="Select price type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRICE_TYPES.map((type) => (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mrp_price"
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
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                  name="sale_price"
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
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validity Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Valid From *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !validFromDate && 'text-muted-foreground',
                              isMobile && 'h-12 text-base'
                            )}
                          >
                            {validFromDate ? (
                              format(validFromDate, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={validFromDate}
                          onSelect={(date) => {
                            setValidFromDate(date);
                            field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Valid Until (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !validUntilDate && 'text-muted-foreground',
                              isMobile && 'h-12 text-base'
                            )}
                          >
                            {validUntilDate ? (
                              format(validUntilDate, 'PPP')
                            ) : (
                              <span>Pick a date (optional)</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={validUntilDate}
                          onSelect={(date) => {
                            setValidUntilDate(date);
                            field.onChange(date ? format(date, 'yyyy-MM-dd') : null);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/prices')}
              className={isMobile ? 'h-12' : ''}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className={isMobile ? 'h-12' : ''}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEditMode
                ? 'Update Price'
                : 'Create Price'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

