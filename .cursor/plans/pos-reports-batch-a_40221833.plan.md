---
name: pos-reports-batch-a
overview: Ship the six high-impact POS analytics reports (Hourly Heatmap, Payment Mix, Fulfillment Mix, Discount Impact, Cashier/Session Performance, Refunds/Returns) as a single batch — each with a backend endpoint, a full-page report in the Reports module, and a matching widget in the POS Analytics panel that reuses existing POS filters.
todos:
  - id: permissions-migration
    content: Add 5 new report permission codes (hourly_heatmap, payment_mix, fulfillment_mix, discount_impact, cashier_performance) via an idempotent seed migration + role_permissions grants
    status: completed
  - id: backend-hourly-heatmap
    content: Implement getHourlyHeatmap service + controller + route /reports/sales/hourly-heatmap with export support
    status: completed
  - id: backend-payment-mix
    content: Implement getPaymentMix service (split-aware via payments table) + controller + route /reports/sales/payment-mix
    status: completed
  - id: backend-fulfillment-mix
    content: Implement getFulfillmentMix service + controller + route /reports/sales/fulfillment-mix
    status: completed
  - id: backend-discount-impact
    content: Implement getDiscountImpact service (gross/line_disc/extra_disc/cd/net per outlet) + controller + route /reports/sales/discount-impact
    status: completed
  - id: backend-cashier-perf
    content: Implement getCashierPerformance service (pos_sessions + aggregated orders + cash variance) + controller + route /reports/sales/cashier-performance under pos.cashier_performance.view permission
    status: completed
  - id: backend-returns-enhance
    content: Enhance getSalesReturns to honor order_source/branch_ids/pos_session_id and enrich with outlet_name, items_count, reason
    status: completed
  - id: frontend-api-helpers
    content: Extend frontend/src/api/reports.ts with typed row interfaces and reportsApi methods for the 5 new endpoints
    status: completed
  - id: frontend-full-pages
    content: Create 5 full-page reports under frontend/src/pages/admin/reports/sales/ using existing KpiCard/ReportFilters/ReportTable/ExportBar primitives + Chart.js doughnuts where needed
    status: completed
  - id: frontend-routing-dashboard
    content: Register lazy routes in App.tsx and add REPORT_LINKS entries in SalesReportsDashboard.tsx
    status: completed
  - id: pos-analytics-widgets
    content: Add 6 new widget sections under activeView==='reports' in CreatePOSOrder.tsx, each using reportDisplayFilters/buildPosReportFilters, matching the dark theme, with loading/empty/error states and export buttons
    status: completed
  - id: verify-and-lint
    content: Run ReadLints on touched files, fix any new issues, and visually verify each widget renders against the current POS dataset (47 orders, 8 sessions, 6 returns)
    status: completed
  - id: arch-state-offer
    content: Offer the ARCH_STATE.md update text for the 5 new report endpoints + permission codes
    status: completed
isProject: false
---

# POS High-Impact Reports (Batch of 6)

## Data model notes (verified via Supabase MCP)

- `orders` has `order_source`, `fulfillment_type` (pickup/cash_counter/delivery), `payment_method` (cash/card/upi/split), `extra_discount_amount`, `total_discount`, `pos_session_id`, `sales_executive_id`, `order_type='return'` with `original_order_id`.
- `order_items` has `discount_amount` / `discount_percentage` / `line_total`.
- `payments` has per-line `payment_method` + `amount` (used when `orders.payment_method='split'`).
- `pos_sessions` has `cashier_id`, `opening_cash`, `closing_cash`, `expected_cash`, `opened_at`, `closed_at`, `status`.
- Returns already modelled as `orders` rows with `order_type='return'` + `original_order_id`.

## Shared design principles

