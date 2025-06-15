import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersService } from '@/api/orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function AdminOrderList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  const { data: ordersData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-orders', currentPage, searchTerm],
    queryFn: async () => {
      try {
        const response = await ordersService.getAll({
          page: currentPage,
          limit: ordersPerPage
        });
        console.log('Fetched admin orders:', response);
        
        // Enhance orders with user profile information
        const enhancedOrders = await Promise.all(
          response.data.map(async (order) => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('id', order.user_id)
                .single();

              return {
                ...order,
                userProfile: profileData || null
              };
            } catch (error) {
              console.error('Error fetching profile for order:', order.id, error);
              return {
                ...order,
                userProfile: null
              };
            }
          })
        );

        return {
          orders: enhancedOrders,
          totalCount: response.count
        };
      } catch (error) {
        console.error('Error fetching admin orders:', error);
        toast.error('Failed to load orders. Please try again.');
        throw error;
      }
    },
  });

  useEffect(() => {
    if (ordersData?.orders) {
      console.log(`Loaded ${ordersData.orders.length} orders for admin`);
    }
  }, [ordersData]);

  const filteredOrders = ordersData?.orders?.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.userProfile?.email && order.userProfile.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.userProfile?.first_name && order.userProfile.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.userProfile?.last_name && order.userProfile.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Calculate total pages from backend count
  const totalPages = Math.ceil((ordersData?.totalCount || 0) / ordersPerPage);

  // Function to safely format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    
    try {
      // Try to handle different date formats
      let date;
      if (dateString.includes('T')) {
        // ISO format
        date = new Date(dateString);
      } else {
        // Handle format with space instead of T
        date = new Date(dateString.replace(' ', 'T'));
      }
      
      return isNaN(date.getTime()) 
        ? 'Invalid date' 
        : format(date, 'MMM dd, yyyy, HH:mm');
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Invalid date';
    }
  };

  // Function to format user name
  const formatUserName = (order: any) => {
    if (!order.userProfile) return 'N/A';
    const { first_name, last_name, email } = order.userProfile;
    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    return email || 'N/A';
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages are less than maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate start and end of visible pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at the start
      if (currentPage <= 2) {
        endPage = 4;
      }
      // Adjust if at the end
      if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      // Add ellipsis if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Orders </h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search by Order ID, Status, or User..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-[300px]"
          />
          <Button onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Spinner className="h-6 w-6 mx-auto" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-red-600">
                  Error loading orders. Please try again.
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.id.split('-')[0] || order.id}</TableCell>
                  <TableCell>{formatUserName(order)}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'cancelled' ? 'destructive' : 'default'}>
                      {order.status || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    AED {typeof order.total_amount === 'number' 
                      ? order.total_amount.toFixed(2) 
                      : '0.00'
                    }
                  </TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link to={`/admin/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        View / Manage
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && !isError && ordersData?.totalCount > 0 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === '...' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => handlePageChange(Number(page))}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
} 