import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReportMeta } from '@/api/reports';

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------
export interface ReportColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ReportTableProps<T = Record<string, unknown>> {
  columns: ReportColumn<T>[];
  data: T[];
  isLoading?: boolean;
  isFetching?: boolean;
  meta?: ReportMeta;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onPageChange?: (page: number) => void;
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  /** Optional single totals / summary row rendered at the bottom */
  summaryRow?: Partial<Record<string, React.ReactNode>>;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ReportTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading,
  isFetching,
  meta,
  sortBy,
  sortDir,
  onPageChange,
  onSortChange,
  summaryRow,
  emptyMessage = 'No data found for the selected filters.',
}: ReportTableProps<T>) {
  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable || !onSortChange) return;
    const newDir = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
    onSortChange(key, newDir);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortBy !== colKey) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ChevronDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  return (
    <div className="w-full space-y-2">
      {/* Fetching indicator bar */}
      {isFetching && !isLoading && (
        <div className="h-0.5 w-full rounded-full bg-primary/20 overflow-hidden">
          <div className="h-full w-1/3 bg-primary rounded-full animate-[loader_1.2s_ease-in-out_infinite]" />
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`text-xs font-semibold whitespace-nowrap px-3 py-2.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.sortable ? 'cursor-pointer select-none' : ''} ${col.className ?? ''}`}
                  onClick={() => handleSort(col.key, col.sortable)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Skeleton rows
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {data.map((row, idx) => (
                  <TableRow key={(row.id as string) ?? idx} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right font-mono tabular-nums' : col.align === 'center' ? 'text-center' : ''} ${col.className ?? ''}`}
                      >
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {/* Summary / totals row */}
                {summaryRow && (
                  <TableRow className="bg-slate-900 text-white font-semibold border-t-2 border-slate-700">
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`px-3 py-2.5 text-sm text-white ${col.align === 'right' ? 'text-right font-mono tabular-nums' : col.align === 'center' ? 'text-center' : ''}`}
                      >
                        {summaryRow[col.key] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span>
            Showing {((meta.page - 1) * meta.page_size) + 1}–{Math.min(meta.page * meta.page_size, meta.total)} of{' '}
            <strong className="text-foreground">{meta.total.toLocaleString()}</strong> results
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={meta.page <= 1}
              onClick={() => onPageChange?.(meta.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs">
              Page {meta.page} of {meta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={meta.page >= meta.total_pages}
              onClick={() => onPageChange?.(meta.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportTable;
