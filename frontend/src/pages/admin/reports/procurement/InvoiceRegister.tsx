import React from 'react';
import { FileText, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface InvoiceRegisterRow {
  [key: string]: unknown;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  grn_number: string;
  supplier_name: string;
  subtotal: number;
  total_tax: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid:       'bg-emerald-100 text-emerald-700',
  partial:    'bg-amber-100 text-amber-700',
  pending:    'bg-blue-100 text-blue-700',
  overdue:    'bg-red-100 text-red-600',
  cancelled:  'bg-gray-100 text-gray-500',
};

const COLUMNS: ReportColumn<InvoiceRegisterRow>[] = [
  { key: 'invoice_date',   label: 'Date',        sortable: true },
  {
    key: 'invoice_number', label: 'Invoice #',   sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm font-mono">{String(v)}</p>
        <p className="text-xs text-muted-foreground">GRN: {String(row.grn_number)}</p>
      </div>
    ),
  },
  { key: 'supplier_name',  label: 'Supplier',    sortable: true },
  { key: 'subtotal',       label: 'Subtotal',    align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'total_tax',     label: 'Tax',         align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'total_amount',   label: 'Total',       align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'paid_amount',    label: 'Paid',        align: 'right', render: (v) => <span className="text-emerald-700">{formatCurrency(Number(v))}</span> },
  {
    key: 'outstanding', label: 'Outstanding', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      const cls = n > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600';
      return <span className={`font-mono ${cls}`}>{formatCurrency(n)}</span>;
    },
  },
  {
    key: 'status', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>{String(v)}</span>,
  },
];

export default function InvoiceRegister() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<InvoiceRegisterRow>({ endpoint: '/reports/procurement/invoice-register' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    invoice_date: <strong>Totals</strong>,
    total_amount: <strong>{formatCurrency(Number(summary.total_amount ?? 0))}</strong>,
    paid_amount:  <strong className="text-emerald-700">{formatCurrency(Number(summary.total_paid ?? 0))}</strong>,
    outstanding:  <strong className="text-red-600">{formatCurrency(Number(summary.total_outstanding ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchase Invoice Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All purchase invoices with payment status</p>
        </div>
        <ExportBar endpoint="/reports/procurement/invoice-register" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Invoices"   value={(summary.total_invoices as number ?? 0).toLocaleString()}      icon={<FileText />}    iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Total Amount"     value={formatCurrency(Number(summary.total_amount ?? 0))}             icon={<DollarSign />}  iconColor="bg-emerald-50 text-emerald-600"  isLoading={isLoading} />
        <KpiCard title="Total Paid"       value={formatCurrency(Number(summary.total_paid ?? 0))}               icon={<Clock />}       iconColor="bg-green-50 text-green-600"     isLoading={isLoading} />
        <KpiCard title="Outstanding"      value={formatCurrency(Number(summary.total_outstanding ?? 0))}        icon={<AlertCircle />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
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
