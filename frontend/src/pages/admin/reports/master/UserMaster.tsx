import React from 'react';
import { UserCog } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';

interface UserMasterRow {
  [key: string]: unknown;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role_name: string;
  role_display: string;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-red-100 text-red-700',
  manager:     'bg-violet-100 text-violet-700',
  sales:       'bg-blue-100 text-blue-700',
  inventory:   'bg-emerald-100 text-emerald-700',
  procurement: 'bg-amber-100 text-amber-700',
};

const COLUMNS: ReportColumn<UserMasterRow>[] = [
  {
    key: 'full_name', label: 'Name', sortable: true,
    render: (_v, row) => (
      <div>
        <p className="font-medium text-sm">{String(row.full_name)}</p>
        <p className="text-xs text-muted-foreground">{String(row.email)}</p>
      </div>
    ),
  },
  { key: 'phone',        label: 'Phone' },
  {
    key: 'role_display', label: 'Role',
    render: (v, row) => {
      const key = String(row.role_name).toLowerCase();
      const cls = ROLE_COLORS[key] ?? 'bg-gray-100 text-gray-600';
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{String(v)}</span>;
    },
  },
  { key: 'created_at', label: 'Joined', sortable: true },
];

export default function UserMaster() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<UserMasterRow>({ endpoint: '/reports/master/users', defaultFilters: { page_size: 25 } });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Master List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All users and their assigned roles</p>
        </div>
        <ExportBar endpoint="/reports/master/users" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
        <KpiCard title="Total Users" value={(summary.total_users as number ?? 0).toLocaleString()} icon={<UserCog />} iconColor="bg-amber-50 text-amber-600" isLoading={isLoading} />
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
        emptyMessage="No users found."
      />
    </div>
  );
}
