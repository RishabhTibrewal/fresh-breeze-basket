import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { 
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  DollarSign,
  CreditCard,
  ArrowLeft,
  Clock,
  ShoppingCart
} from 'lucide-react';
import { customerService } from '@/api/customer';
import { ErrorMessage } from '@/components/ui/error-message';

export default function AdminCustomerDetails() {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch customer details
  const { 
    data: customer, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['admin-customer', userId],
    queryFn: async () => {
      const customerData = await customerService.getCustomerByUserId(userId!);
      console.log('Customer details loaded:', customerData);
      return customerData;
    },
    enabled: !!userId
  });

  if (isLoading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex items-center justify-center h-64">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    );
  }

  if (isError || (!customer && !isLoading)) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <ErrorMessage 
          title="Error loading customer" 
          message={error instanceof Error ? error.message : 'User profile not found'}
        />
        <Button variant="outline" onClick={() => navigate('/admin/customers')} className="mt-4 w-full sm:w-auto text-sm sm:text-base">
          <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Back to Customers
        </Button>
      </div>
    );
  }

  // Handle case where customer data might be null (shouldn't happen after our backend update, but just in case)
  if (!customer) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="flex items-center justify-center h-64">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy, h:mm a');
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">
            Customer Details
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {customer.name || 'Customer'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/customers')}
          className="w-full sm:w-auto text-sm sm:text-base flex-shrink-0"
        >
          <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Back to Customers
        </Button>
      </div>
      
      <Tabs defaultValue="details" className="w-full min-w-0">
        <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
          <TabsTrigger value="details" className="text-xs sm:text-sm">Customer Details</TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs sm:text-sm">Complete Ledger</TabsTrigger>
        </TabsList>
        
        {/* Customer Details Tab */}
        <TabsContent value="details" className="w-full min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
            {/* Profile Table Data */}
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Data from profiles table</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {customer.profile ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">First Name</p>
                          <p className="font-medium text-sm sm:text-base break-words">{customer.profile.first_name || 'N/A'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">Last Name</p>
                          <p className="font-medium text-sm sm:text-base break-words">{customer.profile.last_name || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Email</p>
                        <p className="font-medium text-sm sm:text-base break-words truncate">{customer.profile.email || 'N/A'}</p>
                      </div>
                      
                      {customer.profile.phone && (
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">Phone (Profile)</p>
                          <p className="font-medium text-sm sm:text-base break-words">{customer.profile.phone}</p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-1">Role</p>
                        <Badge variant={customer.profile.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                          {customer.profile.role || 'user'}
                        </Badge>
                      </div>
                      
                      {customer.profile.avatar_url && (
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">Avatar</p>
                          <img 
                            src={customer.profile.avatar_url} 
                            alt="Avatar" 
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">Profile Created</p>
                          <p className="font-medium text-xs break-words">{formatDateTime(customer.profile.created_at)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">Profile Updated</p>
                          <p className="font-medium text-xs break-words">{formatDateTime(customer.profile.updated_at)}</p>
                        </div>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">User ID</p>
                        <p className="font-medium font-mono text-xs break-all">{customer.profile.id}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No profile data found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Customer Table Data */}
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Customer Information
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {customer.isCustomerRecord === false 
                    ? 'No customer record found - showing profile data only' 
                    : 'Data from customers table'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {customer.isCustomerRecord === false ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-yellow-800 break-words">
                        This user does not have a customer record in the customers table. 
                        Only profile information is available.
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Display Name</p>
                      <p className="font-medium text-sm sm:text-base break-words">{customer.name || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Customer Name</p>
                      <p className="font-medium text-sm sm:text-base break-words">{customer.name || 'N/A'}</p>
                    </div>
                    
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Email (Customer)</p>
                      <p className="font-medium text-sm sm:text-base break-words truncate">{customer.email || 'N/A'}</p>
                    </div>
                    
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Phone (Customer)</p>
                      <p className="font-medium text-sm sm:text-base break-words">{customer.phone || 'N/A'}</p>
                    </div>
                    
                    {customer.trn_number && (
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">TRN Number</p>
                        <p className="font-medium text-sm sm:text-base break-words">{customer.trn_number}</p>
                      </div>
                    )}
                    
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Customer ID</p>
                      <p className="font-medium font-mono text-xs break-all">{customer.id}</p>
                    </div>
                    
                    {customer.sales_executive_id && (
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Sales Executive ID</p>
                        <p className="font-medium font-mono text-xs break-all">{customer.sales_executive_id}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Customer Created</p>
                        <p className="font-medium text-xs break-words">{formatDateTime(customer.created_at)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Customer Updated</p>
                        <p className="font-medium text-xs break-words">{formatDateTime(customer.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  Credit Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Credit Limit</p>
                      <p className="font-medium text-sm sm:text-base">AED {customer.credit_limit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Current Credit</p>
                      <p className={`font-medium text-sm sm:text-base ${
                        customer.current_credit > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        AED {customer.current_credit?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Credit Period Days</p>
                    <p className="font-medium text-sm sm:text-base">{customer.credit_period_days || 0} days</p>
                  </div>
                  
                  {customer.credit_limit > 0 && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Available Credit</p>
                      <p className={`font-medium text-sm sm:text-base ${
                        (customer.credit_limit - customer.current_credit) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        AED {Math.max(0, customer.credit_limit - customer.current_credit).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Order Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
                    <p className="font-medium text-base sm:text-lg">{customer.totalOrders || 0}</p>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Spent</p>
                    <p className="font-medium text-base sm:text-lg">AED {customer.totalSpent?.toFixed(2) || '0.00'}</p>
                  </div>
                  
                  {customer.lastOrder && (
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Last Order Date</p>
                      <p className="font-medium text-sm sm:text-base">{formatDate(customer.lastOrder)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Created At</p>
                    <p className="font-medium text-xs sm:text-sm break-words">{formatDateTime(customer.created_at)}</p>
                  </div>
                  
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium text-xs sm:text-sm break-words">{formatDateTime(customer.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Complete Ledger Tab */}
        <TabsContent value="ledger" className="w-full min-w-0">
          <div className="space-y-3 sm:space-y-6">
            {/* Credit Periods Section (for wholesale customers) */}
            {customer.isCustomerRecord && customer.credit_periods && customer.credit_periods.length > 0 && (
              <Card className="w-full min-w-0 overflow-hidden">
                <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                    Credit Periods Ledger
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Credit transactions for wholesale customer
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                    {customer.credit_periods.map((period: any) => {
                      const isExpired = period.amount > 0 && new Date(period.end_date) < new Date();
                      const isActive = !isExpired && period.amount > 0;
                      
                      return (
                        <Card 
                          key={period.id} 
                          className={`p-3 w-full min-w-0 overflow-hidden ${isExpired ? 'border-red-200 bg-red-50/50' : ''}`}
                        >
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <Badge variant={period.type === 'credit' ? 'default' : 'outline'} className="text-xs">
                                    {period.type || 'credit'}
                                  </Badge>
                                  {isActive && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                                  )}
                                  {period.amount === 0 && (
                                    <Badge className="bg-blue-100 text-blue-800 text-xs">Paid</Badge>
                                  )}
                                  {!isActive && period.amount > 0 && (
                                    <Badge variant="outline" className="text-xs">Pending</Badge>
                                  )}
                                  {isExpired && (
                                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                                  )}
                                </div>
                                <div className={`text-base font-semibold mb-1 ${
                                  period.amount > 0 ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                  AED {period.amount?.toFixed(2) || '0.00'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-1.5 text-xs min-w-0">
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{formatDateTime(period.created_at)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="min-w-0">
                                  <span className="text-muted-foreground">Period: </span>
                                  <span className="font-medium">{period.period || 0} days</span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-muted-foreground">Start: </span>
                                  <span className="font-medium truncate">{formatDate(period.start_date)}</span>
                                </div>
                              </div>
                              <div className="min-w-0">
                                <span className={`text-muted-foreground ${isExpired ? 'text-red-700' : ''}`}>End Date: </span>
                                <span className={`font-medium ${isExpired ? 'text-red-700' : ''}`}>
                                  {formatDate(period.end_date)}
                                </span>
                              </div>
                              {period.description && (
                                <div className="min-w-0 pt-1 border-t">
                                  <p className="text-xs text-muted-foreground break-words whitespace-pre-line">
                                    {period.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2">Date</TableHead>
                          <TableHead className="px-2">Type</TableHead>
                          <TableHead className="px-2">Amount</TableHead>
                          <TableHead className="px-2">Period</TableHead>
                          <TableHead className="px-2">Start Date</TableHead>
                          <TableHead className="px-2">End Date</TableHead>
                          <TableHead className="px-2">Status</TableHead>
                          <TableHead className="px-2">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.credit_periods.map((period: any) => {
                          const isExpired = period.amount > 0 && new Date(period.end_date) < new Date();
                          const isActive = !isExpired && period.amount > 0;
                          
                          return (
                            <TableRow 
                              key={period.id}
                              className={isExpired ? 'bg-red-50' : ''}
                            >
                              <TableCell className={`px-2 py-2 text-xs sm:text-sm ${isExpired ? 'text-red-700' : ''}`}>
                                {formatDateTime(period.created_at)}
                              </TableCell>
                              <TableCell className={`px-2 py-2 ${isExpired ? 'text-red-700' : ''}`}>
                                <Badge variant={period.type === 'credit' ? 'default' : 'outline'} className="text-xs">
                                  {period.type || 'credit'}
                                </Badge>
                              </TableCell>
                              <TableCell className={`px-2 py-2 ${isExpired ? 'text-red-700' : ''}`}>
                                <span className={`font-medium text-xs sm:text-sm ${
                                  period.amount > 0 ? 'text-orange-600' : 'text-green-600'
                                }`}>
                                  AED {period.amount?.toFixed(2) || '0.00'}
                                </span>
                              </TableCell>
                              <TableCell className={`px-2 py-2 text-xs sm:text-sm ${isExpired ? 'text-red-700' : ''}`}>
                                {period.period || 0} days
                              </TableCell>
                              <TableCell className={`px-2 py-2 text-xs sm:text-sm ${isExpired ? 'text-red-700' : ''}`}>
                                {formatDate(period.start_date)}
                              </TableCell>
                              <TableCell className={`px-2 py-2 ${isExpired ? 'text-red-700' : ''}`}>
                                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                  <span className={`text-xs sm:text-sm ${isExpired ? 'text-red-700 font-medium' : ''}`}>
                                    {formatDate(period.end_date)}
                                  </span>
                                  {isExpired && (
                                    <Badge variant="destructive" className="text-xs">
                                      Expired
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className={`px-2 py-2 ${isExpired ? 'text-red-700' : ''}`}>
                                {isActive ? (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                                ) : period.amount === 0 ? (
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">Paid</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell className={`px-2 py-2 ${isExpired ? 'text-red-700' : ''}`}>
                                <div className="max-w-[150px] sm:max-w-md">
                                  <p className="text-xs sm:text-sm whitespace-pre-line break-words">
                                    {period.description || 'No description'}
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Section (for both retail and wholesale customers) */}
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                  Order History
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {customer.isCustomerRecord === false 
                    ? 'All orders for this retail customer' 
                    : 'All orders for this customer'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {customer.orders && customer.orders.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                      {customer.orders.map((order: any) => (
                        <Card key={order.id} className="p-3 w-full min-w-0 overflow-hidden">
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm mb-1">
                                  Order #{order.id.split('-')[0]}
                                </div>
                                <div className="text-base font-bold text-green-600 mb-2">
                                  AED {order.total_amount?.toFixed(2) || '0.00'}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5 flex-shrink-0">
                                <Badge variant={
                                  order.status === 'delivered' ? 'default' :
                                  order.status === 'cancelled' ? 'destructive' : 'outline'
                                } className="text-xs">
                                  {order.status || 'pending'}
                                </Badge>
                                <Badge variant={
                                  order.payment_status === 'paid' ? 'default' :
                                  order.payment_status === 'credit' || order.payment_status === 'partial' ? 'outline' : 'secondary'
                                } className="text-xs">
                                  {order.payment_status || 'pending'}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="space-y-1 text-xs min-w-0">
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{formatDateTime(order.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-2">Order Date</TableHead>
                            <TableHead className="px-2">Order ID</TableHead>
                            <TableHead className="px-2">Amount</TableHead>
                            <TableHead className="px-2">Status</TableHead>
                            <TableHead className="px-2">Payment Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customer.orders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell className="px-2 py-2 text-xs sm:text-sm">
                                {formatDateTime(order.created_at)}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <span className="font-mono text-xs">{order.id.split('-')[0]}</span>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <span className="font-medium text-xs sm:text-sm">
                                  AED {order.total_amount?.toFixed(2) || '0.00'}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge variant={
                                  order.status === 'delivered' ? 'default' :
                                  order.status === 'cancelled' ? 'destructive' : 'outline'
                                } className="text-xs">
                                  {order.status || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge variant={
                                  order.payment_status === 'paid' ? 'default' :
                                  order.payment_status === 'credit' || order.payment_status === 'partial' ? 'outline' : 'secondary'
                                } className="text-xs">
                                  {order.payment_status || 'pending'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-xs sm:text-sm">No orders found for this customer</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
