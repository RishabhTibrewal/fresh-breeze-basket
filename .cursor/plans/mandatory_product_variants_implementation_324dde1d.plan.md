---
name: Mandatory Product Variants Implementation
overview: Implement mandatory product variants system where every product must have at least one DEFAULT variant, and inventory is tracked at warehouse × product × variant level. This includes schema updates, ProductService with automatic DEFAULT variant creation, InventoryService updates, and data migration for existing products.
todos:
  - id: schema-product-variants
    content: "Update product_variants table: add is_default column, price_override, remove stock_count, add constraint for exactly one default per product"
    status: completed
  - id: schema-warehouse-inventory
    content: "Update warehouse_inventory table: add variant_id NOT NULL, update unique constraint to include variant_id"
    status: completed
  - id: schema-stock-movements
    content: "Update stock_movements table: make variant_id NOT NULL"
    status: completed
  - id: product-service
    content: Create ProductService with createProduct(), ensureDefaultVariant(), createVariant(), getDefaultVariant() methods
    status: completed
  - id: inventory-service-update
    content: "Update InventoryService: remove nullable variantId logic, require variantId in all methods"
    status: completed
  - id: products-controller
    content: Refactor products controller to use ProductService for product creation
    status: completed
  - id: inventory-controller
    content: Update inventory controller to require variant_id in requests
    status: completed
  - id: order-service-update
    content: Update OrderService to require variantId in order items and inventory operations
    status: completed
  - id: backfill-variants
    content: Create migration to backfill DEFAULT variants for existing products
    status: completed
  - id: backfill-warehouse-inventory
    content: Create migration to backfill variant_id in warehouse_inventory
    status: completed
  - id: backfill-stock-movements
    content: Create migration to backfill variant_id in stock_movements
    status: completed
  - id: warehouse-utils-update
    content: Update warehouseInventory.ts utility functions to require variantId
    status: completed
---

# Mandatory Product Variants Implementation

## Overview

Transform the product system to enforce that **every product must have at least one variant**, with inventory tracked at the warehouse × product × variant level. This ensures consistency and prepares the system for future restaurant extensions.

## Architecture Changes

### Database Schema Updates

1. **Update `product_variants` table** (`backend/src/db/migrations/20260129_update_product_variants_mandatory.sql`):

- Add `is_default BOOLEAN DEFAULT false` column
- Add `price_override DECIMAL(10,2)` (nullable, replaces `price`)
- Remove `stock_count` column (deprecated)
- Add constraint: exactly one `is_default = true` per product
- Update unique constraint to include `is_default` consideration

2. **Update `warehouse_inventory` table** (`backend/src/db/migrations/20260129_add_variant_to_warehouse_inventory.sql`):

- Add `variant_id UUID NOT NULL REFERENCES product_variants(id)`
- Change unique constraint from `UNIQUE(warehouse_id, product_id)` to `UNIQUE(warehouse_id, product_id, variant_id)`
- Update all indexes to include `variant_id`

3. **Update `stock_movements` table** (`backend/src/db/migrations/20260129_make_variant_mandatory_in_stock_movements.sql`):

- Change `variant_id` from nullable to `NOT NULL`
- Update indexes to remove `WHERE variant_id IS NOT NULL` clauses

### Service Layer

4. **Create `ProductService`** (`backend/src/services/core/ProductService.ts`):

- `createProduct()`: Creates product and automatically creates DEFAULT variant
- `ensureDefaultVariant(productId)`: Ensures product has exactly one default variant
- `createVariant()`: Creates additional variants (non-default)
- `getDefaultVariant(productId)`: Returns the default variant for a product
- Auto-generates SKU for DEFAULT variant if not provided

5. **Update `InventoryService`** (`backend/src/services/core/InventoryService.ts`):

- Remove all nullable `variantId` logic - variant is now required
- Update `recordStockMovement()` to require `variantId`
- Update `getCurrentStock()` to require `variantId`
- Update `reserveStock()` and `releaseStock()` to require `variantId`
- Update `updateWarehouseInventory()` to include `variantId` in upsert

### Controller Updates

6. **Update `products` controller** (`backend/src/controllers/products.ts`):

- Refactor `createProduct()` to use `ProductService.createProduct()`
- Remove direct warehouse_inventory creation - handled by ProductService
- Update `updateProduct()` to ensure default variant exists

7. **Update `inventory` controller** (`backend/src/controllers/inventory.ts`):

- Update `updateInventory()` to require `variant_id` in request body
- Update `recordStockMovement()` to require `variant_id`

8. **Update `orders` controller and `OrderService`** (`backend/src/services/core/OrderService.ts`):

- Update order item creation to require `variantId`
- Update inventory checks to require `variantId`

### Data Migration

9. **Backfill existing products** (`backend/src/db/migrations/20260129_backfill_default_variants.sql`):

- For each product without variants, create DEFAULT variant
- Generate SKU: `{product_code || product_id}-DEFAULT`
- Set `is_default = true`

10. **Backfill warehouse_inventory** (`backend/src/db/migrations/20260129_backfill_warehouse_inventory_variants.sql`):

    - For each warehouse_inventory row, find or create DEFAULT variant for product
    - Update `variant_id` to point to DEFAULT variant
    - Handle duplicate rows (same warehouse + product) by merging stock

11. **Backfill stock_movements** (`backend/src/db/migrations/20260129_backfill_stock_movements_variants.sql`):

    - For each stock_movement with NULL variant_id, find DEFAULT variant
    - Update `variant_id` to point to DEFAULT variant

### Utility Updates

12. **Update `warehouseInventory.ts`** (`backend/src/utils/warehouseInventory.ts`):

    - Update `updateWarehouseStock()` to require `variantId`
    - Update `getWarehouseStock()` to require `variantId`
    - Update `reserveWarehouseStock()` to require `variantId`

## Key Design Decisions

### Why Mandatory Variants?

- **Consistency**: Eliminates conditional logic ("if variant exists")
- **Future-proof**: Restaurant items (e.g., "Small Pizza", "Large Pizza") are naturally variants
- **Inventory accuracy**: Clear warehouse × product × variant tracking

### Why DEFAULT Variant?

- **Backward compatibility**: Products without visible variants still work
- **Migration path**: Existing products get DEFAULT variant automatically
- **API simplicity**: Clients can omit variant_id and system uses DEFAULT

### Why Variant-Level Inventory?

- **Precision**: Different variants may have different stock levels
- **Restaurant ready**: "Small Pizza" vs "Large Pizza" have separate inventory
- **Extensibility**: Easy to add variant-specific pricing, stock alerts, etc.

## Implementation Order

1. Schema migrations (product_variants, warehouse_inventory, stock_movements)
2. ProductService creation
3. InventoryService updates
4. Controller refactoring
5. Data backfill migrations
6. Utility function updates

## Testing Considerations

- Product creation without variants → should create DEFAULT variant
- Product creation with variants → should create DEFAULT + provided variants
- Inventory updates → must include variant_id
- Order creation → must include variant_id for each item
- Existing products → should have DEFAULT variant after migration

## Breaking Changes

- API: `POST /products` now requires variant_id in inventory operations
- API: `POST /inventory/move` now requires variant_id