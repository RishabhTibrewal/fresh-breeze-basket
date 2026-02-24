import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { taxesService, Tax, CreateTaxInput } from '@/api/taxes';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const taxSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(1, 'Code is required'),
  rate: z.number().min(0, 'Rate must be >= 0').max(100, 'Rate must be <= 100'),
  is_active: z.boolean().default(true),
});

type TaxFormValues = z.infer<typeof taxSchema>;

export default function TaxForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditMode = Boolean(id);

  const form = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      name: '',
      code: '',
      rate: 0,
      is_active: true,
    },
  });

  const { data: tax, isLoading } = useQuery<Tax>({
    queryKey: ['tax', id],
    queryFn: () => taxesService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (tax) {
      form.reset({
        name: tax.name,
        code: tax.code,
        rate: tax.rate,
        is_active: tax.is_active,
      });
    }
  }, [tax, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreateTaxInput) => taxesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      toast.success('Tax created successfully');
      navigate('/admin/taxes');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create tax';
      if (error.response?.status === 409) {
        toast.error(errorMessage || 'A tax with this code already exists for your company');
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateTaxInput>) => taxesService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      queryClient.invalidateQueries({ queryKey: ['tax', id] });
      toast.success('Tax updated successfully');
      navigate('/admin/taxes');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to update tax';
      if (error.response?.status === 409) {
        toast.error(errorMessage || 'A tax with this code already exists for your company');
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const onSubmit = async (data: TaxFormValues) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      // Ensure required fields are present for create
      createMutation.mutate({
        name: data.name,
        code: data.code,
        rate: data.rate,
        is_active: data.is_active,
      });
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
          onClick={() => navigate('/admin/taxes')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Taxes
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Tax' : 'Create Tax'}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., GST, VAT, Sales Tax"
                        {...field}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name of the tax
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., GST, VAT, ST"
                        {...field}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique code identifier for this tax
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value}
                        className={isMobile ? 'h-12 text-base' : ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Tax rate as a percentage (e.g., 5 for 5%, 18 for 18%)
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
                        Inactive taxes won't appear in variant selection
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
              onClick={() => navigate('/admin/taxes')}
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
                ? 'Update Tax'
                : 'Create Tax'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

