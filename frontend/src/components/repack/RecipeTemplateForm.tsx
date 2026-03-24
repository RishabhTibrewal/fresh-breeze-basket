import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Trash2, Plus, ArrowRight, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { repackService, CreateRecipeTemplatePayload } from '@/api/repackService';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';

const recipeFormSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  recipe_type: z.enum(['one_to_one', 'many_to_one', 'one_to_many', 'many_to_many']),
  notes: z.string().optional(),
  inputs: z.array(z.object({
    product_id: z.string().min(1, "Product required"),
    variant_id: z.string().min(1, "Variant required"),
    quantity_per_batch: z.coerce.number().min(0.001, "Must be > 0"),
    wastage_per_unit: z.coerce.number().min(0, "Cannot be negative"),
    notes: z.string().optional()
  })).min(1, "At least one input required"),
  outputs: z.array(z.object({
    product_id: z.string().min(1, "Product required"),
    variant_id: z.string().min(1, "Variant required"),
    quantity_per_batch: z.coerce.number().min(0.001, "Must be > 0"),
    additional_cost_per_unit: z.coerce.number().min(0, "Cannot be negative"),
    notes: z.string().optional()
  })).min(1, "At least one output required"),
});

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

export default function RecipeTemplateForm() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      name: '',
      recipe_type: 'one_to_one',
      notes: '',
      inputs: [{ product_id: '', variant_id: '', quantity_per_batch: 1, wastage_per_unit: 0 }],
      outputs: [{ product_id: '', variant_id: '', quantity_per_batch: 1, additional_cost_per_unit: 0 }],
    }
  });

  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: ['repack-template', id],
    queryFn: () => repackService.getRecipeTemplateById(id!),
    enabled: isEditMode,
  });

  React.useEffect(() => {
    if (existingTemplate) {
      form.reset({
        name: existingTemplate.name,
        recipe_type: existingTemplate.recipe_type as "one_to_one" | "many_to_one" | "one_to_many" | "many_to_many",
        notes: existingTemplate.notes || '',
        inputs: existingTemplate.inputs.length > 0 ? existingTemplate.inputs.map((i: any) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity_per_batch: i.quantity_per_batch,
          wastage_per_unit: i.wastage_per_unit,
          notes: i.notes || ''
        })) : [{ product_id: '', variant_id: '', quantity_per_batch: 1, wastage_per_unit: 0 }],
        outputs: existingTemplate.outputs.length > 0 ? existingTemplate.outputs.map((o: any) => ({
          product_id: o.product_id,
          variant_id: o.variant_id,
          quantity_per_batch: o.quantity_per_batch,
          additional_cost_per_unit: o.additional_cost_per_unit,
          notes: o.notes || ''
        })) : [{ product_id: '', variant_id: '', quantity_per_batch: 1, additional_cost_per_unit: 0 }],
      });
    }
  }, [existingTemplate, form]);

  const { fields: inputFields, append: appendInput, remove: removeInput } = useFieldArray({
    name: "inputs",
    control: form.control,
  });

  const { fields: outputFields, append: appendOutput, remove: removeOutput } = useFieldArray({
    name: "outputs",
    control: form.control,
  });

  async function onSubmit(data: RecipeFormValues) {
    try {
      setIsSubmitting(true);
      if (isEditMode && id) {
        await repackService.updateRecipeTemplate(id, data as CreateRecipeTemplatePayload);
        toast.success("Recipe template updated successfully");
      } else {
        await repackService.createRecipeTemplate(data as CreateRecipeTemplatePayload);
        toast.success("Recipe template created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ['repack-templates'] });
      navigate('/inventory/packaging-recipes'); // Redirect to existing recipes view
    } catch (error: any) {
      toast.error(error.message || "Failed to save recipe template");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Edit' : 'New'} Recipe Template</h1>
          <p className="text-muted-foreground mt-1">Design a transformation recipe for repack operations</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle>Basic details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                control={form.control} 
                name="name" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipe Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Bulk Almonds to 500g pouches" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              
              <FormField 
                control={form.control} 
                name="recipe_type" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one_to_one">One-to-One (1:1)</SelectItem>
                        <SelectItem value="many_to_one">Many-to-One (M:1)</SelectItem>
                        <SelectItem value="one_to_many">One-to-Many (1:M)</SelectItem>
                        <SelectItem value="many_to_many">Many-to-Many (M:M)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
              )} />

              <FormField 
                control={form.control} 
                name="notes" 
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Internal notes or instructions" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INPUTS PANEL */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  Inputs — What goes in
                </CardTitle>
                <CardDescription>Raw materials consumed per batch</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {inputFields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-12 gap-3 p-4 border rounded-lg bg-card shadow-sm">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeInput(index)}
                      className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    
                    <div className="col-span-12">
                      <FormItem>
                        <FormLabel>Product / Variant</FormLabel>
                        <ProductVariantCombobox
                          selectedProductId={form.watch(`inputs.${index}.product_id`)}
                          selectedVariantId={form.watch(`inputs.${index}.variant_id`)}
                          onSelect={(pId, vId) => {
                            form.setValue(`inputs.${index}.product_id`, pId);
                            form.setValue(`inputs.${index}.variant_id`, vId);
                          }}
                        />
                        {form.formState.errors.inputs?.[index]?.product_id && (
                          <p className="text-sm text-destructive mt-1">Please select a product variant</p>
                        )}
                      </FormItem>
                    </div>

                    <div className="col-span-6">
                      <FormField
                        control={form.control}
                        name={`inputs.${index}.quantity_per_batch`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Qty / Batch</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" className="font-mono" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="col-span-6">
                      <FormField
                        control={form.control}
                        name={`inputs.${index}.wastage_per_unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Est. Wastage</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" className="font-mono text-amber-600" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-dashed" 
                  onClick={() => appendInput({ product_id: '', variant_id: '', quantity_per_batch: 1, wastage_per_unit: 0 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Input
                </Button>
              </CardContent>
            </Card>

            {/* OUTPUTS PANEL */}
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-emerald-500" />
                  Outputs — What comes out
                </CardTitle>
                <CardDescription>Finished goods produced per batch</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {outputFields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-12 gap-3 p-4 border rounded-lg bg-card shadow-sm">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeOutput(index)}
                      className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    
                    <div className="col-span-12">
                      <FormItem>
                        <FormLabel>Product / Variant</FormLabel>
                        <ProductVariantCombobox
                          selectedProductId={form.watch(`outputs.${index}.product_id`)}
                          selectedVariantId={form.watch(`outputs.${index}.variant_id`)}
                          onSelect={(pId, vId) => {
                            form.setValue(`outputs.${index}.product_id`, pId);
                            form.setValue(`outputs.${index}.variant_id`, vId);
                          }}
                        />
                        {form.formState.errors.outputs?.[index]?.product_id && (
                          <p className="text-sm text-destructive mt-1">Please select a product variant</p>
                        )}
                      </FormItem>
                    </div>

                    <div className="col-span-6">
                      <FormField
                        control={form.control}
                        name={`outputs.${index}.quantity_per_batch`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Yield / Batch</FormLabel>
                            <FormControl>
                              <Input type="number" step="1" className="font-mono text-emerald-600" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="col-span-6">
                      <FormField
                        control={form.control}
                        name={`outputs.${index}.additional_cost_per_unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Addl. Cost (₹)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" className="font-mono" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-dashed" 
                  onClick={() => appendOutput({ product_id: '', variant_id: '', quantity_per_batch: 1, additional_cost_per_unit: 0 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Output
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button type="button" variant="outline" className="mr-4" onClick={() => navigate('/inventory/packaging-recipes')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Template</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
