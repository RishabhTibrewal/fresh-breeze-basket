---
name: Stock Adjustment and Transfer APIs
overview: "Implement two new inventory APIs: Stock Adjustment (reconcile physical vs system stock) and Stock Transfer (move stock between warehouses). Both use warehouse-based inventory with stock_movements as audit trail and warehouse_inventory as snapshot."
todos: []
---

# Stock Adjustment and Transfer APIs Implementation

Plan

## Overview

Implement two critical inventory management features:

1. **Stock Adjustment API** - Reconcile physical stock counts with system records
2. **Stock Transfer API** - Transfer stock between warehouses atomically

Both features follow the existing architecture:

- `warehouse_inventory` = current stock snapshot (warehouse × product × variant)
- `stock_movements` = audit trail (source of truth)
- All changes flow through `stock_movements` → updates `warehouse_inventory`

## Architecture Context

### Current State

- **InventoryService** ([backend/src/services/core/InventoryService.ts](backend/src/services/core/InventoryService.ts)) handles stock movements
- **warehouse_inventory** table: `warehouse_id`, `product_id`, `variant_id`, `stock_count`, `reserved_stock`, `company_id`
- **stock_movements** table: `product_id`, `variant_id`, `outlet_id` (warehouse), `movement_type`, `quantity`, `reference_type`, `reference_id`, `notes`, `created_by`
- Movement types constraint: `'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'RECEIPT'`
- Routes: [backend/src/routes/inventory.ts](backend/src/routes/inventory.ts), [backend/src/routes/warehouses.ts](backend/src/routes/warehouses.ts)

### Transaction Handling

- Supabase JS client doesn't support explicit transactions
- Use PostgreSQL RPC functions for atomic operations OR handle rollback manually
- For multi-step operations, create RPC functions that wrap logic in `BEGIN/COMMIT/ROLLBACK`

## Implementation Details

### 1. Stock Adjustment API

#### 1.1 Database Migration

**File:** `backend/src/db/migrations/20260131_add_adjustment_movement_types.sql`Update `stock_movements` constraint to allow `ADJUSTMENT_IN` and `ADJUSTMENT_OUT`:

```sql
-- Drop existing constraint
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS valid_movement_type;

-- Add new constraint with ADJUSTMENT_IN and ADJUSTMENT_OUT
ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type 
CHECK (movement_type IN ('SALE', 'RETURN', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RECEIPT'));
```

**Alternative:** Keep `ADJUSTMENT` and use quantity sign (positive=IN, negative=OUT). Store direction in `notes`.**Decision:** Use `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` for clarity in audit trail.

#### 1.2 Service Method

**File:** `backend/src/services/core/InventoryService.ts`Add method:

```typescript
/**
    * Adjust stock to reconcile physical count with system count
    * Creates single movement: ADJUSTMENT_IN (if physical > system) or ADJUSTMENT_OUT (if physical < system)
    * 
    * Adjustment Math:
    * - difference = physical_quantity - system_stock_count
    * - If difference > 0: ADJUSTMENT_IN with quantity = difference
    * - If difference < 0: ADJUSTMENT_OUT with quantity = |difference| (stored as negative)
    * - If difference = 0: No movement created (already reconciled)
    * 
    * @param params - Adjustment parameters
 */
async adjustStock(params: {
  warehouseId: string;
  productId: string;
  variantId: string;
  physicalQuantity: number; // Physical count from warehouse
  reason: string; // Reason for adjustment (damage, found, miscount, etc.)
  createdBy?: string;
}): Promise<{ movementId: string; difference: number; newStockCount: number }>
```

**Logic:**

1. Validate warehouse, product, variant exist and belong to company
2. Get current `stock_count` from `warehouse_inventory` (or 0 if not exists)
3. Calculate difference = `physicalQuantity - currentStockCount`
4. If difference === 0, return early (no adjustment needed)
5. Determine movement type:

- `difference > 0` → `ADJUSTMENT_IN` with `quantity = difference` (positive)
- `difference < 0` → `ADJUSTMENT_OUT` with `quantity = difference` (negative)

