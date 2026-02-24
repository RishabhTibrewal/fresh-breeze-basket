import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Building2, Eye } from 'lucide-react';
import { brandsService, Brand } from '@/api/brands';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

export default function BrandList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);

  const { data: brands, isLoading } = useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: brandsService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => brandsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand deleted successfully');
      setDeleteBrandId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete brand');
    },
  });

  const filteredBrands = brands?.filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    brand.legal_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const columns: Column<Brand>[] = [
    {
      key: 'logo',
      header: 'Logo',
      render: (brand) => (
        <Avatar className="h-10 w-10">
          <AvatarImage src={brand.logo_url || ''} alt={brand.name} />
          <AvatarFallback>
            <Building2 className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (brand) => (
        <div>
          <div className="font-medium">{brand.name}</div>
          {brand.legal_name && (
            <div className="text-sm text-muted-foreground">{brand.legal_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (brand) => (
        <Badge variant={brand.is_active ? 'default' : 'secondary'}>
          {brand.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (brand) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/brands/${brand.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/brands/${brand.id}/edit`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteBrandId(brand.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (brand: Brand) => (
    <Card className="cursor-pointer hover:bg-accent">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={brand.logo_url || ''} alt={brand.name} />
            <AvatarFallback>
              <Building2 className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{brand.name}</h3>
                {brand.legal_name && (
                  <p className="text-sm text-muted-foreground truncate">{brand.legal_name}</p>
                )}
              </div>
              <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                {brand.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/brands/${brand.id}`);
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
                  navigate(`/admin/brands/${brand.id}/edit`);
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
                  setDeleteBrandId(brand.id);
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
          <h1 className="text-3xl font-bold">Brands</h1>
          <p className="text-muted-foreground mt-1">Manage product brands</p>
        </div>
        <Button onClick={() => navigate('/admin/brands/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Brand
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading brands...</div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredBrands}
          renderCard={renderCard}
          emptyMessage="No brands found"
          onRowClick={(brand) => navigate(`/admin/brands/${brand.id}`)}
        />
      )}

      <AlertDialog open={!!deleteBrandId} onOpenChange={() => setDeleteBrandId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this brand? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBrandId && deleteMutation.mutate(deleteBrandId)}
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

