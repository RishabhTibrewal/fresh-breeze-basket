import React from 'react';
import { Package, DollarSign, BarChart3 } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface ProductRow {
  [key: string]: unknown;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  total_qty: number;
  total_revenue: number;
  avg_unit_price: number;
  total_tax: number;
  order_count: number;
}

const COLUMNS: ReportColumn<ProductRow>[] = [
  {
    key: 'product_name', label: 'Product', sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{row.variant_name} · <span className="font-mono">{row.sku}</span></p>
      </div>
    ),
  },
  { key: 'total_qty',     label: 'Qty Sold', align: 'right', sortable: true, render: (v) => Number(v).toLocaleString() },
  { key: 'order_count',   label: 'Orders',   align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'avg_unit_price',label: 'Avg Price',align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'total_revenue', label: 'Revenue',  align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'total_tax',     label: 'Tax',      align: 'right', render: (v) => formatCurrency(Number(v)) },
];

export default function ProductWiseSales() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<ProductRow>({ endpoint: '/reports/sales/product-wise' });

  const totalRows: Partial<Record<string, React.ReactNode>> = {
    product_name: <strong>Totals</strong>,
    total_qty: <strong>{Number(summary.total_qty_sold ?? 0).toLocaleString()}</strong>,
    total_revenue: <strong>{formatCurrency(Number(summary.total_revenue ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Product-wise Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue and quantity sold per product/variant</p>
        </div>
        <ExportBar endpoint="/reports/sales/product-wise" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Unique Products" value={(summary.total_products as number ?? 0).toLocaleString()} icon={<Package />}   iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
        <KpiCard title="Total Qty Sold"  value={(summary.total_qty_sold as number ?? 0).toLocaleString()} icon={<BarChart3 />} iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Revenue"   value={formatCurrency(Number(summary.total_revenue ?? 0))}       icon={<DollarSign />} iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
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
        summaryRow={totalRows}
      />
    </div>
  );
}
