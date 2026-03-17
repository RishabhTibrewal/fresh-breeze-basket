import React from 'react';
import { CreditCard, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface PaymentCollectionRow {
  [key: string]: unknown;
  payment_id: string;
  payment_date: string;
  order_id: string;
  payment_method: string;
  amount: number;
  status: string;
  transaction_id: string;
  cheque_no: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  paid:      'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
  refunded:  'bg-gray-100 text-gray-500',
};

const METHOD_ICONS: Record<string, string> = {
  cash:          '💵',
  bank_transfer: '🏦',
  upi:           '📱',
  cheque:        '📄',
  card:          '💳',
};

const COLUMNS: ReportColumn<PaymentCollectionRow>[] = [
  { key: 'payment_date',   label: 'Date',       sortable: true },
  {
    key: 'payment_method', label: 'Method',
    render: (v) => <span className="capitalize">{METHOD_ICONS[String(v)] ?? '💳'} {String(v).replace('_', ' ')}</span>,
  },
  { key: 'transaction_id', label: 'Txn ID',     render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
  { key: 'cheque_no',      label: 'Cheque No',  render: (v) => <span className="text-xs text-muted-foreground">{String(v) === '—' ? '' : String(v)}</span> },
  { key: 'amount',         label: 'Amount',     align: 'right', sortable: true, render: (v) => <span className="font-semibold font-mono">{formatCurrency(Number(v))}</span> },
  {
    key: 'status', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>{String(v)}</span>,
  },
];

export default function PaymentCollections() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<PaymentCollectionRow>({ endpoint: '/reports/accounting/payment-collections' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    payment_date: <strong>Totals</strong>,
    amount: <strong className="text-emerald-700">{formatCurrency(Number(summary.total_amount ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payment Collections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Customer payment receipts by method and status</p>
        </div>
        <ExportBar endpoint="/reports/accounting/payment-collections" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Payments"  value={(summary.total_payments as number ?? 0).toLocaleString()}      icon={<CreditCard />}  iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Total Amount"    value={formatCurrency(Number(summary.total_amount ?? 0))}             icon={<DollarSign />}  iconColor="bg-emerald-50 text-emerald-600"  isLoading={isLoading} />
        <KpiCard title="Collected"       value={formatCurrency(Number(summary.total_collected ?? 0))}          icon={<CheckCircle />} iconColor="bg-green-50 text-green-600"     isLoading={isLoading} />
        <KpiCard title="Pending"         value={formatCurrency(Number(summary.total_pending ?? 0))}            icon={<Clock />}       iconColor="bg-amber-50 text-amber-600"     isLoading={isLoading} />
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
        emptyMessage="No payments found for the selected period."
      />
    </div>
  );
}
