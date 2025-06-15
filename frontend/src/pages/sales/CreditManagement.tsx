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
import { Search, ArrowUpDown } from "lucide-react";
import { format } from 'date-fns';
import apiClient from '@/lib/apiClient';

interface CustomerCredit {
  id: string;
  name: string;
  email: string;
  phone: string;
  credit_limit: number;
  current_credit: number;
  credit_period_days: number;
  active_credit?: {
    amount: number;
    period: number;
    start_date: string;
    end_date: string;
  };
}

export default function CreditManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof CustomerCredit>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch customers with credit information
  const { data: customers, isLoading, error } = useQuery<CustomerCredit[]>({
    queryKey: ['customers-credit'],
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Credit Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Credit Overview</CardTitle>
          <CardDescription>
            View and manage customer credit information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Customer Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('current_credit')}
                  >
                    <div className="flex items-center gap-2">
                      Credit Amount
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('credit_limit')}
                  >
                    <div className="flex items-center gap-2">
                      Credit Limit
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Credit Period</TableHead>
                  <TableHead>Active Credit</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.email}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        ${customer.current_credit?.toFixed(2) || '0.00'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        ${customer.credit_limit?.toFixed(2) || '0.00'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.credit_period_days || 0} days
                    </TableCell>
                    <TableCell>
                      {customer.active_credit ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            ${customer.active_credit.amount.toFixed(2)}
                          </div>
                          <div className="text-muted-foreground">
                            {customer.active_credit.period} days
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No active credit</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.active_credit ? (
                        <div className="text-sm">
                          {format(new Date(customer.active_credit.end_date), 'MMM d, yyyy')}
                          <div className="text-muted-foreground">
                            {new Date() > new Date(customer.active_credit.end_date) ? (
                              <span className="text-red-600">Overdue</span>
                            ) : (
                              <span className="text-green-600">Active</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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