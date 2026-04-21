# Skill: Inventory Mutation Safety

## When to use
- Any change touching inventory reservation, stock updates, order stock flow, repack, or stock movement creation.

## Trigger phrases
- "stock count incorrect"
- "inventory deduction bug"
- "reserveStock change"
- "stock movement mismatch"

## Non-negotiable guardrails
- Never mutate `stock_count` during reservation on order creation.
- Never mutate `stock_count` without creating a `stock_movements` record.
- Preserve tenant boundaries (`company_id` filter) in every inventory query.

## Canonical flow
1. Order creation (`pending`)
   - Reserve stock only (`reserved_stock`).
   - Do not create sale movement or decrease `stock_count`.
2. Order status progression
   - Create movement first (`stock_movements`).
   - Then update `warehouse_inventory.stock_count`.
   - Release/decrement `reserved_stock` accordingly.
3. POS special case
   - Follow documented POS direct subtraction behavior where applicable.
   - Keep movement logs consistent and atomic.

## Implementation checklist
1. Touchpoints
   - Inspect `InventoryService`, `OrderService`, and affected controllers.
2. Reservation path validation
   - Ensure reserve functions only adjust `reserved_stock`.
   - Use `.maybeSingle()` where missing warehouse rows are possible.
3. Movement path validation
   - Ensure each stock count mutation is paired with a movement row.
   - Confirm movement type correctness (`SALE`, `REPACK_OUT`, `REPACK_IN`, etc.).
4. Company isolation
   - Include `company_id` constraints in reads/writes.
5. Recovery/error handling
   - Keep operations transactional where feasible.
   - Fail safely without silent stock drift.
6. Verification
   - Test create-order, status change, and one failure path.
   - Confirm inventory ledger and on-hand counts stay in sync.

## Reference files
- `backend/src/services/core/InventoryService.ts`
- `backend/src/services/core/OrderService.ts`
- `backend/src/controllers/pos.ts`
- `backend/src/controllers/orders.ts`
- `backend/src/controllers/orderController.ts`

## Done criteria
- Reservation path never touches `stock_count`.
- Movement-backed updates maintain inventory consistency.
- Tenant isolation is preserved in all inventory-related queries.
