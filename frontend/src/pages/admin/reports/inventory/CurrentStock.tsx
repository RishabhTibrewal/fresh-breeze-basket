import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';

interface CurrentStockRow {
  [key: string]: unknown;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  warehouse: string;
  stock_count: number;
  reserved_stock: number;
  available_stock: number;
}

const COLUMNS: ReportColumn<CurrentStockRow>[] = [
  {
    key: 'product_name', label: 'Product', sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{String(row.variant_name)} · <span className="font-mono">{String(row.sku)}</span></p>
      </div>
    ),
  },
  { key: 'warehouse',       label: 'Branch'    },
  { key: 'stock_count',     label: 'On Hand',   align: 'right', sortable: true, render: (v) => Number(v).toLocaleString() },
  { key: 'reserved_stock',  label: 'Reserved',  align: 'right', render: (v) => Number(v).toLocaleString() },
  {
    key: 'available_stock', label: 'Available', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      const cls = n <= 0 ? 'text-red-600 font-bold' : n <= 10 ? 'text-amber-600 font-semibold' : 'text-emerald-700 font-semibold';
      return <span className={`font-mono ${cls}`}>{n.toLocaleString()}</span>;
    },
  },
  {
    key: 'available_stock', label: 'Status', className: 'w-24',
    render: (v) => {
      const n = Number(v);
      if (n <= 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of Stock</span>;
      if (n <= 10) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Low Stock</span>;
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">In Stock</span>;
    },
  },
];

export default function CurrentStock() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CurrentStockRow>({ endpoint: '/reports/inventory/current-stock' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Current Stock Position</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live on-hand and available stock across all branches</p>
        </div>
        <ExportBar endpoint="/reports/inventory/current-stock" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total SKUs"     value={(summary.total_skus as number ?? 0).toLocaleString()}        icon={<Package />}       iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Units"    value={(summary.total_units as number ?? 0).toLocaleString()}       icon={<Package />}       iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Out of Stock"   value={(summary.out_of_stock_skus as number ?? 0).toLocaleString()} icon={<AlertTriangle />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
        <KpiCard title="Low Stock ≤10"  value={(summary.low_stock_skus as number ?? 0).toLocaleString()}    icon={<AlertTriangle />} iconColor="bg-amber-50 text-amber-600"     isLoading={isLoading} />
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
      />
    </div>
  );
}
