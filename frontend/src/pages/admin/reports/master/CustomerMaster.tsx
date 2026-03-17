import React from 'react';
import { Users, DollarSign, AlertCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface CustomerMasterRow {
  [key: string]: unknown;
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  trn_number: string;
  credit_limit: number;
  current_credit: number;
  credit_period_days: number;
  created_at: string;
}

const COLUMNS: ReportColumn<CustomerMasterRow>[] = [
  { key: 'name',               label: 'Customer',     sortable: true },
  {
    key: 'email', label: 'Contact',
    render: (_v, row) => (
      <div>
        <p className="text-sm">{String(row.email)}</p>
        <p className="text-xs text-muted-foreground">{String(row.phone)}</p>
      </div>
    ),
  },
  { key: 'trn_number',         label: 'TRN',          render: (v) => <span className="font-mono text-xs">{String(v) === '—' ? '' : String(v)}</span> },
  { key: 'credit_limit',       label: 'Credit Limit', align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  {
    key: 'current_credit', label: 'Outstanding', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      return <span className={`font-semibold font-mono ${n > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(n)}</span>;
    },
  },
  { key: 'credit_period_days', label: 'Credit Days',  align: 'right', render: (v) => `${Number(v)} days` },
  { key: 'created_at',         label: 'Since',        sortable: true },
];

export default function CustomerMaster() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CustomerMasterRow>({ endpoint: '/reports/master/customers', defaultFilters: { page_size: 25 } });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer Master List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All customers with credit limits and outstanding</p>
        </div>
        <ExportBar endpoint="/reports/master/customers" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Customers"  value={(summary.total_customers as number ?? 0).toLocaleString()}     icon={<Users />}       iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Credit"     value={formatCurrency(Number(summary.total_credit_limit ?? 0))}       icon={<DollarSign />}  iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Total Outstanding"value={formatCurrency(Number(summary.total_outstanding ?? 0))}        icon={<AlertCircle />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} showSearch hideDateRange />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        meta={meta}
        sortBy={filters.sort_by}
        sortDir={filters.sort_dir}
        onPageChange={(p) => setFilter('page', p)}
        onSortChange={(k, d) => setFilters({ sort_by: k, sort_dir: d })}
        emptyMessage="No customers found."
      />
    </div>
  );
}
