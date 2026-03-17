/**
 * refreshMaterialisedViews.ts
 *
 * Nightly scheduler that refreshes reporting materialized views via the
 * `public.refresh_materialized_view(view_name)` SQL function (applied in
 * migration `create_refresh_materialized_view_rpc`).
 *
 * Uses setInterval — same pattern as the existing invoice/order schedulers.
 * To add more views, append to MV_NAMES.
 */

import { supabaseAdmin, supabase } from '../config/supabase';

const MV_NAMES = ['mv_sales_daily'];

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function refreshAllViews(): Promise<void> {
  const client = supabaseAdmin ?? supabase;

  for (const mv of MV_NAMES) {
    try {
      const { error } = await client.rpc('refresh_materialized_view', { view_name: mv });
      if (error) {
        console.warn(`[MV Refresh] ⚠️  Could not refresh "${mv}": ${error.message}`);
      } else {
        console.log(`[MV Refresh] ✅  "${mv}" refreshed successfully.`);
      }
    } catch (err: any) {
      // Never crash the server — just log and move on
      console.error(`[MV Refresh] ❌  Unexpected error refreshing "${mv}":`, err?.message ?? err);
    }
  }
}

/**
 * Start the nightly MV refresh scheduler.
 * Called once from index.ts on server start.
 */
export async function initMVRefreshScheduler(): Promise<void> {
  console.log('[MV Refresh] Scheduler started — views will refresh every 24 hours.');

  // Run immediately on startup so data is fresh after a server restart
  await refreshAllViews();

  setInterval(async () => {
    try {
      await refreshAllViews();
    } catch (err: any) {
      console.error('[MV Refresh] Interval error:', err?.message ?? err);
    }
  }, REFRESH_INTERVAL_MS);
}
