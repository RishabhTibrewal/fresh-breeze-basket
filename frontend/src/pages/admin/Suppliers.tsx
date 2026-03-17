import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, Trash2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { suppliersService } from '@/api/suppliers';
import apiClient from '@/lib/apiClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Suppliers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const moduleBase = `/${window.location.pathname.split('/')[1]}`;
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Fetch suppliers
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', isActiveFilter, searchQuery],
    queryFn: () => suppliersService.getAll({
      is_active: isActiveFilter !== 'all' ? isActiveFilter === 'true' : undefined,
      search: searchQuery || undefined,
    }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteDialogOpen(false);
      setSelectedSupplier(null);
      toast.success('Supplier deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete supplier');
    },
  });

  const handleDelete = (id: string) => {
    setSelectedSupplier(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedSupplier) {
      deleteMutation.mutate(selectedSupplier);
    }
  };

  const createLinkedCustomerMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const response = await apiClient.post(`/suppliers/${supplierId}/create-linked-customer`);
      return response.data;
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (response?.data?.id) {
        toast.success(response?.alreadyExists ? 'Customer counterpart already exists' : 'Customer counterpart created');
      } else {
        toast.success('Customer counterpart is ready');
      }
      navigate('/sales/customers');
    },
    onError: (error: any) => {
      console.error('Error creating linked customer:', error);
      toast.error(error?.response?.data?.error || error?.message || 'Failed to create customer counterpart');
    },
  });

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Suppliers</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage suppliers and vendor information
          </p>
        </div>
        <Button onClick={() => navigate(`${moduleBase}/suppliers/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="all">All Suppliers</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({suppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suppliers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Trading Partner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier: any) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        {supplier.supplier_code || '-'}
                      </TableCell>
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>{supplier.contact_name || '-'}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        {supplier.party_id && supplier.party?.is_customer ? (
                          <span className="text-sm text-muted-foreground truncate" title={supplier.party?.name || ''}>
                            {supplier.party?.name || 'Linked Customer'}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/procurement/suppliers/${supplier.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`${moduleBase}/suppliers/${supplier.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!!(supplier.party_id && supplier.party?.is_customer) || createLinkedCustomerMutation.isPending}
                            onClick={() => createLinkedCustomerMutation.mutate(supplier.id)}
                            title={supplier.party_id && supplier.party?.is_customer ? "Already has customer role" : "Use as Customer"}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                          <AlertDialog open={deleteDialogOpen && selectedSupplier === supplier.id} onOpenChange={(open) => {
                            if (!open) {
                              setDeleteDialogOpen(false);
                              setSelectedSupplier(null);
                            }
                          }}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(supplier.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {supplier.name}? This will mark the supplier as inactive.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteConfirm}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
