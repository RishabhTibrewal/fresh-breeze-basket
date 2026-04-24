---
name: pos-itemwise-report
overview: Add an item-wise POS report in the POS Reports view with both on-screen visibility and export support, using the existing sales product-wise report endpoint scoped to POS orders.
todos:
  - id: wire-pos-itemwise-query
    content: Connect POS Reports filters to product-wise reports API with POS-only scope
    status: completed
  - id: render-itemwise-ui
    content: Add item-wise report section in POS Reports view with loading/empty/error states
    status: completed
  - id: add-itemwise-export
    content: Add item-wise export action and keep authenticated download flow
    status: completed
  - id: verify-and-lint
    content: Validate filter behavior and run lint diagnostics for touched files
    status: completed
isProject: false
---

# POS Item-wise Report in POS Analytics

## Approach

Implement the feature by reusing the existing product-wise reports backend (`/reports/sales/product-wise`) with POS filters (`order_source=pos`, date range, outlet, and optional session scope), then expose it in the POS Reports UI as both:

- a visible item-wise table/card list, and
- a downloadable export action.

This avoids introducing new SQL/migration work and keeps logic consistent with current reports architecture.

## Planned Changes

- Update [frontend/src/pages/pos/CreatePOSOrder.tsx](/Users/rishabhtibrewal/gulf frush/fresh-breeze-basket/frontend/src/pages/pos/CreatePOSOrder.tsx)
  - Add a dedicated item-wise report query tied to current POS report filters (`reportDateFrom`, `reportDateTo`, `selectedOutletId`, and `order_source=pos`).
  - Keep default scope aligned with current POS report filters (as selected): selected date range/outlet context.
  - Render a new “Item-wise Report” section in Reports view with key columns: item, SKU/variant, qty sold, avg price, revenue, orders count.
  - Add loading/empty/error states consistent with current POS analytics widgets.
  - Add export trigger for item-wise report (Excel) using authenticated blob download.
- Update [frontend/src/api/reports.ts](/Users/rishabhtibrewal/gulf frush/fresh-breeze-basket/frontend/src/api/reports.ts)
  - Add/confirm typed helper for `salesProductWise` usage from POS context.
  - Add lightweight item-wise row typing for safer UI mapping (no `any`).

## Filter/Scope Rules

- Always include POS-only scope: `order_source=pos`.
- Date filter source: `reportDateFrom`/`reportDateTo` (fallback to current day if unset, matching existing POS report UX).
- Outlet filter: map selected outlet to `branch_ids`.
- Session restriction:
  - For non-admin POS users, continue applying active `pos_session_id` restriction where currently enforced.
  - For users with broader access, allow date/outlet scope without forcing session filter.

## Validation

- Verify item-wise section updates when date or outlet filters change.
- Verify export downloads correctly and includes POS-scoped rows.
- Verify no regressions in existing Daily/Weekly/Monthly/Session order-summary downloads.
- Run lint diagnostics on edited frontend files and address any introduced issues.

## Notes

- No backend schema or route changes are required for this implementation because the existing sales product-wise report already supports the needed filters.
- Since behavior is additive and architecture-aligned, `ARCH_STATE.md` update is not required unless we decide to introduce a new dedicated POS report endpoint later.

