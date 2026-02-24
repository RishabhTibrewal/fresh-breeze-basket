import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Percent, Eye } from 'lucide-react';
import { taxesService, Tax } from '@/api/taxes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

export default function TaxList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTaxId, setDeleteTaxId] = useState<string | null>(null);

  const { data: taxes, isLoading } = useQuery<Tax[]>({
    queryKey: ['taxes'],
    queryFn: taxesService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taxesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      toast.success('Tax deleted successfully');
      setDeleteTaxId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete tax');
    },
  });

  const filteredTaxes = taxes?.filter(tax =>
    tax.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tax.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const columns: Column<Tax>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (tax) => (
        <div>
          <div className="font-medium">{tax.name}</div>
          <div className="text-sm text-muted-foreground">{tax.code}</div>
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (tax) => (
        <div className="font-medium">{tax.rate}%</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (tax) => (
        <Badge variant={tax.is_active ? 'default' : 'secondary'}>
          {tax.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (tax) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/taxes/${tax.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/taxes/${tax.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTaxId(tax.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (tax: Tax) => (
    <Card className="cursor-pointer hover:bg-accent">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{tax.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{tax.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{tax.rate}%</span>
                <Badge variant={tax.is_active ? 'default' : 'secondary'}>
                  {tax.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/taxes/${tax.id}`);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/taxes/${tax.id}/edit`);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTaxId(tax.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Taxes</h1>
          <p className="text-muted-foreground mt-1">Manage tax rates</p>
        </div>
        <Button onClick={() => navigate('/admin/taxes/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tax
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search taxes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading taxes...</div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredTaxes}
          renderCard={renderCard}
          emptyMessage="No taxes found"
          onRowClick={(tax) => navigate(`/admin/taxes/${tax.id}`)}
        />
      )}

      <AlertDialog open={!!deleteTaxId} onOpenChange={() => setDeleteTaxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tax? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaxId && deleteMutation.mutate(deleteTaxId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

