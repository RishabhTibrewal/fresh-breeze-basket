import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Shield, User, UserCheck, Loader2, DollarSign } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { adminService, UserProfile } from '@/api/admin';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X } from 'lucide-react';

const ROLE_COLORS = {
  user: 'bg-gray-100 text-gray-800',
  admin: 'bg-purple-100 text-purple-800',
  sales: 'bg-blue-100 text-blue-800',
  accounts: 'bg-green-100 text-green-800',
};

const ROLE_ICONS = {
  user: User,
  admin: Shield,
  sales: UserCheck,
  accounts: DollarSign,
};

export default function AdminSettings() {
  const { user: currentUser, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 20;

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page when searching
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, debouncedSearch],
    queryFn: () => adminService.getUsers(page, limit, debouncedSearch || undefined),
  });

  // Fetch available roles
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.getAllRoles(),
  });

  // Track which user's roles are being edited and their selected roles
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Update roles mutation (new multi-role system)
  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      adminService.updateUserRoles(userId, roles),
    onSuccess: (data, variables) => {
      toast.success(data.message || `User roles updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setEditingUserId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update user roles');
    },
  });


  const handleEditRoles = (userId: string, currentRoles: string[]) => {
    setEditingUserId(userId);
    setSelectedRoles([...currentRoles]);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setSelectedRoles([]);
  };

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleName)) {
        // Prevent removing admin role from current user
        if (editingUserId === currentUser?.id && roleName === 'admin') {
          toast.error('You cannot remove your own admin role');
          return prev;
        }
        return prev.filter((r) => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };

  const handleSaveRoles = (userId: string) => {
    // Only admins can change roles
    if (!hasRole('admin')) {
      toast.error('Only administrators can change user roles');
      return;
    }

    // Ensure user role is always included if any roles are selected
    const rolesToSave = selectedRoles.length > 0 
      ? (selectedRoles.includes('user') ? selectedRoles : ['user', ...selectedRoles.filter(r => r !== 'user')])
      : ['user'];

    // Prevent admin from removing their own admin role
    if (currentUser?.id === userId && !rolesToSave.includes('admin')) {
      toast.error('You cannot remove your own admin role');
      return;
    }

    updateRolesMutation.mutate({ userId, roles: rolesToSave });
  };

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Role Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user roles and permissions. Users can have multiple roles (e.g., sales + accounts). Admin role grants full access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Search and manage user roles. Users can have multiple roles simultaneously (e.g., sales + accounts).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, first name, or last name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Failed to load users. Please try again.
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found.
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Current Roles</TableHead>
                      <TableHead>Change Role</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: UserProfile) => {
                      const isCurrentUser = currentUser?.id === user.id;
                      const userRoles = user.roles || (user.role ? [user.role] : ['user']);

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.first_name || user.last_name
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userRoles.map((roleName) => {
                                const RoleIcon = ROLE_ICONS[roleName as keyof typeof ROLE_ICONS] || User;
                                return (
                                  <Badge key={roleName} className={ROLE_COLORS[roleName as keyof typeof ROLE_COLORS] || 'bg-gray-100 text-gray-800'}>
                                    <RoleIcon className="h-3 w-3 mr-1" />
                                    {roleName.toUpperCase()}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingUserId === user.id ? (
                              <div className="space-y-2 min-w-[200px]">
                                <div className="space-y-2">
                                  {rolesData?.data?.map((role) => {
                                    const RoleIcon = ROLE_ICONS[role.name as keyof typeof ROLE_ICONS] || User;
                                    const isChecked = selectedRoles.includes(role.name);
                                    const isDisabled = isCurrentUser && role.name === 'admin' && userRoles.includes('admin');
                                    
                                    return (
                                      <div key={role.name} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`${user.id}-${role.name}`}
                                          checked={isChecked}
                                          disabled={isDisabled || updateRolesMutation.isPending}
                                          onCheckedChange={() => handleRoleToggle(role.name)}
                                        />
                                        <label
                                          htmlFor={`${user.id}-${role.name}`}
                                          className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-2 ${
                                            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                          }`}
                                        >
                                          <RoleIcon className="h-4 w-4" />
                                          <span className="capitalize">{role.name}</span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveRoles(user.id)}
                                    disabled={updateRolesMutation.isPending}
                                    className="h-7"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    disabled={updateRolesMutation.isPending}
                                    className="h-7"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                                {isCurrentUser && userRoles.includes('admin') && (
                                  <p className="text-xs text-muted-foreground">
                                    Cannot remove your own admin role
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRoles(user.id, userRoles)}
                                disabled={updateRolesMutation.isPending || !hasRole('admin')}
                                title={!hasRole('admin') ? 'Only admins can change user roles' : 'Edit Roles'}
                              >
                                Edit Roles
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of{' '}
                    {pagination.total} users
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={page === pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-gray-600" />
                <span className="font-semibold">User</span>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Standard user access. Can browse products, place orders, and manage their account.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Sales Executive</span>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Can manage customers, create orders on behalf of customers, and manage credit periods.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Accounts</span>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Can manage invoices, payments, supplier payments, and financial records.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">Admin</span>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Full system access. Can manage products, categories, orders, customers, and user roles. Users can have multiple roles simultaneously.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
