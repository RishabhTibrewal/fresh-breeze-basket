import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService, UserProfile } from '@/api/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Users, Mail, Phone, Calendar, DollarSign, Target, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

export default function SalesPersons() {
  const { data: salesExecutivesData, isLoading, error } = useQuery({
    queryKey: ['sales-executives'],
    queryFn: async () => {
      const response = await adminService.getSalesExecutives();
      return response;
    },
  });

  const salesExecutives = salesExecutivesData?.data || [];

  // Fetch sales targets for each executive
  const { data: targetsData } = useQuery({
    queryKey: ['sales-targets'],
    queryFn: async () => {
      try {
        const response = await adminService.getSalesTargets();
        return response;
      } catch (err) {
        return { success: false, data: [] };
      }
    },
  });

  const targets = targetsData?.data || [];

  // Helper to get active target for a sales executive
  const getActiveTarget = (executiveId: string) => {
    const today = new Date();
    return targets.find((target: any) => 
      target.sales_executive_id === executiveId &&
      target.is_active &&
      new Date(target.period_start) <= today &&
      new Date(target.period_end) >= today
    );
  };

  // Helper to get all targets for a sales executive
  const getTargetsForExecutive = (executiveId: string) => {
    return targets.filter((target: any) => target.sales_executive_id === executiveId);
  };

  // Helper to format name
  const formatName = (executive: UserProfile) => {
    if (executive.first_name || executive.last_name) {
      return `${executive.first_name || ''} ${executive.last_name || ''}`.trim();
    }
    return executive.email;
  };

  // Helper to get initials
  const getInitials = (executive: UserProfile) => {
    if (executive.first_name || executive.last_name) {
      const first = executive.first_name?.[0] || '';
      const last = executive.last_name?.[0] || '';
      return `${first}${last}`.toUpperCase();
    }
    return executive.email[0].toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">
              Error loading sales persons. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Persons</h1>
          <p className="text-muted-foreground mt-2">
            View and manage sales executives in your company
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Users className="h-4 w-4 mr-2" />
          {salesExecutives.length} Sales {salesExecutives.length === 1 ? 'Person' : 'Persons'}
        </Badge>
      </div>

      {salesExecutives.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No sales persons found</p>
              <p className="text-sm mt-2">
                Sales persons will appear here once they are assigned the 'sales' role.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {salesExecutives.map((executive: UserProfile) => {
            const activeTarget = getActiveTarget(executive.id);
            const allTargets = getTargetsForExecutive(executive.id);
            const progressPercentage = activeTarget?.progress_percentage || 0;
            const achievedAmount = activeTarget?.achieved_amount || 0;
            const targetAmount = activeTarget?.target_amount || 0;

            return (
              <Card key={executive.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={executive.avatar_url || undefined} alt={formatName(executive)} />
                        <AvatarFallback className="text-lg">
                          {getInitials(executive)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-2xl">{formatName(executive)}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {executive.email}
                          </span>
                          {executive.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {executive.phone}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="default" className="text-sm">
                      Sales Executive
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Active Target Section */}
                  {activeTarget ? (
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">Active Target</span>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {activeTarget.period_type}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Target Amount</p>
                          <p className="text-lg font-semibold">{formatCurrency(targetAmount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Achieved</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            {formatCurrency(achievedAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Progress</p>
                          <p className={`text-lg font-semibold ${
                            progressPercentage >= 100 ? 'text-green-600' :
                            progressPercentage >= 75 ? 'text-blue-600' :
                            progressPercentage >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {progressPercentage.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Remaining</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(Math.max(0, targetAmount - achievedAmount))}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress Bar</span>
                          <span className={`font-semibold ${
                            progressPercentage >= 100 ? 'text-green-600' :
                            progressPercentage >= 75 ? 'text-blue-600' :
                            progressPercentage >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {progressPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              progressPercentage >= 100
                                ? 'bg-green-600'
                                : progressPercentage >= 75
                                ? 'bg-blue-600'
                                : progressPercentage >= 50
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ 
                              width: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
                              minWidth: progressPercentage > 0 ? '2px' : '0px'
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(activeTarget.period_start), 'MMM dd, yyyy')} - {format(new Date(activeTarget.period_end), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No active target set</p>
                    </div>
                  )}

                  {/* Statistics Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Total Targets</p>
                      </div>
                      <p className="text-2xl font-bold">{allTargets.length}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Active Targets</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {allTargets.filter((t: any) => t.is_active).length}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Total Achieved</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(
                          allTargets.reduce((sum: number, t: any) => sum + (t.achieved_amount || 0), 0)
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Account Created</p>
                        <p className="font-medium">
                          {format(new Date(executive.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Last Updated</p>
                        <p className="font-medium">
                          {format(new Date(executive.updated_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

