import apiClient from '@/lib/apiClient';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export interface ReportFilter {
  from_date?: string;       // YYYY-MM-DD
  to_date?: string;         // YYYY-MM-DD
  branch_ids?: string[];    // warehouse IDs
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  export?: 'pdf' | 'excel' | 'none';
  currency?: string;
  search?: string;
  [key: string]: unknown;   // allow module-specific params
}

export interface ReportMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ReportResponse<T = Record<string, unknown>> {
  success: true;
  report_key: string;
  report_title: string;
  generated_at: string;
  filters_applied: ReportFilter;
  meta: ReportMeta;
  summary: Record<string, number | string>;
  data: T[];
}

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------
export async function fetchReport<T = Record<string, unknown>>(
  endpoint: string,
  filters?: ReportFilter
): Promise<ReportResponse<T>> {
  // Flatten branch_ids array → comma-sep string for query string
  const params: Record<string, unknown> = { ...filters };
  if (Array.isArray(filters?.branch_ids)) {
    params.branch_ids = filters!.branch_ids.join(',');
  }
  const { data } = await apiClient.get<ReportResponse<T>>(endpoint, { params });
  return data;
}

// ---------------------------------------------------------------------------
// Export download helper (triggers file download in browser)
// ---------------------------------------------------------------------------
export async function downloadReport(
  endpoint: string,
  format: 'pdf' | 'excel',
  filters?: ReportFilter
): Promise<void> {
  const params: Record<string, unknown> = { ...filters, export: format };
  if (Array.isArray(filters?.branch_ids)) {
    params.branch_ids = (filters!.branch_ids as string[]).join(',');
  }

  const response = await apiClient.get(endpoint, {
    params,
    responseType: 'blob',
  });

  const contentDisposition = response.headers['content-disposition'] as string | undefined;
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

  const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Module-specific typed fetchers (add more as modules are implemented)
// ---------------------------------------------------------------------------
export const reportsApi = {
  // Sales
  salesOrderSummary: (f?: ReportFilter) => fetchReport('/reports/sales/order-summary', f),
  salesSalespersonPerformance: (f?: ReportFilter) => fetchReport('/reports/sales/salesperson-performance', f),
  salesCustomerWise: (f?: ReportFilter) => fetchReport('/reports/sales/customer-wise', f),
  salesProductWise: (f?: ReportFilter) => fetchReport('/reports/sales/product-wise', f),
  salesTargetVsAchievement: (f?: ReportFilter) => fetchReport('/reports/sales/target-vs-achievement', f),
  salesPendingDeliveries: (f?: ReportFilter) => fetchReport('/reports/sales/pending-deliveries', f),
  salesReturns: (f?: ReportFilter) => fetchReport('/reports/sales/returns', f),
  salesPriceVariance: (f?: ReportFilter) => fetchReport('/reports/sales/price-variance', f),
  salesRegionTerritory: (f?: ReportFilter) => fetchReport('/reports/sales/region-territory', f),

  // Inventory
  stockLedger: (f?: ReportFilter) => fetchReport('/reports/inventory/stock-ledger', f),
  currentStock: (f?: ReportFilter) => fetchReport('/reports/inventory/current-stock', f),
  repackSummary: (f?: ReportFilter) => fetchReport('/reports/inventory/repack-summary', f),
  repackCostAnalysis: (f?: ReportFilter) => fetchReport('/reports/inventory/repack-cost-analysis', f),
  wastageReport: (f?: ReportFilter) => fetchReport('/reports/inventory/wastage', f),
  recipeEfficiency: (f?: ReportFilter) => fetchReport('/reports/inventory/recipe-efficiency', f),

  // Procurement
  poRegister: (f?: ReportFilter) => fetchReport('/reports/procurement/po-register', f),
  vendorWise: (f?: ReportFilter) => fetchReport('/reports/procurement/vendor-wise', f),
  grnReport: (f?: ReportFilter) => fetchReport('/reports/procurement/grn', f),
  invoiceAgeing: (f?: ReportFilter) => fetchReport('/reports/procurement/invoice-ageing', f),
  pendingReceipts: (f?: ReportFilter) => fetchReport('/reports/procurement/pending-receipts', f),
  rateComparison: (f?: ReportFilter) => fetchReport('/reports/procurement/rate-comparison', f),
};

export default reportsApi;
