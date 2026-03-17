import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, DollarSign, TrendingUp, FileText,
  Truck, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/reports/KpiCard';
import { ReportFilters } from '@/components/reports/ReportFilters';
import apiClient from '@/lib/apiClient';
import type { ReportFilter } from '@/api/reports';
import { formatCurrency } from '@/lib/utils';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

interface ProcurementDashboardKpis {
  total_invoices: number;
  total_purchase_value: number;
  total_paid: number;
  total_outstanding: number;
  total_grns: number;
  total_payments: number;
}

const REPORT_LINKS = [
  { label: 'Invoice Register',       path: '/reports/procurement/invoice-register', icon: FileText,    color: 'text-blue-600 bg-blue-50' },
  { label: 'GRN Report',             path: '/reports/procurement/grn-report',       icon: Truck,       color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Vendor-wise Purchase',   path: '/reports/procurement/vendor-wise',      icon: ShoppingCart,color: 'text-violet-600 bg-violet-50' },
  { label: 'Supplier Payment Register', path: '/reports/procurement/payment-register', icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
];

export default function ProcurementReportsDashboard() {
  const [filters, setFilters] = useState<ReportFilter>({
    from_date: thirtyDaysAgo.toISOString().split('T')[0],
    to_date: today.toISOString().split('T')[0],
  });

  const { data: kpis, isLoading } = useQuery<ProcurementDashboardKpis>({
    queryKey: ['procurement-dashboard-kpis', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/procurement/dashboard', { params: filters });
      return data.data;
    },
  });

  return (
    <div className="w-full space-y-6 px-4 lg:px-8 py-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Procurement Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Purchase invoices, GRN, vendor and payment analytics</p>
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border">
        <ReportFilters
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setFilters({ from_date: thirtyDaysAgo.toISOString().split('T')[0], to_date: today.toISOString().split('T')[0] })}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="Total Invoices"      value={(kpis?.total_invoices ?? 0).toLocaleString()}           icon={<FileText />}     iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Purchase Value"      value={formatCurrency(kpis?.total_purchase_value ?? 0)}        icon={<TrendingUp />}   iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Paid"          value={formatCurrency(kpis?.total_paid ?? 0)}                  icon={<DollarSign />}   iconColor="bg-green-50 text-green-600"     isLoading={isLoading} />
        <KpiCard title="Outstanding"         value={formatCurrency(kpis?.total_outstanding ?? 0)}           icon={<AlertCircle />}  iconColor="bg-red-50 text-red-600"        isLoading={isLoading} />
        <KpiCard title="GRNs Received"       value={(kpis?.total_grns ?? 0).toLocaleString()}               icon={<Truck />}        iconColor="bg-violet-50 text-violet-600"  isLoading={isLoading} />
        <KpiCard title="Payments Made"       value={(kpis?.total_payments ?? 0).toLocaleString()}           icon={<ShoppingCart />} iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Available Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
