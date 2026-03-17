/**
 * exportRateLimiter.ts
 *
 * Lightweight in-memory rate limiter for PDF/Excel export endpoints.
 * Zero external dependencies — uses a sliding-window Map.
 *
 * Default: 10 export requests per user per minute.
 * Export endpoints are expensive (PDF/Excel generation), so this prevents abuse.
 *
 * Usage:
 *   router.get('/order-summary', protect, validateReportQuery, exportRateLimiter, handler);
 *   — OR apply to the whole /reports router in index.ts:
 *   app.use('/api/reports', exportRateLimiter, reportsRouter);
 *
 * The limiter only applies when `?export=pdf` or `?export=excel` is present.
 */

import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

const WINDOW_MS   = 60_000; // 1 minute sliding window
const MAX_EXPORTS = 10;      // max export requests per user per window

// Clean up old entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

export function exportRateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Only rate-limit actual export requests
  const exportType = (req.query.export as string) ?? 'none';
  if (exportType !== 'pdf' && exportType !== 'excel') {
    return next();
  }

  const userId = req.user?.id ?? req.ip ?? 'anonymous';
  const key    = `export:${userId}`;
  const now    = Date.now();

  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= MAX_EXPORTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      success: false,
      error:   'Too many export requests. Please wait before exporting again.',
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  entry.count++;
  return next();
}
