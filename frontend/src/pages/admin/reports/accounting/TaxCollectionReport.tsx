import React from 'react';
import { FileText, DollarSign } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface TaxCollectionRow {
  [key: string]: unknown;
  period: string;
  order_count: number;
  taxable_value: number;
  tax_collected: number;
}

const COLUMNS: ReportColumn<TaxCollectionRow>[] = [
  { key: 'period',        label: 'Period',         sortable: true },
  { key: 'order_count',   label: 'Orders',         align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'taxable_value', label: 'Taxable Value',  align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'tax_collected', label: 'Tax Collected',  align: 'right', sortable: true, render: (v) => <span className="font-semibold text-amber-700">{formatCurrency(Number(v))}</span> },
];

export default function TaxCollectionReport() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<TaxCollectionRow>({ endpoint: '/reports/accounting/tax-collection' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    period:        <strong>Totals</strong>,
    taxable_value: <strong>{formatCurrency(Number(summary.total_taxable_value ?? 0))}</strong>,
    tax_collected: <strong className="text-amber-700">{formatCurrency(Number(summary.total_tax_collected ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tax Collection Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tax collected on sales by period (GST/VAT)</p>
        </div>
        <ExportBar endpoint="/reports/accounting/tax-collection" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard title="Total Taxable Value" value={formatCurrency(Number(summary.total_taxable_value ?? 0))} icon={<FileText />}   iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Tax Collected" value={formatCurrency(Number(summary.total_tax_collected ?? 0))} icon={<DollarSign />} iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
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
        emptyMessage="No tax data found for the selected period."
      />
    </div>
  );
}
