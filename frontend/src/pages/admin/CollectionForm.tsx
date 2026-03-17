import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Upload } from 'lucide-react';
import { collectionsApi, Collection } from '@/api/collections';
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

const collectionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  display_order: z.number().default(0),
});

type CollectionFormValues = z.infer<typeof collectionSchema>;

export default function CollectionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditMode = Boolean(id);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      image_url: '',
      is_active: true,
      display_order: 0,
    },
  });

  const { data: collection, isLoading } = useQuery<Collection>({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.getByIdOrSlug(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (collection) {
      form.reset({
        name: collection.name,
        slug: collection.slug || '',
        description: collection.description || '',
        image_url: collection.image_url || '',
        is_active: collection.is_active,
        display_order: collection.display_order || 0,
      });
      if (collection.image_url) {
        setImageUrl(collection.image_url);
      }
    }
  }, [collection, form]);

  const createMutation = useMutation({
    mutationFn: (data: CollectionFormValues) => collectionsApi.create(data as import('@/api/collections').CreateCollectionInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection created successfully');
      navigate('/inventory/collections');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create collection');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CollectionFormValues) => collectionsApi.update(id!, data as import('@/api/collections').CreateCollectionInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      toast.success('Collection updated successfully');
      navigate('/inventory/collections');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update collection');
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const onSubmit = async (data: CollectionFormValues) => {
    // Auto-generate slug if not provided
    if (!data.slug && data.name) {
      data.slug = generateSlug(data.name);
    }

    const payload = data as import('@/api/collections').CreateCollectionInput;

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
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
          onClick={() => navigate('/inventory/collections')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Collection' : 'Create Collection'}
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
                    <FormLabel>Collection Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Summer Sale"
                        {...field}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name of the collection
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
                        placeholder="summer-sale"
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Short description of this collection..."
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value || null);
                        }}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banner / Image</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collection Image</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value || ''}
                        onChange={(url) => {
                          setImageUrl(url || '');
                          field.onChange(url || null);
                        }}
                        onFileSelect={async (file) => {
                          try {
                            setIsUploading(true);
                            // Utilizing generic upload for collections for now
                            const uploadedUrl = await uploadsService.uploadImage(file, 'collections');
                            
                            setImageUrl(uploadedUrl);
                            field.onChange(uploadedUrl);
                            toast.success('Image uploaded successfully');
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to upload image');
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                        disabled={isUploading}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload the collection banner or display image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status & Sorting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive collections won't be shown to end users
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
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Used to sort collections (lower numbers appear first)
                    </FormDescription>
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
              onClick={() => navigate('/inventory/collections')}
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
                ? 'Update Collection'
                : 'Create Collection'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
