import React from 'react';
import { Package, CheckCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface ProductMasterRow {
  [key: string]: unknown;
  product_id: string;
  product_code: string;
  name: string;
  unit_type: string;
  price: number;
  sale_price: number;
  tax_pct: number;
  is_active: string;
  created_at: string;
}

const COLUMNS: ReportColumn<ProductMasterRow>[] = [
  { key: 'product_code', label: 'Code',       sortable: true, render: (v) => <span className="font-mono text-xs text-muted-foreground">{String(v)}</span> },
  { key: 'name',         label: 'Product',    sortable: true },
  { key: 'unit_type',    label: 'Unit' },
  { key: 'price',        label: 'Base Price', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'sale_price',   label: 'Sale Price', align: 'right', render: (v) => <span className="text-emerald-700">{formatCurrency(Number(v))}</span> },
  { key: 'tax_pct',      label: 'Tax %',      align: 'right', render: (v) => `${Number(v).toFixed(1)}%` },
  {
    key: 'is_active', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${String(v) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{String(v)}</span>,
  },
  { key: 'created_at', label: 'Added', sortable: true },
];

export default function ProductMaster() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<ProductMasterRow>({ endpoint: '/reports/master/products', defaultFilters: { page_size: 25 } });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Product Master List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All products with pricing and tax details</p>
        </div>
        <ExportBar endpoint="/reports/master/products" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard title="Total Products"  value={(summary.total_products as number ?? 0).toLocaleString()}   icon={<Package />}     iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Active Products" value={(summary.active_products as number ?? 0).toLocaleString()}  icon={<CheckCircle />} iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
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
        emptyMessage="No products found."
      />
    </div>
  );
}
