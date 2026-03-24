import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Trash2, Plus, ArrowRight, Save, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { repackService, CreateRepackOrderPayload } from '@/api/repackService';
import { warehousesService } from '@/api/warehouses';
import { ProductVariantCombobox } from '@/components/products/ProductVariantCombobox';
import { WarehouseCombobox } from '@/components/warehouses/WarehouseCombobox';

const repackOrderSchema = z.object({
  warehouse_id: z.string().min(1, "Warehouse is required"),
  recipe_template_id: z.string().optional(),
  notes: z.string().optional(),
  inputs: z.array(z.object({
    product_id: z.string().min(1, "Product required"),
    variant_id: z.string().min(1, "Variant required"),
    input_quantity: z.coerce.number().min(0.001, "Must be > 0"),
    wastage_quantity: z.coerce.number().min(0, "Cannot be negative"),
  })).min(1, "At least one input required"),
  outputs: z.array(z.object({
    product_id: z.string().min(1, "Product required"),
    variant_id: z.string().min(1, "Variant required"),
    output_quantity: z.coerce.number().min(1, "Must be at least 1"),
    unit_cost: z.coerce.number().default(0), // Automatically calculated by backend
    additional_cost_per_unit: z.coerce.number().min(0, "Cannot be negative"),
  })).min(1, "At least one output required"),
});

type RepackFormValues = z.infer<typeof repackOrderSchema>;

