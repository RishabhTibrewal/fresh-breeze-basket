import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Search,
  Package,
} from "lucide-react";
import { toast } from 'sonner';
import { warehousesService, Warehouse } from '@/api/warehouses';
import WarehouseForm from '@/pages/admin/WarehouseForm';

export default function Warehouses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  // Fetch warehouses
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehousesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsDeleteDialogOpen(false);
      setSelectedWarehouse(null);
      toast.success('Warehouse deactivated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to deactivate warehouse');
    },
  });

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedWarehouse) {
      deleteMutation.mutate(selectedWarehouse.id);
    }
  };

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    warehouse.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (warehouse.city && warehouse.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 pb-20 md:pb-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">Warehouse Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">Manage your warehouse locations and inventory</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto text-sm sm:text-base">
          <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          Create Warehouse
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Search warehouses by name, code, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 sm:pl-8 h-9 sm:h-10 text-sm sm:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Table */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Warehouses ({filteredWarehouses.length})</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage warehouse locations</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {isLoading ? (
            <div className="text-center py-8 text-sm">Loading warehouses...</div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No warehouses found. Create your first warehouse to get started.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                {filteredWarehouses.map((warehouse) => (
                  <Card
                    key={warehouse.id}
                    className="p-3 w-full min-w-0 overflow-hidden cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
                    onClick={() => navigate(`/inventory/warehouses/${warehouse.id}/inventory`)}
                  >
                    <div className="space-y-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="font-semibold text-sm break-words">{warehouse.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {warehouse.code}
                          </div>
                        </div>
                        <Badge variant={warehouse.is_active ? "default" : "secondary"} className="flex-shrink-0">
                          {warehouse.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {(warehouse.city || warehouse.country) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {[warehouse.city, warehouse.country].filter(Boolean).join(', ') || '-'}
                          </span>
                        </div>
                      )}
                      {warehouse.contact_phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{warehouse.contact_phone}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 min-h-[44px]"
                          onClick={() => navigate(`/inventory/warehouses/${warehouse.id}/inventory`)}
                        >
                          <Package className="h-3.5 w-3.5 mr-1.5" />
                          Inventory
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px]"
                          onClick={() => handleEdit(warehouse)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px] text-destructive"
                          onClick={() => handleDelete(warehouse)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Code</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[200px]">Location</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[150px]">Contact</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium text-sm">
                        {warehouse.code}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {warehouse.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {warehouse.city && warehouse.country ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{warehouse.city}, {warehouse.country}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {warehouse.contact_phone ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{warehouse.contact_phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                          {warehouse.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/inventory/warehouses/${warehouse.id}/inventory`)}
                            className="h-8 w-8"
                            title="View Inventory"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(warehouse)}
                            className="h-8 w-8"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(warehouse)}
                            className="h-8 w-8 text-destructive"
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Warehouse Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Warehouse</DialogTitle>
            <DialogDescription>Add a new warehouse location</DialogDescription>
          </DialogHeader>
          <WarehouseForm
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Warehouse Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Warehouse</DialogTitle>
            <DialogDescription>Update warehouse information</DialogDescription>
          </DialogHeader>
          {selectedWarehouse && (
            <WarehouseForm
              warehouse={selectedWarehouse}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setSelectedWarehouse(null);
                queryClient.invalidateQueries({ queryKey: ['warehouses'] });
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedWarehouse(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Deactivate Warehouse</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate "{selectedWarehouse?.name}"? 
              This will mark the warehouse as inactive but will not delete it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