- Every new endpoint reuses `ReportQuery` (`validateReportQuery` middleware) and honors `order_source`, `branch_ids`, `pos_session_id`, `from_date`, `to_date` so the same service can power both the POS Analytics widget (POS-scoped) and the full Reports page (company-wide, any source).
- Every new POS widget reuses `buildPosReportFilters(reportPeriod)` already defined in [frontend/src/pages/pos/CreatePOSOrder.tsx](frontend/src/pages/pos/CreatePOSOrder.tsx) so period toggle + date range + outlet + session filters continue to drive all widgets consistently.
- Full-page reports reuse existing primitives: `KpiCard`, `ReportFilters`, `ReportTable`, `ExportBar` under [frontend/src/components/reports/](frontend/src/components/reports/).
- No new chart libraries: Chart.js is already registered; heatmap will use a CSS grid (7×24) colored by revenue intensity.

## 1. Backend: 5 new endpoints + 1 enhancement

Single service file modified: [backend/src/services/reports/salesReportService.ts](backend/src/services/reports/salesReportService.ts). Each function follows the pattern of the existing `getProductWiseSales` — one query with join to `orders` and conditional `.eq()` for `order.order_source` / `order.pos_session_id` / `order.outlet_id in (...)`.

- `**getHourlyHeatmap(q, companyId)**` → rows `{ weekday, hour, order_count, revenue }` (49-bucket matrix) + summary `{ peak_hour, peak_weekday, total_orders }`.
- `**getPaymentMix(q, companyId)**` → `[{ payment_method, order_count, amount, share_pct }]`. For orders where `payment_method != 'split'`, count that method for the full `total_amount`. For split orders, join `payments` and aggregate by `payments.payment_method` for the actual tendered amount.
- `**getFulfillmentMix(q, companyId)**` → `[{ fulfillment_type, order_count, revenue, avg_order_value, share_pct }]`.
- `**getDiscountImpact(q, companyId)**` → rows per outlet/cashier `{ outlet_name, gross_sales, line_discount, extra_discount, cd_amount, total_discount, net_sales, discount_rate_pct, orders_with_discount }` + summary totals.
- `**getCashierPerformance(q, companyId)**` → joins `pos_sessions` with aggregated `orders` per session: `{ session_id, cashier_name, outlet_name, opened_at, closed_at, duration_min, orders_count, gross_sales, avg_ticket, cash_variance }`. Honors date filter on `opened_at`.
- **Enhance `getSalesReturns`** → add `order_source`, `branch_ids`, `pos_session_id` filters + enrich rows with `outlet_name`, `items_count`, `reason` (via join to `credit_notes` when present), + summary breakdown by reason.

New controllers in [backend/src/controllers/reports/salesReportController.ts](backend/src/controllers/reports/salesReportController.ts) (one per service function, following existing `buildReportResponse` pattern with xlsx export).

Routes in [backend/src/routes/reports/salesReports.ts](backend/src/routes/reports/salesReports.ts):

```ts
router.get('/hourly-heatmap',   protect, validateReportQuery, requireReportPermission('sales.hourly_heatmap.view'),   hourlyHeatmap);
router.get('/payment-mix',      protect, validateReportQuery, requireReportPermission('sales.payment_mix.view'),      paymentMix);
router.get('/fulfillment-mix',  protect, validateReportQuery, requireReportPermission('sales.fulfillment_mix.view'),  fulfillmentMix);
router.get('/discount-impact',  protect, validateReportQuery, requireReportPermission('sales.discount_impact.view'),  discountImpact);
router.get('/cashier-performance', protect, validateReportQuery, requireReportPermission('pos.cashier_performance.view'), cashierPerformance);
```

## 2. Permissions migration

New file: `backend/src/db/migrations/20260423_add_high_impact_report_permissions.sql` (idempotent `INSERT ... ON CONFLICT (code) DO NOTHING`) — follows [backend/src/db/migrations/20260317_001_report_permissions_seed.sql](backend/src/db/migrations/20260317_001_report_permissions_seed.sql). Seeds the 5 new permission codes above, grants to `admin` role (and `sales_manager` where applicable) via `role_permissions`.

## 3. Frontend API wrapper

[frontend/src/api/reports.ts](frontend/src/api/reports.ts) — add typed rows (`HourlyHeatmapRow`, `PaymentMixRow`, `FulfillmentMixRow`, `DiscountImpactRow`, `CashierPerformanceRow`) and helpers on `reportsApi`:

