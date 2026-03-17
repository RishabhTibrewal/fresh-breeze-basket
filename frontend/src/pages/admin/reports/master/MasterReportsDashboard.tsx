import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Users, Truck, UserCog, Activity, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/reports/KpiCard';
import apiClient from '@/lib/apiClient';

interface MasterDashboardKpis {
  total_products: number;
  total_customers: number;
  total_suppliers: number;
  total_users: number;
}

const REPORT_LINKS = [
  { label: 'Product Master',   path: '/reports/master/products',  icon: Package,  color: 'text-blue-600 bg-blue-50' },
  { label: 'Customer Master',  path: '/reports/master/customers', icon: Users,    color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Supplier Master',  path: '/reports/master/suppliers', icon: Truck,    color: 'text-violet-600 bg-violet-50' },
  { label: 'User Master',      path: '/reports/master/users',     icon: UserCog,  color: 'text-amber-600 bg-amber-50' },
  { label: 'Activity Log',     path: '/reports/master/activity',  icon: Activity, color: 'text-red-600 bg-red-50' },
];

export default function MasterReportsDashboard() {
  const { data: kpis, isLoading } = useQuery<MasterDashboardKpis>({
    queryKey: ['master-dashboard-kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/master/dashboard');
      return data.data;
    },
  });

  return (
    <div className="w-full space-y-6 px-4 lg:px-8 py-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Master & Audit Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Master data lists and activity audit logs</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Products"  value={(kpis?.total_products ?? 0).toLocaleString()}  icon={<Package />}  iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Customers"       value={(kpis?.total_customers ?? 0).toLocaleString()} icon={<Users />}    iconColor="bg-emerald-50 text-emerald-600"  isLoading={isLoading} />
        <KpiCard title="Suppliers"       value={(kpis?.total_suppliers ?? 0).toLocaleString()} icon={<Truck />}    iconColor="bg-violet-50 text-violet-600"   isLoading={isLoading} />
        <KpiCard title="Users"           value={(kpis?.total_users ?? 0).toLocaleString()}     icon={<UserCog />}  iconColor="bg-amber-50 text-amber-600"     isLoading={isLoading} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Available Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_LINKS.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.path} to={r.path}>
                <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer border-transparent hover:border-primary/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${r.color}`}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{r.label}</p></div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
