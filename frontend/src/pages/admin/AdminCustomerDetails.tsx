import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  ShoppingCart,
  Receipt,
  Link as LinkIcon
} from 'lucide-react';
import { customerService } from '@/api/customer';
import { ErrorMessage } from '@/components/ui/error-message';
import { partiesService } from '@/api/parties';

export default function AdminCustomerDetails() {
  const { id: customerOrUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine the back route based on current path
  const getBackRoute = () => {
    if (location.pathname.startsWith('/sales/customers')) {
      return '/sales/customers';
    }
    return '/admin/customers';
  };
  
  // Fetch customer details - try by user ID first, then by customer ID
  const { 
    data: customer, 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['admin-customer', customerOrUserId],
    queryFn: async () => {
      try {
        // First try to get by user ID (for profiles)
        const customerData = await customerService.getCustomerByUserId(customerOrUserId!);
        console.log('Customer details loaded by user ID:', customerData);
        return customerData;
      } catch (userError: any) {
        // If that fails, try to get by customer ID
        if (userError?.response?.status === 404 || userError?.message?.includes('not found')) {
          console.log('Customer not found by user ID, trying customer ID...');
          const customerData = await customerService.getCustomerById(customerOrUserId!);
          console.log('Customer details loaded by customer ID:', customerData);
          return customerData;
        }
        throw userError;
      }
    },
    enabled: !!customerOrUserId
  });

  const { data: partyLedger } = useQuery({
    queryKey: ['customer-party-ledger', customer?.party_id],
    queryFn: () => partiesService.getPartyLedger(customer!.party_id!),
    enabled: !!customer?.party_id,
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
        <Button variant="outline" onClick={() => navigate(getBackRoute())} className="mt-4 w-full sm:w-auto text-sm sm:text-base">
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
          onClick={() => navigate(getBackRoute())}
          className="w-full sm:w-auto text-sm sm:text-base flex-shrink-0"
        >
          <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Back to Customers
        </Button>
      </div>
      
      <Tabs defaultValue="details" className="w-full min-w-0">
        <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="details" className="text-xs sm:text-sm">Customer Details</TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs sm:text-sm">Complete Ledger</TabsTrigger>
          {customer.party_id && (
            <TabsTrigger value="party-ledger" className="text-xs sm:text-sm">Party Ledger</TabsTrigger>
          )}
        </TabsList>
        
        {/* Customer Details Tab */}
        <TabsContent value="details" className="w-full min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
            {/* Profile Table Data — only shown for retail customers who have a linked profile */}
            {customer.profile && (
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
                </div>
              </CardContent>
            </Card>
            )}

            
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
                      <p className="font-medium text-sm sm:text-base">₹ {customer.credit_limit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Current Credit</p>
                      <p className={`font-medium text-sm sm:text-base ${
                        customer.current_credit > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        ₹ {customer.current_credit?.toFixed(2) || '0.00'}
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
                        ₹ {Math.max(0, customer.credit_limit - customer.current_credit).toFixed(2)}
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
                    <p className="font-medium text-base sm:text-lg">₹ {customer.totalSpent?.toFixed(2) || '0.00'}</p>
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
                                  ₹ {period.amount?.toFixed(2) || '0.00'}
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
                                  ₹ {period.amount?.toFixed(2) || '0.00'}
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

            {/* Payments Section (for both retail and wholesale customers) */}
            {customer.payments && customer.payments.length > 0 && (
              <Card className="w-full min-w-0 overflow-hidden">
                <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    All payment transactions for this customer
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-2.5 w-full min-w-0 overflow-hidden">
                    {customer.payments.map((payment: any) => (
                      <Card key={payment.id} className="p-3 w-full min-w-0 overflow-hidden">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-bold text-green-600 mb-1">
                                ₹ {payment.amount?.toFixed(2) || '0.00'}
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Payment ID: {payment.id.substring(0, 8)}...
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                              <Badge variant={
                                payment.status === 'completed' ? 'default' :
                                payment.status === 'pending' ? 'secondary' :
                                payment.status === 'failed' ? 'destructive' : 'outline'
                              } className="text-xs">
                                {payment.status || 'pending'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-1 text-xs min-w-0">
                            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {payment.payment_date 
                                  ? formatDateTime(payment.payment_date)
                                  : formatDateTime(payment.created_at)
                                }
                              </span>
                            </div>
                            {payment.payment_method && (
                              <div className="min-w-0">
                                <span className="text-muted-foreground">Method: </span>
                                <span className="font-medium">{payment.payment_method}</span>
                              </div>
                            )}
                            {payment.transaction_id && (
                              <div className="min-w-0">
                                <span className="text-muted-foreground">Transaction ID: </span>
                                <span className="font-medium break-all">{payment.transaction_id}</span>
                              </div>
                            )}
                            {payment.cheque_no && (
                              <div className="min-w-0">
                                <span className="text-muted-foreground">Cheque No: </span>
                                <span className="font-medium">{payment.cheque_no}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2">Payment Date</TableHead>
                          <TableHead className="px-2">Amount</TableHead>
                          <TableHead className="px-2">Payment Method</TableHead>
                          <TableHead className="px-2">Transaction/Cheque</TableHead>
                          <TableHead className="px-2">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.payments.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell className="px-2 py-2 text-xs sm:text-sm">
                              {payment.payment_date 
                                ? formatDateTime(payment.payment_date)
                                : formatDateTime(payment.created_at)
                              }
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <span className="font-medium text-xs sm:text-sm">
                                ₹ {payment.amount?.toFixed(2) || '0.00'}
                              </span>
                            </TableCell>
                            <TableCell className="px-2 py-2 text-xs sm:text-sm">
                              {payment.payment_method || 'N/A'}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-xs sm:text-sm text-muted-foreground">
                              {payment.transaction_id && (
                                <div>TX: {payment.transaction_id}</div>
                              )}
                              {payment.cheque_no && (
                                <div>Cheque: {payment.cheque_no}</div>
                              )}
                              {!payment.transaction_id && !payment.cheque_no && '-'}
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <Badge variant={
                                payment.status === 'completed' ? 'default' :
                                payment.status === 'pending' ? 'secondary' :
                                payment.status === 'failed' ? 'destructive' : 'outline'
                              } className="text-xs">
                                {payment.status || 'pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
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
                                  ₹ {order.total_amount?.toFixed(2) || '0.00'}
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
                                  ₹ {order.total_amount?.toFixed(2) || '0.00'}
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

        {/* Party Ledger Tab */}
        {customer.party_id && (
          <TabsContent value="party-ledger" className="w-full min-w-0">
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  Trading Partner Ledger
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Combined receivables and payables for this business partner
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {partyLedger ? (
                  <div className="space-y-4">
                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium text-sm">{partyLedger.party.name}</span>
                      {partyLedger.party.is_customer && <Badge variant="outline">Customer</Badge>}
                      {partyLedger.party.is_supplier && <Badge variant="outline">Supplier</Badge>}
                    </div>

                    {/* Totals */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total Receivable</p>
                        <p className="text-base font-semibold text-orange-600">₹ {partyLedger.totals.totalReceivable.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total Payable</p>
                        <p className="text-base font-semibold text-blue-600">₹ {partyLedger.totals.totalPayable.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Net Position</p>
                        <p className={`text-base font-semibold ${
                          partyLedger.totals.netPosition > 0 ? 'text-green-600' :
                          partyLedger.totals.netPosition < 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          ₹ {partyLedger.totals.netPosition.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {partyLedger.totals.netPosition > 0 ? 'They owe us' :
                           partyLedger.totals.netPosition < 0 ? 'We owe them' : 'Balanced'}
                        </p>
                      </div>
                    </div>

                    {/* Ledger entries table */}
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[550px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-2">Date</TableHead>
                            <TableHead className="px-2">Type</TableHead>
                            <TableHead className="px-2">Side</TableHead>
                            <TableHead className="px-2">Amount</TableHead>
                            <TableHead className="px-2">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partyLedger.entries.map((entry) => (
                            <TableRow key={entry.doc_id}>
                              <TableCell className="px-2 py-2 text-xs sm:text-sm">
                                {entry.doc_date ? format(new Date(entry.doc_date), 'MMM d, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {entry.doc_type.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge className={`text-xs ${
                                  entry.ledger_side === 'receivable'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {entry.ledger_side}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <span className={`font-medium text-xs sm:text-sm ${
                                  entry.ledger_side === 'receivable' ? 'text-orange-600' : 'text-blue-600'
                                }`}>
                                  ₹ {Number(entry.amount).toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge variant="outline" className="text-xs capitalize">{entry.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/party/${partyLedger.party.id}/ledger`)}
                    >
                      View Full Party Ledger Page
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No trading partner data available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