```ts
salesHourlyHeatmap, salesPaymentMix, salesFulfillmentMix,
salesDiscountImpact, posCashierPerformance
```

## 4. Full-page reports (Reports module)

New pages under [frontend/src/pages/admin/reports/sales/](frontend/src/pages/admin/reports/sales/) using the same scaffold as [ProductWiseSales.tsx](frontend/src/pages/admin/reports/sales/ProductWiseSales.tsx):

- `HourlySalesHeatmap.tsx` — KPI row (Peak Hour / Peak Day / Orders) + 7-row × 24-col CSS grid heatmap (Tailwind opacity-scaled cells, tooltip on hover).
- `PaymentMethodMix.tsx` — KPI row + Chart.js `Doughnut` + breakdown table.
- `FulfillmentMix.tsx` — KPI row + Chart.js `Doughnut` + table.
- `DiscountImpact.tsx` — KPI row (Gross → Net, Discount %, Orders with Discount) + table by outlet.
- `CashierPerformance.tsx` — KPI row (Sessions, Total Sales, Cash Variance) + `ReportTable` listing sessions.
- Existing `SalesReturns.tsx` (or equivalent) — retain; enhanced backend will automatically expose new fields.

Wire up in:

- [frontend/src/App.tsx](frontend/src/App.tsx) — 5 new `lazy()` imports + `<Route>` entries under `/admin/reports/sales/*`.
- [frontend/src/pages/admin/reports/sales/SalesReportsDashboard.tsx](frontend/src/pages/admin/reports/sales/SalesReportsDashboard.tsx) — 5 new `REPORT_LINKS` entries (icons: `Clock`, `CreditCard`, `Truck`, `Tag`, `UserCheck`).

## 5. POS Analytics widgets (single file)

[frontend/src/pages/pos/CreatePOSOrder.tsx](frontend/src/pages/pos/CreatePOSOrder.tsx) `activeView === 'reports'` block — add 6 new widget sections below the existing Item-wise Report, each matching the existing dark theme (`bg-[#1a1d27]`, `border-white/10`, `rounded-3xl`):

- **Hourly Sales Heatmap** — compact 7×24 CSS-grid visualisation, shares `reportPeriod` toggle.
- **Payment Method Mix** — Chart.js Doughnut + small legend/table.
- **Fulfillment Type Breakdown** — horizontal stacked bar or mini-doughnut + counts.
- **Discount Impact** — 4-KPI strip (Gross, Total Discount, Net, Discount % of Gross) + sparkline if time permits.
- **Cashier / Session Performance** — sessions table (cashier, orders, sales, variance). Hidden for non-admin (`!canViewAllPosSessions`) and only shown for admin/manager.
- **Refunds / Returns** — table of return orders (date, original order #, items, amount, reason) with "View in Reports" deep link.

Every widget uses a dedicated React Query (`queryKey` includes `reportDisplayFilters`) with `enabled: activeView === 'reports'`, and a common export button that calls `downloadReport` for that endpoint.

## 6. Anti-hallucination checkpoints

- All service functions must `.eq('order.company_id', companyId)` on the joined orders relation (matches fixed pattern from [backend/src/services/reports/salesReportService.ts](backend/src/services/reports/salesReportService.ts) `getProductWiseSales`).
- No new tables. Only a permissions seed migration.
- No changes to `reportValidator.ts` — existing `ReportQuery` already covers every filter we need.
- After merge, `ARCH_STATE.md` will need to be updated with the 5 new report endpoints + permissions.

## Phasing inside the batch (execution order)

1. Permissions migration.
2. Backend service + controller + route wiring for all 5 new endpoints, + enhancement to `getSalesReturns`.
3. `reportsApi` typed helpers in [frontend/src/api/reports.ts](frontend/src/api/reports.ts).
4. Five new full-page report components + `App.tsx` routes + `SalesReportsDashboard` links.
5. Six new widgets in `CreatePOSOrder.tsx`.
6. Lint pass on touched files; smoke test of each widget against the current POS dataset (47 POS orders, 8 sessions, 6 returns — sufficient to visually verify each widget renders non-empty).
7. Offer `ARCH_STATE.md` update text.

