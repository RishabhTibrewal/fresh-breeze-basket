import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Upload } from 'lucide-react';
import { brandsService, Brand } from '@/api/brands';
import { uploadsService } from '@/api/uploads';
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
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const brandSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().optional().nullable(),
  legal_name: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type BrandFormValues = z.infer<typeof brandSchema>;

export default function BrandForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditMode = Boolean(id);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      slug: '',
      legal_name: '',
      logo_url: '',
      is_active: true,
    },
  });

  const { data: brand, isLoading } = useQuery<Brand>({
    queryKey: ['brand', id],
    queryFn: () => brandsService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (brand) {
      form.reset({
        name: brand.name,
        slug: brand.slug || '',
        legal_name: brand.legal_name || '',
        logo_url: brand.logo_url || '',
        is_active: brand.is_active,
      });
      if (brand.logo_url) {
        setLogoUrl(brand.logo_url);
      }
    }
  }, [brand, form]);

  const createMutation = useMutation({
    mutationFn: (data: BrandFormValues) => brandsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand created successfully');
      navigate('/admin/brands');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create brand');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: BrandFormValues) => brandsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand', id] });
      toast.success('Brand updated successfully');
      navigate('/admin/brands');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update brand');
    },
  });

  const handleLogoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadsService.uploadImage(file);
      setLogoUrl(uploadedUrl);
      form.setValue('logo_url', uploadedUrl);
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const onSubmit = async (data: BrandFormValues) => {
    // Auto-generate slug if not provided
    if (!data.slug && data.name) {
      data.slug = generateSlug(data.name);
    }

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/brands')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Brands
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Brand' : 'Create Brand'}
        </h1>
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
                    <FormLabel>Brand Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Nature's Try"
                        {...field}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name of the brand
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
                        placeholder="natures-try"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value || null);
                        }}
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

              <FormField
                control={form.control}
                name="legal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nature's Try Private Limited"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value || null);
                        }}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Official legal name (for invoices and legal documents)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Logo</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={logoUrl}
                        onChange={(file) => {
                          if (file) {
                            handleLogoUpload(file);
                          } else {
                            setLogoUrl('');
                            field.onChange(null);
                          }
                        }}
                        disabled={isUploading}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload the brand logo (recommended: square image, min 200x200px)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
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
                        Inactive brands won't appear in product selection
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

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/brands')}
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
                ? 'Update Brand'
                : 'Create Brand'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

