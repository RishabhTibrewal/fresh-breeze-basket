import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, Plus, Eye, Edit } from "lucide-react";
import { format } from 'date-fns';
import { customerService, CustomerOrder } from '@/api/customer';
import { toast } from 'sonner';

export default function CustomerOrders() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get customer details
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerService.getCustomerById(customerId!),
    enabled: !!customerId,
  });
  
  // Get customer orders
  const { 
    data: orders = [], 
    isLoading: ordersLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['customerOrders', customerId],
    queryFn: () => customerService.getCustomerOrders(customerId!),
    enabled: !!customerId,
  });
  
  const isLoading = customerLoading || ordersLoading;
  
  useEffect(() => {
    if (isError) {
      toast.error(`Failed to load orders: ${(error as Error).message}`);
    }
  }, [isError, error]);
  
  // Filter orders based on search
  const filteredOrders = orders.filter(order => 
    (order.order_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (order.status?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );
  
  // Helper for status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      case 'shipped':
        return <Badge variant="default">Shipped</Badge>;
      case 'delivered':
        return <Badge className="bg-green-600">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Helper for payment status badge
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500">Partially Paid</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <Button 
        variant="outline" 
        className="mb-4"
        onClick={() => navigate('/sales/customers')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Button>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Orders for {customer?.name || 'Customer'}</CardTitle>
              <CardDescription>
                Manage orders for this customer
              </CardDescription>
            </div>
            <Button onClick={() => navigate(`/sales/orders/create?customerId=${customerId}`)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Order
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No orders found</TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(order.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sales/orders/${order.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        
        {customer && (
          <CardFooter className="flex justify-between">
            <div>
              <p className="text-sm font-medium">Customer Information</p>
              <p className="text-sm">Email: {customer.email}</p>
              <p className="text-sm">Phone: {customer.phone}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Credit Information</p>
              <p className="text-sm">Credit Limit: ${(customer.credit_limit || 0).toFixed(2)}</p>
              <p className="text-sm">Current Credit: ${(customer.current_credit || 0).toFixed(2)}</p>
              {customer.active_credit && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-primary">Active Credit</p>
                  <p className="text-sm">Amount: ${customer.active_credit.amount.toFixed(2)}</p>
                  <p className="text-sm">Due: {new Date(customer.active_credit.end_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
} 