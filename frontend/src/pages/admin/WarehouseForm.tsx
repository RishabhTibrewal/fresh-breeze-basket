import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehousesService, Warehouse } from '@/api/warehouses';
import { adminService, UserProfile } from '@/api/admin';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required'),
  code: z.string().min(1, 'Warehouse code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  warehouse_manager_ids: z.array(z.string().optional()).default(['']),
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;

interface WarehouseFormProps {
  warehouse?: Warehouse;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function WarehouseForm({ warehouse, onSuccess, onCancel }: WarehouseFormProps) {
  const [managerPopoverOpen, setManagerPopoverOpen] = useState<{ [key: number]: boolean }>({});
  
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      is_active: true,
      warehouse_manager_ids: [''],
    },
  });

  // Fetch all users to select warehouse managers from
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => adminService.getUsers(1, 1000), // Get all users
  });

  // Fetch existing warehouse managers if editing
  const { data: existingManagers } = useQuery({
    queryKey: ['warehouse-managers', warehouse?.id],
    queryFn: async () => {
      const { warehouseManagersService } = await import('@/api/warehouseManagers');
      return warehouseManagersService.getByWarehouse(warehouse!.id);
    },
    enabled: !!warehouse?.id,
  });

  useEffect(() => {
    if (warehouse) {
      form.reset({
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address ?? '',
        city: warehouse.city ?? '',
        state: warehouse.state ?? '',
        country: warehouse.country ?? '',
        postal_code: warehouse.postal_code ?? '',
        contact_name: warehouse.contact_name ?? '',
        contact_phone: warehouse.contact_phone ?? '',
        contact_email: warehouse.contact_email ?? '',
        is_active: warehouse.is_active ?? true,
        warehouse_manager_ids: [''],
      });
    }
  }, [warehouse, form]);

  // Set existing managers when editing
  useEffect(() => {
    if (warehouse && existingManagers && existingManagers.length > 0) {
      const managerIds = existingManagers.map(m => m.user_id);
      form.setValue('warehouse_manager_ids', managerIds);
    } else if (warehouse && (!existingManagers || existingManagers.length === 0)) {
      form.setValue('warehouse_manager_ids', ['']);
    }
  }, [warehouse, existingManagers, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WarehouseFormValues) => {
      const { warehouse_manager_ids, ...warehouseData } = data;
      const createdWarehouse = await warehousesService.create(warehouseData as any);
      
      // Assign warehouse managers if any selected (filter out empty strings)
      const validManagerIds = warehouse_manager_ids?.filter(id => id && id.trim() !== '') || [];
      if (validManagerIds.length > 0) {
        const { warehouseManagersService } = await import('@/api/warehouseManagers');
        await Promise.all(
          validManagerIds.map(userId =>
            warehouseManagersService.assign({
              user_id: userId,
              warehouse_id: createdWarehouse.id,
            })
          )
        );
      }
      
      return createdWarehouse;
    },
    onSuccess: () => {
      toast.success('Warehouse created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create warehouse');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WarehouseFormValues) => {
      const { warehouse_manager_ids, ...warehouseData } = data;
      await warehousesService.update(warehouse!.id, warehouseData);
      
      // Update warehouse manager assignments
      if (warehouse_manager_ids !== undefined) {
        // Get current assignments
        const currentManagers = existingManagers || [];
        const currentManagerIds = currentManagers.map(m => m.user_id);
        
        // Filter out empty strings from selected managers
        const validManagerIds = warehouse_manager_ids.filter(id => id && id.trim() !== '');
        
        // Find managers to add and remove
        const toAdd = validManagerIds.filter(id => !currentManagerIds.includes(id));
        const toRemove = currentManagerIds.filter(id => !validManagerIds.includes(id));
        
        // Dynamically import warehouse managers service
        const { warehouseManagersService } = await import('@/api/warehouseManagers');
        
        // Add new managers
        await Promise.all(
          toAdd.map(userId =>
            warehouseManagersService.assign({
              user_id: userId,
              warehouse_id: warehouse!.id,
            })
          )
        );
        
        // Remove managers
        await Promise.all(
          toRemove.map(userId =>
            warehouseManagersService.remove(userId, warehouse!.id)
          )
        );
      }
      
      return warehouse;
    },
    onSuccess: () => {
      toast.success('Warehouse updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update warehouse');
    },
  });

  const onSubmit = (values: WarehouseFormValues) => {
    if (warehouse) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Main Warehouse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse Code *</FormLabel>
                <FormControl>
                  <Input placeholder="WH-001" {...field} />
                </FormControl>
                <FormDescription>
                  Unique code for this warehouse
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="Street address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State/Province</FormLabel>
                <FormControl>
                  <Input placeholder="State" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input placeholder="Country" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="12345" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contact@warehouse.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="warehouse_manager_ids"
          render={({ field }) => {
            const managerIds = field.value || [''];
            const allUsers = usersData?.data?.users || [];
            // Filter users who have warehouse_manager role or admin role (admins can also manage warehouses)
            const availableManagers = allUsers.filter((user: UserProfile) => {
              const userRoles = user.roles || (user.role ? [user.role] : []);
              return userRoles.includes('warehouse_manager') || userRoles.includes('admin');
            });

            const addManagerDropdown = () => {
              field.onChange([...managerIds, '']);
            };

            const removeManagerDropdown = (index: number) => {
              const newIds = managerIds.filter((_, i) => i !== index);
              // Ensure at least one empty dropdown remains
              if (newIds.length === 0) {
                field.onChange(['']);
              } else {
                field.onChange(newIds);
              }
            };

            const updateManagerSelection = (index: number, userId: string) => {
              const newIds = [...managerIds];
              newIds[index] = userId;
              field.onChange(newIds);
            };

            const getSelectedManager = (userId: string | undefined) => {
              if (!userId) return null;
              return availableManagers.find((user: UserProfile) => user.id === userId);
            };

            return (
              <FormItem className="flex flex-col">
                <FormLabel>Warehouse Managers</FormLabel>
                <div className="space-y-3">
                  {managerIds.map((managerId, index) => {
                    const selectedManager = getSelectedManager(managerId);

                    return (
                      <div key={index} className="flex gap-2 items-start">
                        <FormControl>
                          <Select
                            value={managerId || ''}
                            onValueChange={(value) => {
                              updateManagerSelection(index, value);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select warehouse manager..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableManagers.map((user: UserProfile) => {
                                const displayName = user.first_name || user.last_name
                                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                  : user.email;
                                
                                return (
                                  <SelectItem key={user.id} value={user.id}>
                                    <div className="flex flex-col">
                                      <span>{displayName}</span>
                                      <span className="text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        {managerIds.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeManagerDropdown(index)}
                            className="shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addManagerDropdown}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Warehouse Manager
                  </Button>
                </div>
                <FormDescription>
                  Click the "+" button to add more warehouse managers
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Active</FormLabel>
                <FormDescription>
                  Only active warehouses can be used for orders
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : warehouse ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
