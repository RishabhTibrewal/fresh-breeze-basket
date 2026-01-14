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
import { Search, Mail, Phone, Calendar, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/api/admin';
import adminService from '@/api/admin';
import { ErrorMessage } from '@/components/ui/error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const CustomersPage: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
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
    <div className="space-y-3 sm:space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Debug Info Banner - Hidden on mobile */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 hidden md:block">
        <h3 className="text-amber-800 font-medium mb-2 text-sm sm:text-base">Admin Access Debug Info</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-sm">
          <div>User ID:</div>
          <div className="font-mono truncate">{user?.id || 'Not logged in'}</div>
          
          <div>Email:</div>
          <div className="font-mono truncate">{user?.email || 'N/A'}</div>
          
          <div>Role in Context:</div>
          <div className="font-mono">{profile?.role || 'N/A'}</div>
          
          <div>Is Admin (Context):</div>
          <div className="font-mono">{isAdmin ? 'Yes' : 'No'}</div>
        </div>
        <div className="mt-3">
          <Link 
            to="/admin/check" 
            className="text-primary text-xs sm:text-sm font-medium hover:underline"
          >
            Go to detailed admin status check
          </Link>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-bold break-words">Customers</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1 sm:mt-2 break-words">
            View and manage all customers
          </p>
        </div>
        <div className="relative w-full sm:w-64 min-w-0 flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
          <Input
            placeholder="Search customers..."
            className="pl-9 sm:pl-8 text-sm sm:text-base h-9 sm:h-10 w-full min-w-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 sm:space-x-4">
              <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex-shrink-0" />
              <div className="space-y-2 min-w-0 flex-1">
                <Skeleton className="h-4 w-32 sm:w-40" />
                <Skeleton className="h-3 w-24 sm:w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="space-y-3 sm:space-y-4">
          <ErrorMessage 
            title="Error loading customers" 
            message="There was a problem loading the customer data. This may be due to insufficient admin permissions."
          />
          <div className="text-center">
            <Link 
              to="/admin/check" 
              className="text-primary text-xs sm:text-sm font-medium hover:underline"
            >
              Check your admin status here
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-2.5 w-full min-w-0 px-0 pb-4 overflow-hidden">
            {data?.data.users.map((user: UserProfile) => (
              <Card 
                key={user.id} 
                className="p-3 w-full min-w-0 overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/admin/customers/${user.id}`)}
              >
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.first_name, user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm mb-1 break-words">
                          {user.first_name || user.last_name 
                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                            : 'Unnamed User'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>
                    <Badge 
                      className={`text-xs px-2 py-0.5 flex-shrink-0 ${
                        user.role === 'admin' 
                          ? 'bg-primary/20 text-primary' 
                          : user.role === 'sales'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-xs min-w-0">
                    {user.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatDate(user.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {data?.data.users.length === 0 && (
              <Card className="p-6">
                <div className="text-center text-sm text-muted-foreground">
                  No customers found
                </div>
              </Card>
            )}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block w-full min-w-0 overflow-hidden">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-base sm:text-xl">All Customers ({data?.data.users.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="w-full min-w-0 p-0 overflow-hidden">
              <div className="w-full min-w-0 overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2">Customer</TableHead>
                      <TableHead className="px-2">Email</TableHead>
                      <TableHead className="px-2">Phone</TableHead>
                      <TableHead className="px-2">Role</TableHead>
                      <TableHead className="px-2">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.users.map((user: UserProfile) => (
                      <TableRow 
                        key={user.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/customers/${user.id}`)}
                      >
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={user.avatar_url || ''} />
                              <AvatarFallback className="text-xs">
                                {getInitials(user.first_name, user.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {user.first_name || user.last_name 
                                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                                  : 'Unnamed User'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-1 text-sm min-w-0">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          {user.phone ? (
                            <div className="flex items-center gap-1 text-sm min-w-0">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{user.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge 
                            className={`text-xs px-2 py-0.5 ${
                              user.role === 'admin' 
                                ? 'bg-primary/20 text-primary' 
                                : user.role === 'sales'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                            variant="outline"
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-1 text-sm min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{formatDate(user.created_at)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data?.data.users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                          No customers found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="w-full min-w-0 overflow-x-auto">
            <Pagination className="justify-center">
              <PaginationContent className="flex-wrap gap-1 sm:gap-2">
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    className={`text-xs sm:text-sm ${page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
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
                        className="text-xs sm:text-sm min-w-[32px] sm:min-w-[40px] h-8 sm:h-10"
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
                    className={`text-xs sm:text-sm ${
                      !data?.data.pagination.pages || page >= data?.data.pagination.pages 
                        ? 'pointer-events-none opacity-50' 
                        : 'cursor-pointer'
                    }`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomersPage; 