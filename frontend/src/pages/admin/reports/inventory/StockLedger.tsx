import React from 'react';
import { ClipboardList, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';

interface StockLedgerRow {
  [key: string]: unknown;
  movement_id: string;
  movement_date: string;
  product_name: string;
  variant_name: string;
  sku: string;
  warehouse: string;
  movement_type: string;
  reference_type: string;
  quantity: number;
}

const MOVEMENT_COLORS: Record<string, string> = {
  in:        'bg-emerald-100 text-emerald-700',
  purchase:  'bg-emerald-100 text-emerald-700',
  grn:       'bg-blue-100 text-blue-700',
  out:       'bg-red-100 text-red-600',
  sale:      'bg-red-100 text-red-600',
  transfer:  'bg-amber-100 text-amber-700',
  adjustment:'bg-violet-100 text-violet-700',
  repack:    'bg-indigo-100 text-indigo-700',
};

const COLUMNS: ReportColumn<StockLedgerRow>[] = [
  { key: 'movement_date',  label: 'Date',      sortable: true },
  { key: 'product_name',   label: 'Product',   sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{String(row.variant_name)} · <span className="font-mono">{String(row.sku)}</span></p>
      </div>
    ),
  },
  { key: 'warehouse',      label: 'Branch' },
  {
    key: 'movement_type', label: 'Type',
    render: (v) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${MOVEMENT_COLORS[String(v).toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
        {String(v)}
      </span>
    ),
  },
  { key: 'reference_type', label: 'Reference', render: (v) => <span className="capitalize text-xs text-muted-foreground">{String(v)}</span> },
  {
    key: 'quantity', label: 'Qty', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      const cls = n > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold';
      return <span className={`font-mono ${cls}`}>{n > 0 ? '+' : ''}{n}</span>;
    },
  },
];

export default function StockLedger() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<StockLedgerRow>({ endpoint: '/reports/inventory/stock-ledger' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Ledger</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All stock movements for the selected period</p>
        </div>
        <ExportBar endpoint="/reports/inventory/stock-ledger" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total In"       value={`+${(summary.total_in as number ?? 0).toLocaleString()}`}  icon={<TrendingUp />}  iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Out"      value={`-${(summary.total_out as number ?? 0).toLocaleString()}`} icon={<TrendingDown />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
        <KpiCard title="Net Movement"   value={(summary.net_movement as number ?? 0).toLocaleString()}    icon={<Activity />}     iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
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
        emptyMessage="No stock movements for the selected period."
      />
    </div>
  );
}
