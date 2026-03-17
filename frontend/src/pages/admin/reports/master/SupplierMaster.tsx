import React from 'react';
import { Truck, CheckCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface SupplierMasterRow {
  [key: string]: unknown;
  supplier_id: string;
  supplier_code: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  gst_no: string;
  opening_balance: number;
  closing_balance: number;
  is_active: string;
}

const COLUMNS: ReportColumn<SupplierMasterRow>[] = [
  { key: 'supplier_code', label: 'Code',          render: (v) => <span className="font-mono text-xs text-muted-foreground">{String(v)}</span> },
  {
    key: 'name', label: 'Supplier', sortable: true,
    render: (_v, row) => (
      <div>
        <p className="font-medium text-sm">{String(row.name)}</p>
        <p className="text-xs text-muted-foreground">{String(row.email)}</p>
      </div>
    ),
  },
  {
    key: 'city', label: 'Location',
    render: (_v, row) => <span className="text-sm text-muted-foreground">{String(row.city)}, {String(row.country)}</span>,
  },
  { key: 'gst_no',          label: 'GST No', render: (v) => <span className="font-mono text-xs">{String(v) === '—' ? '' : String(v)}</span> },
  { key: 'opening_balance', label: 'Opening Bal',  align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'closing_balance', label: 'Closing Bal',  align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  {
    key: 'is_active', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${String(v) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{String(v)}</span>,
  },
];

export default function SupplierMaster() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<SupplierMasterRow>({ endpoint: '/reports/master/suppliers', defaultFilters: { page_size: 25 } });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Supplier Master List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All suppliers with contact details and balance</p>
        </div>
        <ExportBar endpoint="/reports/master/suppliers" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard title="Total Suppliers"  value={(summary.total_suppliers as number ?? 0).toLocaleString()}   icon={<Truck />}       iconColor="bg-violet-50 text-violet-600"  isLoading={isLoading} />
        <KpiCard title="Active Suppliers" value={(summary.active_suppliers as number ?? 0).toLocaleString()}  icon={<CheckCircle />} iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
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
        emptyMessage="No suppliers found."
      />
    </div>
  );
}
