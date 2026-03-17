import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { categoriesService } from '@/api/categories';
import type { Category, CreateCategoryData } from '@/api/categories';
import { uploadsService } from '@/api/uploads';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters'),
  description: z.string().optional(),
  image_url: z.string().optional(),
  parent_id: z.string().nullable().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const CategoryList = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getAll(),
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      image_url: '',
      parent_id: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      const category = await categoriesService.create(data);
      if (imageFile && category.id) {
        setIsUploading(true);
        try {
          const uploadResult = await uploadsService.uploadCategoryImage(category.id, imageFile);
          await categoriesService.update(category.id, { image_url: uploadResult.url });
        } catch {
          toast({ title: 'Warning', description: 'Category created but image upload failed', variant: 'destructive' });
        } finally {
          setIsUploading(false);
        }
      }
      return category;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      const label = vars.parent_id ? 'Subcategory' : 'Category';
      toast({ title: 'Success', description: `${label} created successfully` });
      handleClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create category. Please try again.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateCategoryData }) => {
      const category = await categoriesService.update(id, data);
      if (imageFile) {
        setIsUploading(true);
        try {
          const uploadResult = await uploadsService.uploadCategoryImage(id, imageFile);
          await categoriesService.update(id, { image_url: uploadResult.url });
        } catch {
          toast({ title: 'Warning', description: 'Category updated but image upload failed', variant: 'destructive' });
        } finally {
          setIsUploading(false);
        }
      }
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Success', description: 'Category updated successfully' });
      handleClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update category. Please try again.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Success', description: 'Category deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete category. Please try again.', variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingCategory(null);
    setDefaultParentId(null);
    form.reset({ name: '', slug: '', description: '', image_url: '', parent_id: null });
    setImageFile(null);
  };

  const handleOpenForNew = (parentId: string | null = null) => {
    setEditingCategory(null);
    setDefaultParentId(parentId);
    form.reset({ name: '', slug: '', description: '', image_url: '', parent_id: parentId });
    setIsOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setDefaultParentId(null);
    form.reset({
      name: category.name,
      slug: category.slug ?? '',
      description: category.description || '',
      image_url: category.image_url || '',
      parent_id: category.parent_id ?? null,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this category? Subcategories will become top-level categories.')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onSubmit = async (data: CategoryFormData) => {
    const payload: CreateCategoryData = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      image_url: editingCategory?.image_url || '',
      parent_id: data.parent_id || null,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Top-level categories for the parent selector in the form
  const topLevelCategories = categories?.filter(c => !c.parent_id) ?? [];

  // Determine dialog title
  const watchedParentId = form.watch('parent_id');
  const isSubcategoryForm = !!(watchedParentId || defaultParentId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your product categories and subcategories</p>
        </div>
        <Button onClick={() => handleOpenForNew(null)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? `Edit ${editingCategory.parent_id ? 'Subcategory' : 'Category'}`
                : isSubcategoryForm
                  ? 'Add New Subcategory'
                  : 'Add New Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Edit the details below.'
                : isSubcategoryForm
                  ? 'Fill in the details for the new subcategory.'
                  : 'Fill in the details for your new category.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Parent Category — shown when creating, locked when editing a subcategory */}
              {!editingCategory && (
                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Category <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <Select
                        value={field.value ?? '__none__'}
                        onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="None — top-level category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None — top-level category</SelectItem>
                          {topLevelCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={isSubcategoryForm ? 'e.g. Mangoes' : 'e.g. Fresh Fruits'}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!editingCategory && !form.getValues('slug')) {
                            form.setValue('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                          }
                        }}
                      />
                    </FormControl>
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
                      <Input placeholder="e.g. fresh-fruits" {...field} />
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
                    <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              field.onChange(URL.createObjectURL(file));
                            }
                          }}
                        />
                        {(field.value || editingCategory?.image_url) && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden border">
                            <img
                              src={field.value || editingCategory?.image_url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                >
                  {(createMutation.isPending || updateMutation.isPending || isUploading) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {isUploading ? 'Uploading...' : editingCategory ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.filter(c => !c.parent_id).map((category) => {
                const subcats = category.subcategories ?? [];
                const isExpanded = expandedCategories.has(category.id);

                return (
                  <React.Fragment key={category.id}>
                    {/* Parent Row */}
                    <TableRow className="bg-muted/20">
                      <TableCell>
                        {category.image_url ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden">
                            <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FolderTree className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {subcats.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(category.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                          <span className="font-semibold">{category.name}</span>
                          {subcats.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{subcats.length} sub</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{category.slug}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{category.description || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="mr-1 text-xs h-7" onClick={() => handleOpenForNew(category.id)}>
                          <Plus className="w-3 h-3 mr-1" /> Add Sub
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(category)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(category.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Subcategory Rows */}
                    {isExpanded && subcats.map((sub) => (
                      <TableRow key={sub.id} className="bg-background">
                        <TableCell className="pl-6">
                          {sub.image_url ? (
                            <div className="w-8 h-8 rounded overflow-hidden">
                              <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                              <FolderTree className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 pl-6">
                            <span className="text-muted-foreground text-sm">↳</span>
                            <span className="text-sm">{sub.name}</span>
                            <Badge variant="outline" className="text-xs">Subcategory</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.slug}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.description || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(sub)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(sub.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              {(!categories || categories.filter(c => !c.parent_id).length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No categories yet. Click "Add Category" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CategoryList;