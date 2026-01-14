import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Shield, User, UserCheck, Loader2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { adminService, UserProfile } from '@/api/admin';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_COLORS = {
  user: 'bg-gray-100 text-gray-800',
  admin: 'bg-purple-100 text-purple-800',
  sales: 'bg-blue-100 text-blue-800',
};

const ROLE_ICONS = {
  user: User,
  admin: Shield,
  sales: UserCheck,
};

export default function AdminSettings() {
  const { user: currentUser } = useAuth();
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

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'admin' | 'sales' }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: (data, variables) => {
      toast.success(data.message || `User role updated to ${variables.role} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update user role');
    },
  });

  const handleRoleChange = (userId: string, newRole: 'user' | 'admin' | 'sales') => {
    // Prevent admin from removing their own admin role
    if (currentUser?.id === userId && newRole !== 'admin') {
      toast.error('You cannot remove your own admin role');
      return;
    }

    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Role Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user roles and permissions. Assign admin or sales executive access to users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Search and manage user roles. You can assign admin or sales executive roles to users.
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
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: UserProfile) => {
                      const RoleIcon = ROLE_ICONS[user.role] || User;
                      const isCurrentUser = currentUser?.id === user.id;

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
                            <Badge className={ROLE_COLORS[user.role]}>
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {user.role.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value: 'user' | 'admin' | 'sales') =>
                                handleRoleChange(user.id, value)
                              }
                              disabled={
                                updateRoleMutation.isPending ||
                                (isCurrentUser && user.role === 'admin')
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">
                                  <div className="flex items-center">
                                    <User className="h-4 w-4 mr-2" />
                                    User
                                  </div>
                                </SelectItem>
                                <SelectItem value="sales">
                                  <div className="flex items-center">
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Sales
                                  </div>
                                </SelectItem>
                                <SelectItem value="admin">
                                  <div className="flex items-center">
                                    <Shield className="h-4 w-4 mr-2" />
                                    Admin
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {isCurrentUser && user.role === 'admin' && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Cannot change your own role
                              </p>
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
                <Shield className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">Admin</span>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Full system access. Can manage products, categories, orders, customers, and user roles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
