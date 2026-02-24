import { useState } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
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
import { Search, ArrowUpDown, User, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/lib/apiClient';

interface CustomerCredit {
  id: string;
  name: string;
  email: string;
  phone: string;
  credit_limit: number;
  current_credit: number;
  credit_period_days: number;
  overdue_credit?: {
    amount: number;
    period: number;
    start_date: string;
    end_date: string;
  } | null;
}

export default function CreditManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof CustomerCredit>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch customers with credit information (admin can see all customers)
  const { data: customers, isLoading, error } = useQuery<CustomerCredit[]>({
    queryKey: ['admin-customers-credit'],
    queryFn: async () => {
      const response = await apiClient.get('/customer/credit');
      return response.data.data;
    }
  });

  // Filter customers based on search query
  const filteredCustomers = customers?.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  ) || [];

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    }

    return 0;
  });

  const handleSort = (field: keyof CustomerCredit) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
        <Skeleton className="h-6 sm:h-8 w-1/2 sm:w-1/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <div className="p-4 sm:p-6 bg-destructive/10 border border-destructive rounded-lg text-center">
          <h3 className="text-base sm:text-lg font-semibold text-destructive">Error Loading Credit Data</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">Failed to load credit information. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Credit Management</h1>
      </div>

      <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg lg:text-xl">Customer Credit Overview</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            View and manage customer credit information across all customers
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 sm:pl-8 h-9 sm:h-10 text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {sortedCustomers.map((customer) => (
              <Card key={customer.id} className="w-full min-w-0 overflow-hidden">
                <CardContent className="px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <h3 className="font-medium text-sm break-words">{customer.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground break-words">{customer.email}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Credit Amount</p>
                      <p className="font-medium text-sm">₹{customer.current_credit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Credit Limit</p>
                      <p className="font-medium text-sm">₹{customer.credit_limit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Credit Period</p>
                      <p className="font-medium text-sm">{customer.credit_period_days || 0} days</p>
                    </div>
                    {customer.overdue_credit ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                        <p className="font-medium text-sm text-red-600">₹{customer.overdue_credit.amount.toFixed(2)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      </div>
                    )}
                  </div>
                  
                  {customer.overdue_credit && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-red-600 font-medium">
                          Overdue: {format(new Date(customer.overdue_credit.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {sortedCustomers.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No customers found</div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border w-full min-w-0 overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer px-2 py-2 min-w-[150px]"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Customer Name</span>
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer px-2 py-2 w-24 sm:w-28"
                    onClick={() => handleSort('current_credit')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Credit Amount</span>
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer px-2 py-2 w-24 sm:w-28"
                    onClick={() => handleSort('credit_limit')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Credit Limit</span>
                      <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="px-2 py-2 w-20 sm:w-24 text-xs sm:text-sm">Credit Period</TableHead>
                  <TableHead className="px-2 py-2 w-28 sm:w-32 text-xs sm:text-sm">Overdue Credit</TableHead>
                  <TableHead className="px-2 py-2 w-28 sm:w-32 text-xs sm:text-sm">Overdue Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="px-2 py-2 min-w-0">
                      <div>
                        <div className="font-medium text-xs sm:text-sm break-words">{customer.name}</div>
                        <div className="text-xs text-muted-foreground break-words">{customer.email}</div>
                        <div className="text-xs text-muted-foreground">{customer.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="font-medium text-xs sm:text-sm">
                      ₹{customer.current_credit?.toFixed(2) || '0.00'}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="font-medium text-xs sm:text-sm">
                      ₹{customer.credit_limit?.toFixed(2) || '0.00'}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-xs sm:text-sm">
                      {customer.credit_period_days || 0} days
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {customer.overdue_credit ? (
                        <div className="text-xs sm:text-sm">
                          <div className="font-medium text-red-600">
                            ₹{customer.overdue_credit.amount.toFixed(2)}
                          </div>
                          <div className="text-muted-foreground">
                            {customer.overdue_credit.period} days
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-muted-foreground">No overdue credit</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {customer.overdue_credit ? (
                        <div className="text-xs sm:text-sm">
                          <div className="text-red-600 font-medium">
                            {format(new Date(customer.overdue_credit.end_date), 'MMM d, yyyy')}
                          </div>
                          <div className="text-muted-foreground">
                              <span className="text-red-600">Overdue</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
