import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2, Save, ListChecks } from 'lucide-react';
import { modifiersService, ModifierGroup, Modifier } from '@/api/modifiers';
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
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const modifierGroupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional().nullable(),
  min_select: z.number().min(0, 'Minimum selection cannot be negative'),
  max_select: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
});

type ModifierGroupFormValues = z.infer<typeof modifierGroupSchema>;

export default function ModifierForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEditMode = Boolean(id);
  
  // State for adding a new modifier item
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(0);

  const form = useForm<ModifierGroupFormValues>({
    resolver: zodResolver(modifierGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      min_select: 0,
      max_select: null,
      is_active: true,
    },
  });

  const { data: modifierGroup, isLoading: isLoadingGroup } = useQuery<ModifierGroup>({
    queryKey: ['modifierGroup', id],
    queryFn: async () => {
      // Find the group from the list, since there's no specific getById endpoint
      const groups = await modifiersService.getModifierGroups();
      const group = groups.find(g => g.id === id);
      if (!group) throw new Error("Modifier Group not found");
      return group;
    },
    enabled: isEditMode,
  });

  const { data: modifierItems, isLoading: isLoadingItems } = useQuery<Modifier[]>({
    queryKey: ['modifierItems', id],
    queryFn: () => modifiersService.getModifiersByGroup(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (modifierGroup) {
      form.reset({
        name: modifierGroup.name,
        description: modifierGroup.description || '',
        min_select: modifierGroup.min_select,
        max_select: modifierGroup.max_select,
        is_active: modifierGroup.is_active,
      });
    }
  }, [modifierGroup, form]);

  const createGroupMutation = useMutation({
    mutationFn: (data: ModifierGroupFormValues) => modifiersService.createModifierGroup(data as import('@/api/modifiers').CreateModifierGroupInput),
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['modifierGroups'] });
      toast.success('Modifier group created successfully');
      // Redirect to edit mode to allow adding items
      navigate(`/inventory/modifiers/${newGroup.id}/edit`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create modifier group');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (data: ModifierGroupFormValues) => modifiersService.updateModifierGroup(id!, data as import('@/api/modifiers').CreateModifierGroupInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifierGroups'] });
      queryClient.invalidateQueries({ queryKey: ['modifierGroup', id] });
      toast.success('Modifier group updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update modifier group');
    },
  });

  // --- Item Mutations ---
  const addItemMutation = useMutation({
    mutationFn: () => modifiersService.createModifier({
      modifier_group_id: id!,
      name: newItemName,
      price_adjust: newItemPrice,
      is_active: true,
      display_order: (modifierItems?.length || 0) + 1
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifierItems', id] });
      toast.success('Modifier item added');
      setNewItemName('');
      setNewItemPrice(0);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add item');
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string, data: any }) => 
      modifiersService.updateModifier(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifierItems', id] });
      toast.success('Item updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update item');
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => modifiersService.deleteModifier(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifierItems', id] });
      toast.success('Item deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete item');
    }
  });

  const onSubmit = async (data: ModifierGroupFormValues) => {
    if (isEditMode) {
      updateGroupMutation.mutate(data);
    } else {
      createGroupMutation.mutate(data);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addItemMutation.mutate();
  };

  const toggleItemStatus = (itemId: string, currentStatus: boolean) => {
    updateItemMutation.mutate({ itemId, data: { is_active: !currentStatus } });
  };

  if (isEditMode && (isLoadingGroup || isLoadingItems)) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/inventory/modifiers')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Modifiers
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Modifier Group' : 'Create Modifier Group'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode ? 'Update group rules and manage its items.' : 'First create the group, then you can add specific items to it.'}
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Group Settings */}
        <div className="lg:col-span-5 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Group Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Select Size" {...field} />
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
                            placeholder="Optional instructions for customers..." 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="min_select"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Selections *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            0 for optional, 1 for mandatory
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_select"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Selections</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              placeholder="Unlimited"
                              value={field.value || ''} 
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val ? parseInt(val) : null);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Leave empty for no limit
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          <FormDescription>
                            Enable or disable this entire group
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                  >
                    {createGroupMutation.isPending || updateGroupMutation.isPending ? (
                      'Saving...'
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save Group Settings</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        {/* Right Column: Modifier Items (Only in Edit Mode) */}
        <div className="lg:col-span-7">
          {isEditMode ? (
            <Card>
              <CardHeader>
                <CardTitle>Modifier Items</CardTitle>
                <CardDescription>Add the specific choices available in this group.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add Item Form */}
                <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3 mb-6 items-end bg-muted/50 p-4 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Item Name *</label>
                    <Input 
                      placeholder="e.g., Large" 
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-full sm:w-32 space-y-2">
                    <label className="text-sm font-medium">Extra Cost</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00"
                      value={newItemPrice === 0 ? '' : newItemPrice}
                      onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={!newItemName.trim() || addItemMutation.isPending}
                    className="w-full sm:w-auto shrink-0"
                  >
                    {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
                  </Button>
                </form>

                {/* Items Table */}
                {modifierItems && modifierItems.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">Price Adj.</TableHead>
                          <TableHead className="text-center">Active</TableHead>
                          <TableHead className="text-right w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modifierItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">
                              {item.price_adjust > 0 ? `+${item.price_adjust}` : item.price_adjust < 0 ? item.price_adjust : '--'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch 
                                checked={item.is_active}
                                onCheckedChange={() => toggleItemStatus(item.id, item.is_active)}
                                disabled={updateItemMutation.isPending}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                                    deleteItemMutation.mutate(item.id);
                                  }
                                }}
                                disabled={deleteItemMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                    No items added yet. Use the form above to add items like "Extra Cheese" or "Large Size".
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center bg-muted/30 border-dashed">
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <ListChecks className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-lg mb-2">Save group to add items</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  You must save the core settings for this modifier group before you can add the specific choices and pricing.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
