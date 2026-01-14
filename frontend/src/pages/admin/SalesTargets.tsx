import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Target, Calendar, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { adminService, SalesTarget, CreateSalesTargetData, UpdateSalesTargetData } from '@/api/admin';
import { formatCurrency } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const targetSchema = z.object({
  sales_executive_id: z.string().min(1, 'Sales executive is required'),
  target_amount: z.string().min(1, 'Target amount is required').refine((val) => parseFloat(val) > 0, 'Target amount must be greater than 0'),
  period_type: z.enum(['monthly', 'quarterly', 'yearly'], { required_error: 'Period type is required' }),
  period_start: z.string().min(1, 'Start date is required'),
  period_end: z.string().min(1, 'End date is required'),
  description: z.string().optional(),
}).refine((data) => new Date(data.period_end) > new Date(data.period_start), {
  message: 'End date must be after start date',
  path: ['period_end'],
});

type TargetFormData = z.infer<typeof targetSchema>;

export default function SalesTargets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null);
  const queryClient = useQueryClient();

  // Fetch sales executives directly by role
  const { data: salesExecutivesData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['sales-executives'],
    queryFn: async () => {
      const response = await adminService.getSalesExecutives();
      return response;
    },
  });

  const salesExecutives = salesExecutivesData?.data || [];

  // Fetch sales targets
  const { data: targetsData, isLoading, error } = useQuery({
    queryKey: ['sales-targets'],
    queryFn: async () => {
      try {
        const response = await adminService.getSalesTargets();
        return response;
      } catch (err: any) {
        console.error('Error fetching sales targets:', err);
        // Don't throw - return empty data so UI can still render
        return { success: false, data: [] };
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 429 (rate limit) errors
      if (error?.response?.status === 429) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Extract targets array - handle both direct array and wrapped response
  const targets = React.useMemo(() => {
    if (!targetsData) {
      return [];
    }
    
    // If targetsData is already an array
    if (Array.isArray(targetsData)) {
      return targetsData;
    }
    
    // If targetsData has a data property
    if (targetsData.data && Array.isArray(targetsData.data)) {
      return targetsData.data;
    }
    
    return [];
  }, [targetsData]);
  

  const form = useForm<TargetFormData>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      sales_executive_id: '',
      target_amount: '',
      period_type: 'monthly',
      period_start: '',
      period_end: '',
      description: '',
    },
  });

  // Create target mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSalesTargetData) => adminService.createSalesTarget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      setIsDialogOpen(false);
      form.reset();
      toast.success('Sales target created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create sales target');
    },
  });

  // Update target mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalesTargetData }) =>
      adminService.updateSalesTarget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      setIsDialogOpen(false);
      setEditingTarget(null);
      form.reset();
      toast.success('Sales target updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update sales target');
    },
  });

  // Delete target mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteSalesTarget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      toast.success('Sales target deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete sales target');
    },
  });

  const handleOpenDialog = (target?: SalesTarget) => {
    if (target) {
      setEditingTarget(target);
      form.reset({
        sales_executive_id: target.sales_executive_id,
        target_amount: target.target_amount.toString(),
        period_type: target.period_type,
        period_start: target.period_start,
        period_end: target.period_end,
        description: target.description || '',
      });
    } else {
      setEditingTarget(null);
      form.reset({
        sales_executive_id: '',
        target_amount: '',
        period_type: 'monthly',
        period_start: '',
        period_end: '',
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTarget(null);
    form.reset();
  };

  const onSubmit = (data: TargetFormData) => {
    const targetData = {
      sales_executive_id: data.sales_executive_id,
      target_amount: parseFloat(data.target_amount),
      period_type: data.period_type,
      period_start: data.period_start,
      period_end: data.period_end,
      description: data.description || undefined,
    };

    if (editingTarget) {
      updateMutation.mutate({ id: editingTarget.id, data: targetData });
    } else {
      createMutation.mutate(targetData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this sales target?')) {
      deleteMutation.mutate(id);
    }
  };

  const getSalesExecutiveName = (sales_executive_id: string) => {
    const executive = salesExecutives.find((u) => u.id === sales_executive_id);
    if (executive) {
      return executive.first_name || executive.last_name
        ? `${executive.first_name || ''} ${executive.last_name || ''}`.trim()
        : executive.email;
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Targets</h1>
          <p className="text-muted-foreground mt-2">
            Set and manage sales goals for sales executives
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Target
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTarget ? 'Edit Sales Target' : 'Create Sales Target'}</DialogTitle>
              <DialogDescription>
                {editingTarget ? 'Update the sales target details' : 'Set a new sales target for a sales executive'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sales_executive_id">Sales Executive *</Label>
                  <Select
                    value={form.watch('sales_executive_id')}
                    onValueChange={(value) => form.setValue('sales_executive_id', value)}
                    disabled={isLoadingUsers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingUsers ? "Loading..." : "Select sales executive"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingUsers ? (
                        <SelectItem value="loading" disabled>Loading sales executives...</SelectItem>
                      ) : salesExecutives.length === 0 ? (
                        <SelectItem value="no-users" disabled>No sales executives found</SelectItem>
                      ) : (
                        salesExecutives.map((executive) => {
                          const displayName = executive.first_name || executive.last_name
                            ? `${executive.first_name || ''} ${executive.last_name || ''}`.trim()
                            : executive.email;
                          return (
                            <SelectItem key={executive.id} value={executive.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.sales_executive_id && (
                    <p className="text-sm text-destructive">{form.formState.errors.sales_executive_id.message}</p>
                  )}
                  {!isLoadingUsers && salesExecutives.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sales executives available. Please create sales executives first.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_amount">Target Amount *</Label>
                  <Input
                    id="target_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('target_amount')}
                  />
                  {form.formState.errors.target_amount && (
                    <p className="text-sm text-destructive">{form.formState.errors.target_amount.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period_type">Period Type *</Label>
                  <Select
                    value={form.watch('period_type')}
                    onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') =>
                      form.setValue('period_type', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.period_type && (
                    <p className="text-sm text-destructive">{form.formState.errors.period_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period_start">Start Date *</Label>
                  <Input
                    id="period_start"
                    type="date"
                    {...form.register('period_start')}
                  />
                  {form.formState.errors.period_start && (
                    <p className="text-sm text-destructive">{form.formState.errors.period_start.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_end">End Date *</Label>
                <Input
                  id="period_end"
                  type="date"
                  {...form.register('period_end')}
                />
                {form.formState.errors.period_end && (
                  <p className="text-sm text-destructive">{form.formState.errors.period_end.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Optional description for this target"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingTarget ? 'Update' : 'Create'} Target
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sales Targets</CardTitle>
          <CardDescription>View and manage sales targets for all sales executives</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading targets...</div>
          ) : targets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sales targets found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales Executive</TableHead>
                  <TableHead>Target Amount</TableHead>
                  <TableHead>Period Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => {
                  // Ensure we have valid numbers, defaulting to 0 if undefined/null
                  // Check if progress fields exist, if not calculate them
                  const achievedAmount = typeof target.achieved_amount === 'number' ? target.achieved_amount : 0;
                  const targetAmount = typeof target.target_amount === 'number' ? target.target_amount : 0;
                  const progressPercentage = typeof target.progress_percentage === 'number' 
                    ? target.progress_percentage 
                    : (targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0);
                  const remainingAmount = typeof target.remaining_amount === 'number' 
                    ? target.remaining_amount 
                    : Math.max(0, targetAmount - achievedAmount);
                  
                  return (
                    <React.Fragment key={target.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          {target.sales_executive
                            ? target.sales_executive.first_name || target.sales_executive.last_name
                              ? `${target.sales_executive.first_name || ''} ${target.sales_executive.last_name || ''}`.trim()
                              : target.sales_executive.email
                            : getSalesExecutiveName(target.sales_executive_id)}
                        </TableCell>
                        <TableCell>{formatCurrency(target.target_amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {target.period_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={target.is_active ? 'default' : 'secondary'}>
                            {target.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(target)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(target.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Progress Bar Row - Always render, matching SalesAnalytics style */}
                      <TableRow className="hover:bg-gray-50">
                        <TableCell colSpan={6} className="bg-gray-50 border-t-2 border-gray-300 p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground font-medium">Progress</span>
                              <span className={`font-semibold ${
                                progressPercentage >= 100 ? 'text-green-600' :
                                progressPercentage >= 75 ? 'text-blue-600' :
                                progressPercentage >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {progressPercentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden" style={{ minHeight: '12px' }}>
                              <div
                                className={`h-3 rounded-full transition-all ${
                                  progressPercentage >= 100
                                    ? 'bg-green-600'
                                    : progressPercentage >= 75
                                    ? 'bg-blue-600'
                                    : progressPercentage >= 50
                                    ? 'bg-yellow-600'
                                    : 'bg-red-600'
                                }`}
                                style={{ 
                                  width: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
                                  minWidth: progressPercentage > 0 ? '2px' : '0px',
                                  height: '12px'
                                }}
                              />
                            </div>
                            {remainingAmount > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">{formatCurrency(remainingAmount)}</span> remaining to reach target
                              </p>
                            ) : progressPercentage > 0 ? (
                              <p className="text-sm text-green-600 font-medium">
                                🎉 Target exceeded by {formatCurrency(Math.abs(remainingAmount))}!
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No sales recorded yet
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
