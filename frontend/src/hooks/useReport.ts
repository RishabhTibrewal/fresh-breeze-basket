import { useState, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchReport, type ReportFilter, type ReportResponse } from '@/api/reports';

interface UseReportOptions<T> {
  /** The backend endpoint path, e.g. '/reports/sales/order-summary' */
  endpoint: string;
  /** Initial filter values */
  defaultFilters?: Partial<ReportFilter>;
  /** Extra React Query options */
  enabled?: boolean;
  staleTime?: number;
}

interface UseReportReturn<T> {
  data: T[];
  summary: Record<string, number | string>;
  meta: ReportResponse<T>['meta'] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  filters: ReportFilter;
  setFilter: (key: keyof ReportFilter | string, value: unknown) => void;
  setFilters: (patch: Partial<ReportFilter>) => void;
  resetFilters: () => void;
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const DEFAULT_FILTERS: ReportFilter = {
  from_date: thirtyDaysAgo.toISOString().split('T')[0],
  to_date: today.toISOString().split('T')[0],
  branch_ids: [],
  page: 1,
  page_size: 50,
  sort_dir: 'desc',
  export: 'none',
  currency: 'AED',
};

export function useReport<T = Record<string, unknown>>({
  endpoint,
  defaultFilters,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
}: UseReportOptions<T>): UseReportReturn<T> {
  const [filters, setFiltersState] = useState<ReportFilter>({
    ...DEFAULT_FILTERS,
    ...defaultFilters,
  });

  const { data: response, isLoading, isFetching, error } = useQuery<ReportResponse<T>, Error>({
    queryKey: ['report', endpoint, filters],
    queryFn: () => fetchReport<T>(endpoint, filters),
    enabled,
    staleTime,
    placeholderData: keepPreviousData,
  });

  const setFilter = useCallback((key: string, value: unknown) => {
    setFiltersState((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const setFilters = useCallback((patch: Partial<ReportFilter>) => {
    setFiltersState((prev) => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS, ...defaultFilters });
  }, [defaultFilters]);

  return {
    data: response?.data ?? [],
    summary: response?.summary ?? {},
    meta: response?.meta,
    isLoading,
    isFetching,
    error,
    filters,
    setFilter,
    setFilters,
    resetFilters,
  };
}

export default useReport;