6. Create stock movement with `reference_type = 'adjustment'`, `notes = reason`
7. Update `warehouse_inventory.stock_count` to `physicalQuantity`
8. Return movement ID, difference, and new stock count

**Transaction:** Use PostgreSQL RPC function for atomicity (see 1.4)

#### 1.3 Controller

**File:** `backend/src/controllers/inventory.ts`Add endpoint:

```typescript
/**
    * POST /api/inventory/adjust
    * Adjust stock to match physical count
    * 
    * Body: {
    *   warehouse_id: string;
    *   product_id: string;
    *   variant_id: string;
    *   physical_quantity: number;
    *   reason: string; // Required: explanation for adjustment
    * }
 */
export const adjustStock = async (req: Request, res: Response)
```

**Validation:**

- All required fields present
- `physical_quantity >= 0`
- `reason` not empty
- Warehouse, product, variant exist and belong to company

#### 1.4 PostgreSQL RPC Function (Atomic Transaction)

**File:** `backend/src/db/migrations/20260131_create_adjust_stock_rpc.sql`Create RPC function for atomic adjustment:

```sql
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_warehouse_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_physical_quantity INTEGER,
  p_reason TEXT,
  p_company_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock INTEGER := 0;
  v_difference INTEGER;
  v_movement_type VARCHAR(50);
  v_movement_id UUID;
  v_new_stock_count INTEGER;
BEGIN
  -- Validate warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Warehouse not found or does not belong to company';
  END IF;
  
  -- Validate product exists
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Product not found or does not belong to company';
  END IF;
  
  -- Validate variant exists
  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id AND product_id = p_product_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Variant not found or does not belong to product/company';
  END IF;
  
  -- Get current stock from warehouse_inventory
  SELECT COALESCE(stock_count, 0) INTO v_current_stock
  FROM public.warehouse_inventory
  WHERE warehouse_id = p_warehouse_id
    AND product_id = p_product_id
    AND variant_id = p_variant_id
    AND company_id = p_company_id;
  
  -- Calculate difference
  v_difference := p_physical_quantity - v_current_stock;
  
  -- If no difference, return early
  IF v_difference = 0 THEN
    RETURN jsonb_build_object(
      'movement_id', NULL,
      'difference', 0,
      'new_stock_count', v_current_stock,
      'message', 'Stock already matches physical count'
    );
  END IF;
  
  -- Determine movement type and quantity
  IF v_difference > 0 THEN
    v_movement_type := 'ADJUSTMENT_IN';
  ELSE
    v_movement_type := 'ADJUSTMENT_OUT';
  END IF;
  
  -- Create stock movement
  INSERT INTO public.stock_movements (
    product_id,
    variant_id,
    outlet_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    company_id,
    created_by
  ) VALUES (
    p_product_id,
    p_variant_id,
    p_warehouse_id,
    v_movement_type,
    v_difference, -- Positive for IN, negative for OUT
    'adjustment',
    NULL,
    p_reason,
    p_company_id,
    p_created_by
  ) RETURNING id INTO v_movement_id;
  
  -- Update warehouse_inventory to physical quantity
  INSERT INTO public.warehouse_inventory (
    warehouse_id,
    product_id,
    variant_id,
    stock_count,
    company_id
  ) VALUES (
    p_warehouse_id,
    p_product_id,
    p_variant_id,
    p_physical_quantity,
    p_company_id
  )
  ON CONFLICT (warehouse_id, product_id, variant_id)
  DO UPDATE SET
    stock_count = p_physical_quantity,
    updated_at = CURRENT_TIMESTAMP;
  
  v_new_stock_count := p_physical_quantity;
  
  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'difference', v_difference,
    'new_stock_count', v_new_stock_count
  );
END;
$$;
```

**Service Integration:** Call RPC from `InventoryService.adjustStock()`:

