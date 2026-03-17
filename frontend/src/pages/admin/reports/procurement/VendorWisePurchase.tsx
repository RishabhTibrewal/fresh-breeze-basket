import React from 'react';
import { Users, DollarSign, AlertCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface VendorPurchaseRow {
  [key: string]: unknown;
  supplier_id: string;
  supplier_name: string;
  email: string;
  total_invoices: number;
  total_amount: number;
  total_paid: number;
  outstanding: number;
}

const COLUMNS: ReportColumn<VendorPurchaseRow>[] = [
  {
    key: 'supplier_name', label: 'Supplier', sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{String(row.email)}</p>
      </div>
    ),
  },
  { key: 'total_invoices', label: 'Invoices', align: 'right', sortable: true, render: (v) => Number(v).toLocaleString() },
  { key: 'total_amount',   label: 'Total',    align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'total_paid',     label: 'Paid',     align: 'right', render: (v) => <span className="text-emerald-700">{formatCurrency(Number(v))}</span> },
  {
    key: 'outstanding', label: 'Outstanding', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      return <span className={`font-mono font-semibold ${n > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(n)}</span>;
    },
  },
];

export default function VendorWisePurchase() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<VendorPurchaseRow>({ endpoint: '/reports/procurement/vendor-wise' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    supplier_name: <strong>Totals</strong>,
    total_amount:  <strong>{formatCurrency(Number(summary.total_purchases ?? 0))}</strong>,
    outstanding:   <strong className="text-red-600">{formatCurrency(Number(summary.total_outstanding ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vendor-wise Purchase Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Aggregated purchases and outstanding by supplier</p>
        </div>
        <ExportBar endpoint="/reports/procurement/vendor-wise" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Suppliers"   value={(summary.total_suppliers as number ?? 0).toLocaleString()}    icon={<Users />}       iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Total Purchases"   value={formatCurrency(Number(summary.total_purchases ?? 0))}        icon={<DollarSign />}  iconColor="bg-emerald-50 text-emerald-600"  isLoading={isLoading} />
        <KpiCard title="Total Outstanding" value={formatCurrency(Number(summary.total_outstanding ?? 0))}      icon={<AlertCircle />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} showSearch />
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
        summaryRow={totalRow}
      />
    </div>
  );
}
