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

export default function AdminOrderList() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      try {
        const orders = await ordersService.getAll();
        console.log('Fetched admin orders:', orders);
        return orders;
      } catch (error) {
        console.error('Error fetching admin orders:', error);
        toast.error('Failed to load orders. Please try again.');
        throw error;
      }
    },
  });

  useEffect(() => {
    if (orders) {
      console.log(`Loaded ${orders.length} orders for admin`);
    }
  }, [orders]);

  const filteredOrders = orders?.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Orders </h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search by Order ID or Status..."
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
                  <TableCell>{order.userId || order.user_id || 'N/A'}</TableCell>
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
    </div>
  );
} 