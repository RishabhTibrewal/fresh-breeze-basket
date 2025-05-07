import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/api/admin';
import adminService from '@/api/admin';
import { ErrorMessage } from '@/components/ui/error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const CustomersPage: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch customers
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', page, limit, debouncedSearch],
    queryFn: () => adminService.getUsers(page, limit, debouncedSearch),
  });

  // Get initials for avatar
  const getInitials = (firstName: string | null, lastName: string | null): string => {
    let initials = '';
    if (firstName) initials += firstName.charAt(0).toUpperCase();
    if (lastName) initials += lastName.charAt(0).toUpperCase();
    return initials || '?';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Debug Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h3 className="text-amber-800 font-medium mb-2">Admin Access Debug Info</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>User ID:</div>
          <div className="font-mono">{user?.id || 'Not logged in'}</div>
          
          <div>Email:</div>
          <div className="font-mono">{user?.email || 'N/A'}</div>
          
          <div>Role in Context:</div>
          <div className="font-mono">{profile?.role || 'N/A'}</div>
          
          <div>Is Admin (Context):</div>
          <div className="font-mono">{isAdmin ? 'Yes' : 'No'}</div>
        </div>
        <div className="mt-3">
          <Link 
            to="/admin/check" 
            className="text-primary text-sm font-medium hover:underline"
          >
            Go to detailed admin status check
          </Link>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-3 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search customers..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorMessage 
            title="Error loading customers" 
            message="There was a problem loading the customer data. This may be due to insufficient admin permissions."
          />
          <div className="text-center">
            <Link 
              to="/admin/check" 
              className="text-primary text-sm font-medium hover:underline"
            >
              Check your admin status here
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.users.map((user: UserProfile) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback>
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.first_name || user.last_name 
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                              : 'Unnamed User'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 text-xs rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                  </TableRow>
                ))}
                {data?.data.users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {[...Array(Math.min(5, data?.data.pagination.pages || 1))].map((_, i) => {
                const pageNum = page <= 3 
                  ? i + 1 
                  : page + i - 2;
                
                if (pageNum > data?.data.pagination.pages) return null;
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      onClick={() => setPage(pageNum)} 
                      isActive={page === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(prev => 
                    data?.data.pagination.pages && prev < data?.data.pagination.pages 
                      ? prev + 1 
                      : prev
                  )}
                  className={
                    !data?.data.pagination.pages || page >= data?.data.pagination.pages 
                      ? 'pointer-events-none opacity-50' 
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
};

export default CustomersPage; 