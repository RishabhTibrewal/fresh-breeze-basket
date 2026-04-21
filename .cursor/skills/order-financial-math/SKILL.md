# Skill: Order Financial Math Consistency

## When to use
- Any change that impacts totals on Orders, Quotations, POS orders, invoices, or payment summaries.
- Any feature touching discount, tax, extra charges, round-off, taxable value, or grand total.

## Trigger phrases
- "update totals"
- "fix tax or discount math"
- "round off mismatch"
- "quotation/order/POS amount mismatch"
- "edit `total_*`, `discount_*`, `tax_*`, `round_off_*`, or `taxable_value` fields"

## Non-negotiable guardrails
- Always use shared `calculateOrderTotals()` as the source of truth.
- Backend must use `backend/src/lib/orderCalculations.ts`.
- Frontend must use `frontend/src/lib/orderCalculations.ts` for live previews/UI totals.
- Never hand-roll parallel total formulas inside controllers/components.

## Canonical rule
If totals are calculated, delegated computation must go through `calculateOrderTotals()` and mapped output fields only.

## Implementation checklist
1. Locate calculation points
   - Search controller/component/service for ad-hoc formulas (`subtotal`, `tax`, `discount`, `roundOff`, `grandTotal`).
2. Replace ad-hoc math
   - Route all financial computation through `calculateOrderTotals()`.
   - Keep only data mapping/formatting around it.
3. Keep frontend/backend parity
   - Ensure both layers use equivalent inputs and interpretation:
     - line discounts
     - extra discount type/value
     - tax computation base
     - extra charges (tax-inclusive handling)
     - round-off strategy
4. Persist canonical values
   - Save computed fields from engine output (`subtotal`, `taxable_value`, `total_tax`, `total_extra_charges`, `round_off_amount`, `grand_total`, etc.) as applicable.
5. Guard edge cases
   - Zero quantity/zero tax lines.
   - Full discount and mixed tax rates.
   - Optional extra charges.
6. Verification
   - Compare one sample payload through frontend and backend; totals must match.
   - Validate displayed and persisted totals are identical (within standard rounding).

## Reference files
- `backend/src/lib/orderCalculations.ts`
- `frontend/src/lib/orderCalculations.ts`
- `backend/src/controllers/orderController.ts`
- `backend/src/controllers/quotationController.ts`
- `backend/src/controllers/pos.ts`
- `frontend/src/pages/sales/CreateOrder.tsx`
- `frontend/src/pages/sales/CreateQuotation.tsx`
- `frontend/src/pages/pos/CreatePOSOrder.tsx`

## Done criteria
- No custom total formulas remain in touched files.
- Frontend and backend totals are aligned through shared engine behavior.
- Totals shown to users match persisted backend totals.
