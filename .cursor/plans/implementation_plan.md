# Repacking (Job Work) Module — Implementation Plan

This plan upgrades the existing skeleton repack module into a fully functional Job Work (bulk→retail repacking) system with price calculation, inventory deduction, weighted-average cost updating, and a redesigned frontend.

## What Already Exists (don't touch)
- `repack_orders` + `repack_order_items` + `packaging_recipes` tables ✅
- Backend controller functions: create/get/update/delete/process repack orders ✅
- Route: `POST /api/inventory/repack-orders/:id/process` calls `process_repack_order` RPC ✅
- Frontend route: `/inventory/repack-orders` → [RepackOrders.tsx](file:///Users/rishabhtibrewal/gulf%20frush/fresh-breeze-basket/frontend/src/pages/admin/RepackOrders.tsx) ✅

## What Needs to Be Built

---

### 1. Schema Migrations

#### [NEW] `20260317_add_repack_cost_fields.sql`
`backend/src/db/migrations/`

```sql
-- Add cost & wastage columns to repack_order_items
ALTER TABLE public.repack_order_items
  ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost         NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_cost_per_unit NUMERIC NOT NULL DEFAULT 0;

-- Add wastage & cost columns to packaging_recipes
ALTER TABLE public.packaging_recipes
  ADD COLUMN IF NOT EXISTS wastage_per_input       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_cost_per_unit NUMERIC NOT NULL DEFAULT 0;
```
No new RLS needed — existing policies on both tables cover new columns automatically.

---

### 2. Upgraded Postgres RPC

#### [NEW] `20260317_create_process_repack_order_v2.sql`
`backend/src/db/migrations/`

Replaces the existing `process_repack_order` RPC (or creates `v2`) with the full business logic:

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.process_repack_order(
  p_repack_order_id UUID,
  p_company_id      UUID,
  p_created_by      UUID DEFAULT NULL
) RETURNS JSONB
```

**Algorithm inside the RPC:**
1. Validate order exists + status is `draft`
2. For each item row (input_product_id, input_variant_id, input_quantity, wastage_quantity, additional_cost_per_unit, output_product_id, output_variant_id):
   - Fetch `input_variant.unit` (numeric capacity per bag) and `product_prices.sale_price` for that variant
   - Compute:
     ```
     usable      = variant.unit × input_quantity − wastage_quantity
     output_qty  = FLOOR(usable / target_size)   -- target_size stored as additional field OR derived from output variant unit
     actual_wastage = (variant.unit × input_quantity) − (output_qty × target_size)
     total_raw_cost = input_quantity × sale_price
     base_cost_per_output = total_raw_cost / output_qty
     final_unit_cost = base_cost_per_output + additional_cost_per_unit
     ```
   - UPDATE `repack_order_items` with computed `wastage_quantity`, `unit_cost`
   - Check sufficient input stock in `warehouse_inventory`
   - INSERT `stock_movements` REPACK_OUT (negative)
   - UPDATE `warehouse_inventory` −input_quantity for input variant
   - INSERT `stock_movements` REPACK_IN (positive)
   - UPSERT `warehouse_inventory` +output_quantity for output variant
   - Weighted-average price update in `product_prices`:
     ```
     new_price = (existing_stock × old_price + output_qty × final_unit_cost) / (existing_stock + output_qty)
     ```
     UPDATE `product_prices` WHERE variant_id = output_variant_id AND price_type='standard' AND outlet_id IS NULL
3. Set order status = `completed`
4. Return `JSONB` summary

> **Note on target_size:** The frontend will pass `output_quantity` already computed (as currently — user enters target size and the JS formula computes output_qty and final_unit_cost before submitting). The RPC receives the pre-computed values and just records them, performs inventory ops, and updates prices. This keeps the RPC simpler and avoids needing to store target_size in the DB.

---

### 3. Backend Controller Updates

#### [MODIFY] `backend/src/controllers/inventory.ts`

`createRepackOrder` — accept & store new item fields:
- `wastage_quantity`, `unit_cost`, `additional_cost_per_unit` per item row

`processRepackOrder` — no change to the RPC call (RPC is replaced in-place with same name), but return the richer JSONB response to the frontend.

`getRepackOrderById` — already returns items. No change needed.

---

### 4. Frontend Redesign

#### [MODIFY] `frontend/src/pages/admin/RepackOrders.tsx`

Complete redesign with two tabs:

**Tab 1: New Order** — Single-item focused form (one input → one output per submission):
```
Fields:
- Warehouse (select from warehouses)
- Input product + variant (Combobox filtered by type='bulk' if possible, else all)
  → Show current stock from warehouse_inventory
- Input quantity (number of bags/units)
- Target size (numeric, same unit as input variant unit_type)
- Wastage (numeric, same unit)
- Additional cost per unit (numeric, ₹)
- Output product / variant (autocomplete or text input)

Live Price Preview Panel:
- Usable qty = (variant.unit × input_qty) − wastage
- Output qty = FLOOR(usable / target_size)
- Actual wastage = usable − (output_qty × target_size)
- Raw cost = input_qty × input_price
- Base cost/unit = raw_cost / output_qty
- Final cost/unit = base + additional_cost_per_unit
(All computed in JS, updated on every input change)

[Execute] button → calls createRepackOrder then processRepackOrder
```

**Tab 2: Order History** — Table with:
- Columns: Date | Warehouse | Input product | Output product | Bags in | Bags out | Wastage | Unit cost | Status
- Filters: Warehouse dropdown, Status dropdown, Date range
- View detail dialog (existing, already works)

**Utility function** `computeRepackPreview(inputUnit, inputQty, targetSize, wastage, additionalCost, inputPrice)` — pure calculation, exported for testing.

---

## User Review Required

> [!IMPORTANT]
> **target_size and output_qty calculation location:** The current design computes `output_quantity` in the **frontend JS** and sends it pre-computed to the backend (matching what the backend already does today). The `process_repack_order` RPC will receive item rows with `output_quantity` already set, and will update inventory + prices using that value. This is simpler and avoids API breaking changes.
>
> **Alternative:** We could store `target_size` in `repack_order_items` and compute everything in the RPC. This adds one more column to the migration. Let me know if you prefer this approach.

> [!NOTE]
> **Output product/variant creation:** The current process_repack_order RPC **requires** the output_variant_id to already exist. If a new product/variant needs to be created, the frontend should guide the user to create it first in the product catalog. Auto-creating products in the RPC would add significant complexity and is outside the scope of this plan (the existing backend already does not auto-create). If you'd like auto-creation in the RPC, please confirm.

---

## Proposed File Changes

### SQL Migrations
#### [NEW] [20260317_add_repack_cost_fields.sql](file:///Users/rishabhtibrewal/gulf%20frush/fresh-breeze-basket/backend/src/db/migrations/20260317_add_repack_cost_fields.sql)
#### [NEW] [20260317_upgrade_process_repack_order_rpc.sql](file:///Users/rishabhtibrewal/gulf%20frush/fresh-breeze-basket/backend/src/db/migrations/20260317_upgrade_process_repack_order_rpc.sql)

### Backend
#### [MODIFY] [inventory.ts](file:///Users/rishabhtibrewal/gulf%20frush/fresh-breeze-basket/backend/src/controllers/inventory.ts)
- Update `createRepackOrder` to persist new item fields
- Update `processRepackOrder` to return full summary

### Frontend
#### [MODIFY] [RepackOrders.tsx](file:///Users/rishabhtibrewal/gulf%20frush/fresh-breeze-basket/frontend/src/pages/admin/RepackOrders.tsx)
- Complete redesign: tabbed layout, live price preview, execute flow, richer history table

---

## Verification Plan

### Automated Tests
No existing Jest tests cover repack orders. We won't add new unit tests as part of this task (the business logic lives in SQL and is best verified via integration).

### Manual Verification Steps

1. **Run migrations:**
   ```bash
   # Using Supabase MCP tool (apply_migration) for both SQL files
   ```
   Then verify in Supabase Studio: `public.repack_order_items` should have `wastage_quantity`, `unit_cost`, `additional_cost_per_unit` columns.

2. **Backend smoke test** (after `npm run build && pm2 restart fresh-breeze-api`):
   - `GET /api/inventory/repack-orders` → should return `{ success: true, data: [] }`
   - `POST /api/inventory/repack-orders` with valid body → should return 201

3. **Frontend UI walkthrough:**
   - Navigate to `/inventory/repack-orders`
   - Click **New Order** tab
   - Select a warehouse that has bulk stock
   - Select an input bulk variant → confirm current stock is shown
   - Enter input qty, target size, wastage, additional cost
   - Confirm the **live price preview** updates instantly showing computed values
   - Select output product/variant
   - Click **Execute** → confirm toast "Order completed" appears
   - Switch to **Order History** tab → confirm a row appears with status=completed
   - Check **Warehouse Inventory** page → input variant stock should be reduced, output variant stock should be added