```typescript
const { data, error } = await supabaseAdmin.rpc('adjust_stock', {
  p_warehouse_id: warehouseId,
  p_product_id: productId,
  p_variant_id: variantId,
  p_physical_quantity: physicalQuantity,
  p_reason: reason,
  p_company_id: this.companyId,
  p_created_by: createdBy || null
});
```



#### 1.5 Route

**File:** `backend/src/routes/inventory.ts`Add route:

```typescript
router.post('/adjust', protect, adminOnly, adjustStock);
```



### 2. Stock Transfer API

#### 2.1 Service Method

**File:** `backend/src/services/core/InventoryService.ts`Add method:

```typescript
/**
    * Transfer stock between warehouses
    * Creates TWO movements: TRANSFER_OUT (source) and TRANSFER_IN (destination)
    * Both movements share same reference_id for traceability
    * 
    * Transfer Math (per item):
    * - Source warehouse: TRANSFER_OUT with quantity = -item.quantity (negative)
    * - Destination warehouse: TRANSFER_IN with quantity = +item.quantity (positive)
    * - Update source warehouse_inventory: stock_count -= quantity
    * - Update destination warehouse_inventory: stock_count += quantity (UPSERT)
    * 
    * @param params - Transfer parameters
 */
async transferStock(params: {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
  notes?: string;
  createdBy?: string;
}): Promise<{ transferId: string; movements: Array<{ type: string; id: string }> }>
```

**Logic:**

1. Validate source ≠ destination
2. Validate both warehouses exist and belong to company
3. For each item:

- Validate product and variant exist
- Check sufficient stock in source warehouse
- Create TRANSFER_OUT movement (negative quantity)
- Create TRANSFER_IN movement (positive quantity)
- Update source `warehouse_inventory` (decrease)
- Update destination `warehouse_inventory` (increase, UPSERT)

4. Use shared `reference_id` (UUID) for all movements in this transfer
5. Set `reference_type = 'transfer'`

**Transaction:** Use PostgreSQL RPC function (see 2.3)

#### 2.2 Controller

**File:** `backend/src/controllers/inventory.ts`Add endpoint:

```typescript
/**
    * POST /api/inventory/transfer
    * Transfer stock between warehouses
    * 
    * Body: {
    *   source_warehouse_id: string;
    *   destination_warehouse_id: string;
    *   items: Array<{
    *     product_id: string;
    *     variant_id: string;
    *     quantity: number; // Must be > 0
    *   }>;
    *   notes?: string;
    * }
 */
export const transferStock = async (req: Request, res: Response)
```

**Validation:**

- `source_warehouse_id !== destination_warehouse_id`
- Both warehouses exist and belong to company
- Items array not empty
- Each item has `product_id`, `variant_id`, `quantity > 0`
- Sufficient stock in source warehouse for all items
- All products/variants exist and belong to company

#### 2.3 PostgreSQL RPC Function (Atomic Transaction)

**File:** `backend/src/db/migrations/20260131_create_transfer_stock_rpc.sql`Create RPC function:

