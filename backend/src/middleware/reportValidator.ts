import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared report query parameter schema
// ---------------------------------------------------------------------------
const ReportQuerySchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from_date must be YYYY-MM-DD').optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to_date must be YYYY-MM-DD').optional(),
  // branch_ids can be a single string or comma-separated list
  branch_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  page_size: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(500, Math.max(1, parseInt(v, 10))) : 50)),
  sort_by: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).optional().default('desc'),
  export: z.enum(['pdf', 'excel', 'none']).optional().default('none'),
  currency: z.string().length(3).optional().default('AED'),
  // Optional single string search
  search: z.string().optional(),
  // POS filtering
  order_source: z.string().optional(),
  pos_session_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------
export type ReportQuery = {
  from_date: string;
  to_date: string;
  branch_ids: string[];
  page: number;
  page_size: number;
  sort_by?: string;
  sort_dir: 'asc' | 'desc';
  export: 'pdf' | 'excel' | 'none';
  currency: string;
  search?: string;
  order_source?: string;
  pos_session_id?: string;
};

// Extend Express Request to carry the parsed query
declare global {
  namespace Express {
    interface Request {
      reportQuery?: ReportQuery;
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export const validateReportQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const rawQuery = req.query as Record<string, unknown>;
    const parsed = ReportQuerySchema.safeParse(rawQuery);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid report query parameters',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const data = parsed.data;

    // Default date range: last 30 days
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 30);

    req.reportQuery = {
      from_date: data.from_date ?? defaultFrom.toISOString().split('T')[0],
      to_date: data.to_date ?? today.toISOString().split('T')[0],
      branch_ids: data.branch_ids ?? [],
      page: data.page,
      page_size: data.page_size,
      sort_by: data.sort_by,
      sort_dir: data.sort_dir,
      export: data.export,
      currency: data.currency,
      search: data.search,
      order_source: data.order_source,
      pos_session_id: data.pos_session_id,
    };

    next();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Helper: build page offset for Supabase range queries
// ---------------------------------------------------------------------------
export const getPageRange = (page: number, pageSize: number): { from: number; to: number } => ({
  from: (page - 1) * pageSize,
  to: page * pageSize - 1,
});

// ---------------------------------------------------------------------------
// Helper: standard report response wrapper
// ---------------------------------------------------------------------------
export interface ReportMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ReportResponse<T> {
  success: true;
  report_key: string;
  report_title: string;
  generated_at: string;
  filters_applied: Partial<ReportQuery>;
  meta: ReportMeta;
  summary: Record<string, number | string>;
  data: T[];
}

export function buildReportResponse<T>(opts: {
  reportKey: string;
  reportTitle: string;
  filters: Partial<ReportQuery>;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  summary?: Record<string, number | string>;
}): ReportResponse<T> {
  return {
    success: true,
    report_key: opts.reportKey,
    report_title: opts.reportTitle,
    generated_at: new Date().toISOString(),
    filters_applied: opts.filters,
    meta: {
      total: opts.total,
      page: opts.page,
      page_size: opts.pageSize,
      total_pages: Math.ceil(opts.total / opts.pageSize),
    },
    summary: opts.summary ?? {},
    data: opts.data,
  };
}