export default function RepackOrderCreate() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch templates for quick-load
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['repack-templates'],
    queryFn: () => repackService.getRecipeTemplates(),
  });

  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
  });

  const form = useForm<RepackFormValues>({
    resolver: zodResolver(repackOrderSchema),
    defaultValues: {
      warehouse_id: '',
      recipe_template_id: '',
      notes: '',
      inputs: [],
      outputs: [],
    }
  });

  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['repack-order', id],
    queryFn: () => repackService.getRepackOrderById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingOrder) {
      form.reset({
        warehouse_id: existingOrder.warehouse_id,
        recipe_template_id: existingOrder.recipe_template_id || '',
        notes: existingOrder.notes || '',
        inputs: existingOrder.inputs.length > 0 ? existingOrder.inputs.map((i: any) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          input_quantity: i.input_quantity,
          wastage_quantity: i.wastage_quantity,
        })) : [],
        outputs: existingOrder.outputs.length > 0 ? existingOrder.outputs.map((o: any) => ({
          product_id: o.product_id,
          variant_id: o.variant_id,
          output_quantity: o.output_quantity,
          unit_cost: o.unit_cost || 0,
          additional_cost_per_unit: o.additional_cost_per_unit,
        })) : [],
      });
    }
  }, [existingOrder, form]);

  const { fields: inputFields, append: appendInput, remove: removeInput, replace: replaceInputs } = useFieldArray({
    name: "inputs",
    control: form.control,
  });

  const { fields: outputFields, append: appendOutput, remove: removeOutput, replace: replaceOutputs } = useFieldArray({
    name: "outputs",
    control: form.control,
  });

  // Watch for template selection to auto-fill
  const selectedTemplateId = form.watch('recipe_template_id');
  useEffect(() => {
    if (selectedTemplateId && !existingOrder) {
      const template = templates.find(t => t.id === selectedTemplateId) as any;
      if (template) {
        // Hydrate form with template structure
        replaceInputs((template.inputs || []).map((i: any) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          input_quantity: i.quantity_per_batch,
          wastage_quantity: i.wastage_per_unit
        })));
        replaceOutputs((template.outputs || []).map((o: any) => ({
          product_id: o.product_id,
          variant_id: o.variant_id,
          output_quantity: Math.floor(o.quantity_per_batch), // Must be integer per schema
          unit_cost: 0,
          additional_cost_per_unit: o.additional_cost_per_unit
        })));
        toast.info(`Loaded template: ${template.name}`);
      }
    }
  }, [selectedTemplateId, templates, replaceInputs, replaceOutputs, existingOrder]);

  async function onSubmit(data: RepackFormValues) {
    try {
      setIsSubmitting(true);
      // Create or update the order (default status is draft)
      if (isEditMode && id) {
        await repackService.updateRepackOrder(id, data as CreateRepackOrderPayload);
        toast.success("Repack order updated as Draft!");
      } else {
        await repackService.createRepackOrder(data as CreateRepackOrderPayload);
        toast.success("Repack order saved as Draft!");
      }
      
      queryClient.invalidateQueries({ queryKey: ['repack-orders-v3'] });
      navigate('/inventory/repack-orders');
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Edit Draft Order' : 'Execute Repack'}</h1>
          <p className="text-muted-foreground mt-1">Convert raw materials into finished goods</p>
        </div>
      </div>



      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* SECTION 1: Source & Template */}
            <Card className="animate-in fade-in">
              <CardHeader>
                <CardTitle>Source & Template</CardTitle>
                <CardDescription>Select where this is happening and optionally load a pre-configured template</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField 
                  control={form.control} 
                  name="warehouse_id" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Executing Warehouse</FormLabel>
                      <WarehouseCombobox
                        warehouses={warehouses}
                        selectedWarehouseId={field.value}
                        onSelect={(id) => form.setValue('warehouse_id', id)}
                      />
                      <FormMessage />
                    </FormItem>
                )} />
                
                <FormField 
                  control={form.control} 
                  name="recipe_template_id" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Template (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No template (Manual Entry)</SelectItem>
                          {templates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.recipe_type.replace(/_/g, ' ')})</SelectItem>
                          ))}
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
                      <FormLabel>Execution Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Batch numbers, shift details, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )} />
              </CardContent>
            </Card>

          {/* SECTION 2: Inputs */}
            <Card className="animate-in fade-in border-l-4 border-l-blue-500">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  Inputs Consumed
                </CardTitle>
                <CardDescription>Specify exactly what raw materials were used during this batch</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {import.meta.env.DEV && inputFields.length === 0 && (
                   <p className="text-sm text-muted-foreground text-center py-4">No inputs added yet.</p>
                )}
                {inputFields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-12 gap-3 p-4 border rounded-lg bg-card shadow-sm">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeInput(index)}
                      className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-destructive text-destructive-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    
                    <div className="col-span-12">
                      <FormItem>
                        <FormLabel>Raw Material / Component</FormLabel>
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
                        name={`inputs.${index}.input_quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Consumed Qty</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" className="font-mono text-blue-600" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="col-span-6">
                      <FormField
                        control={form.control}
                        name={`inputs.${index}.wastage_quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Actual Wastage</FormLabel>
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
                  onClick={() => appendInput({ product_id: '', variant_id: '', input_quantity: 1, wastage_quantity: 0 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Material
                </Button>
              </CardContent>
            </Card>

          {/* SECTION 3: Outputs */}
            <Card className="animate-in fade-in border-l-4 border-l-emerald-500">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-emerald-500" />
                  Outputs Produced
                </CardTitle>
                <CardDescription>Specify the finished goods yielded from this batch</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {outputFields.length === 0 && (
                   <p className="text-sm text-muted-foreground text-center py-4">No outputs added yet.</p>
                )}
                {outputFields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-12 gap-3 p-4 border rounded-lg bg-card shadow-sm">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeOutput(index)}
                      className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-destructive text-destructive-foreground shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    
                    <div className="col-span-12">
                      <FormItem>
                        <FormLabel>Finished Good</FormLabel>
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
                        name={`outputs.${index}.output_quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Yield Qty (Units)</FormLabel>
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
                            <FormLabel className="text-xs">Addl. Labor/Pkg Cost (₹)</FormLabel>
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
                  onClick={() => appendOutput({ product_id: '', variant_id: '', output_quantity: 1, unit_cost: 0, additional_cost_per_unit: 0 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Finished Good
                </Button>
              </CardContent>
            </Card>

          <div className="flex justify-between pt-4 border-t mt-8">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/inventory/repack-orders')}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? "Saving..." : 
               <><Save className="w-4 h-4 mr-2" /> Save as Draft</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
