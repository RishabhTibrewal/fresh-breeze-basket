import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, ListChecks, Eye } from 'lucide-react';
import { modifiersService, ModifierGroup } from '@/api/modifiers';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ModifierList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data: modifierGroups, isLoading } = useQuery<ModifierGroup[]>({
    queryKey: ['modifierGroups'],
    queryFn: modifiersService.getModifierGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => modifiersService.deleteModifierGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifierGroups'] });
      toast.success('Modifier group deleted successfully');
      setDeleteGroupId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete modifier group');
    },
  });

  const filteredGroups = modifierGroups?.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const columns: Column<ModifierGroup>[] = [
    {
      key: 'icon',
      header: '',
      render: () => (
        <Avatar className="h-10 w-10 bg-muted">
          <AvatarFallback className="bg-transparent text-muted-foreground">
            <ListChecks className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: 'name',
      header: 'Group Name',
      render: (group) => (
        <div>
          <div className="font-medium">{group.name}</div>
          <div className="text-sm text-muted-foreground line-clamp-1">{group.description || 'No description'}</div>
        </div>
      ),
    },
    {
      key: 'selectionRules',
      header: 'Selection Rules',
      render: (group) => (
        <div className="text-sm">
          Min: {group.min_select} | Max: {group.max_select ?? 'Any'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (group) => (
        <Badge variant={group.is_active ? 'default' : 'secondary'}>
          {group.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (group) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/inventory/modifiers/${group.id}/edit`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteGroupId(group.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (group: ModifierGroup) => (
    <Card className="cursor-pointer hover:bg-accent">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 bg-muted">
            <AvatarFallback className="bg-transparent text-muted-foreground">
              <ListChecks className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{group.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{group.description || 'No description'}</p>
                <p className="text-sm mt-1">Min: {group.min_select} | Max: {group.max_select ?? 'Any'}</p>
              </div>
              <Badge variant={group.is_active ? 'default' : 'secondary'}>
                {group.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/inventory/modifiers/${group.id}/edit`);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit / Items
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteGroupId(group.id);
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
          <h1 className="text-3xl font-bold">Modifier Groups</h1>
          <p className="text-muted-foreground mt-1">Manage product customization options and add-ons</p>
        </div>
        <Button onClick={() => navigate('/inventory/modifiers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Modifier Group
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search modifier groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading modifier groups...</div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filteredGroups}
          renderCard={renderCard}
          emptyMessage="No modifier groups found"
          onRowClick={(group) => navigate(`/inventory/modifiers/${group.id}/edit`)}
        />
      )}

      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Modifier Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this modifier group? This action will also delete all modifiers within this group and remove it from any assigned products. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteMutation.mutate(deleteGroupId)}
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