```sql
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_source_warehouse_id UUID,
  p_destination_warehouse_id UUID,
  p_items JSONB, -- Array of {product_id, variant_id, quantity}
  p_notes TEXT DEFAULT NULL,
  p_company_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer_id UUID := gen_random_uuid();
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_source_stock INTEGER;
  v_destination_stock INTEGER;
  v_out_movement_id UUID;
  v_in_movement_id UUID;
  v_movements JSONB := '[]'::JSONB;
BEGIN
  -- Validate source ≠ destination
  IF p_source_warehouse_id = p_destination_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
  END IF;
  
  -- Validate source warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_source_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Source warehouse not found or does not belong to company';
  END IF;
  
  -- Validate destination warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_destination_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Destination warehouse not found or does not belong to company';
  END IF;
  
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Validate quantity > 0
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be greater than 0';
    END IF;
    
    -- Validate product exists
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'Product % not found or does not belong to company', v_product_id;
    END IF;
    
    -- Validate variant exists
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'Variant % not found or does not belong to product/company', v_variant_id;
    END IF;
    
    -- Check source stock
    SELECT COALESCE(stock_count, 0) INTO v_source_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = p_source_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    IF v_source_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %', v_source_stock, v_quantity;
    END IF;
    
    -- Create TRANSFER_OUT movement (negative quantity)
    INSERT INTO public.stock_movements (
      product_id,
      variant_id,
      outlet_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id,
      created_by
    ) VALUES (
      v_product_id,
      v_variant_id,
      p_source_warehouse_id,
      'TRANSFER',
      -v_quantity, -- Negative for OUT
      'transfer',
      v_transfer_id,
      COALESCE(p_notes, 'Stock transfer'),
      p_company_id,
      p_created_by
    ) RETURNING id INTO v_out_movement_id;
    
    -- Create TRANSFER_IN movement (positive quantity)
    INSERT INTO public.stock_movements (
      product_id,
      variant_id,
      outlet_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id,
      created_by
    ) VALUES (
      v_product_id,
      v_variant_id,
      p_destination_warehouse_id,
      'TRANSFER',
      v_quantity, -- Positive for IN
      'transfer',
      v_transfer_id,
      COALESCE(p_notes, 'Stock transfer'),
      p_company_id,
      p_created_by
    ) RETURNING id INTO v_in_movement_id;
    
    -- Update source warehouse_inventory (decrease)
    UPDATE public.warehouse_inventory
    SET stock_count = stock_count - v_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_source_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    -- Update destination warehouse_inventory (increase, UPSERT)
    INSERT INTO public.warehouse_inventory (
      warehouse_id,
      product_id,
      variant_id,
      stock_count,
      company_id
    ) VALUES (
      p_destination_warehouse_id,
      v_product_id,
      v_variant_id,
      v_quantity, -- Initial stock if new record
      p_company_id
    )
    ON CONFLICT (warehouse_id, product_id, variant_id)
    DO UPDATE SET
      stock_count = warehouse_inventory.stock_count + v_quantity,
      updated_at = CURRENT_TIMESTAMP;
    
    -- Track movements
    v_movements := v_movements || jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'quantity', v_quantity,
      'transfer_out_id', v_out_movement_id,
      'transfer_in_id', v_in_movement_id
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'movements', v_movements
  );
END;
$$;
```

**Note:** Using `TRANSFER` movement type with positive/negative quantities. If separate types needed, update constraint to allow `TRANSFER_IN`/`TRANSFER_OUT`.

#### 2.4 Route

**File:** `backend/src/routes/inventory.ts`Add route:

```typescript
router.post('/transfer', protect, adminOnly, transferStock);
```



## Implementation Order

1. **Database migrations** (adjustment movement types, RPC functions)
2. **InventoryService methods** (adjustStock, transferStock)
3. **Controllers** (adjustStock, transferStock)
4. **Routes** (register new endpoints)
5. **Testing** (unit tests for service methods, integration tests for APIs)

## Error Handling

- **Adjustment:** Return 400 if warehouse/variant doesn't exist, 404 if not found
- **Transfer:** Return 400 if source=destination, insufficient stock, invalid items
- **Both:** Use RPC exceptions → convert to ApiError with appropriate status codes

## Testing Considerations

- **Adjustment:** Test zero difference (no movement), positive difference (IN), negative difference (OUT)
- **Transfer:** Test single item, multiple items, insufficient stock, same warehouse rejection
- **Both:** Verify `warehouse_inventory` updates correctly, `stock_movements` created with correct quantities

## Files to Modify/Create

### New Files

- `backend/src/db/migrations/20260131_add_adjustment_movement_types.sql`
- `backend/src/db/migrations/20260131_create_adjust_stock_rpc.sql`
- `backend/src/db/migrations/20260131_create_transfer_stock_rpc.sql`

### Modified Files

- `backend/src/services/core/InventoryService.ts` - Add `adjustStock()` and `transferStock()` methods
- `backend/src/controllers/inventory.ts` - Add `adjustStock` and `transferStock` controllers
- `backend/src/routes/inventory.ts` - Register new routes