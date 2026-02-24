---
name: Backend Schema Migration Implementation Plan
overview: Comprehensive step-by-step plan to adapt the existing POS/ERP backend to the new normalized schema where products is master-only, with data distributed across product_variants, product_prices, product_images, brands, and stock_movements tables.
todos:
  - id: brand-module
    content: "Implement Brand module: BrandService, brands controller, routes, CRUD operations"
    status: completed
  - id: product-service-variants
    content: "Complete ProductService: variant update/delete methods, transaction handling"
    status: completed
    dependencies:
      - brand-module
  - id: product-read-apis
    content: "Refactor product read APIs: getProducts() and getProductById() to include variants with prices/images/brand/tax"
    status: completed
    dependencies:
      - product-service-variants
  - id: product-write-apis
    content: "Refactor product write APIs: createProduct() with variant arrays, variant management endpoints"
    status: completed
    dependencies:
      - product-service-variants
  - id: order-cart-integration
    content: "Update order/cart integration: Update orders.ts and orderController.ts to use variant pricing and include variant info in queries, variant-aware cart, variant tax_id usage"
    status: completed
    dependencies:
      - product-read-apis
      - product-write-apis
  - id: inventory-verification
    content: "Verify inventory integration: Update warehouses.ts to include variant details in warehouse_inventory queries, stock_movements variant usage, inventory queries with variant details"
    status: completed
    dependencies:
      - product-read-apis
  - id: price-management
    content: "Create price management APIs: CRUD for product_prices, support multiple price types"
    status: completed
    dependencies:
      - product-write-apis
  - id: image-enhancement
    content: "Enhance image management: verify variant_id support, bulk operations, variant-specific images"
    status: completed
    dependencies:
      - product-write-apis
  - id: deprecation-handling
    content: Add deprecation warnings and migration guide for API consumers
    status: completed
    dependencies:
      - order-cart-integration
  - id: performance-optimization
    content: "Optimize queries: indexes, materialized views, caching for product listings"
    status: completed
    dependencies:
      - product-read-apis
---

# Backend Schema Migration Implementation Plan

## 1. Impact Analysis

### 1.1 Affected Backend Layers

#### Controllers / Routes

**Files requiring changes:**

- `backend/src/controllers/products.ts` - Major refactor needed
- `backend/src/controllers/productImages.ts` - Already updated, verify completeness
- `backend/src/controllers/inventory.ts` - Update queries for new schema
- `backend/src/controllers/orders.ts` - Update order queries to include variant info, use variant pricing
- `backend/src/controllers/orderController.ts` - Update product price queries to use variant pricing, include variant info in order items
- `backend/src/controllers/warehouses.ts` - Update warehouse_inventory queries to include variant details
- `backend/src/controllers/cart.ts` - May need variant-aware updates
- `backend/src/controllers/pos.ts` - Update product/variant queries
- `backend/src/routes/products.ts` - Add variant management routes

**Change types required:**

- Response structure changes (include variants, prices, images)
- Request validation updates (accept variant-level fields)
- Query parameter updates (filter by variant fields)
- New endpoints for variant CRUD operations

#### Services

**Files requiring changes:**

- `backend/src/services/core/ProductService.ts` - Already partially updated, needs completion
- `backend/src/services/core/PricingService.ts` - Already updated (mrp_price/sale_price)
- `backend/src/services/core/InventoryService.ts` - Verify variant_id usage
- `backend/src/services/core/OrderService.ts` - Update tax calculation to use variant tax_id
- `backend/src/services/shared/TaxService.ts` - Already updated

**Change types required:**

- Method signatures updated for variant-level operations
- Transaction orchestration for multi-table operations
- Error handling for cascading failures
- Validation logic for product.is_active → variant.is_active

#### Repositories / DB Access Layer

**Current pattern:** Direct Supabase queries in controllers/services**Change types required:**

- Query updates: Join product_variants, product_prices, product_images
- Filtering logic: Move from product fields to variant fields
- Aggregation queries: Group by variant for product listings
- Transaction management: Multi-table operations need rollback support

#### DTOs / Validators

**Change types required:**

- Request DTOs: Accept variant arrays, brand_id, tax_id
- Response DTOs: Include nested variants with prices/images
- Validation rules: Cross-table validations (product active → variant active)
- Type definitions: Update TypeScript interfaces (already done)

### 1.2 High-Risk Areas

**Critical dependencies:**

- Order creation flow (depends on variant pricing)
- **CRITICAL:** `orderController.ts` createOrder() currently uses `product.price`/`product.sale_price` - MUST change to variant pricing
- **CRITICAL:** `orders.ts` createOrder() uses OrderService which already handles variants, but verify pricing source
- Cart operations (must handle variants)
- POS checkout (variant selection required)
- Inventory updates (mandatory variant_id)
- Warehouse inventory queries (must include variant_id for accurate stock tracking)
- Purchase order/GRN flows (may still use product.tax for backward compatibility)

**Breaking change candidates:**

- Product list API response structure
- Product detail API response structure
- Cart item structure (needs variant_id)
- Order item structure (already has variant_id)

## 2. Product Data Flow Redesign

### 2.1 Product Creation Orchestration

**Current flow:** Single product insert → DEFAULT variant creation**New flow required:**

```javascript
1. Validate input
            - Product-level: name, price, description, category_id, slug
            - Variant-level: image_url, is_featured, is_active, unit, unit_type, best_before, tax_id, hsn, badge, brand_id
            - Pricing: sale_price, mrp_price (per variant)
            - Images: array with optional variant_id

2. Transaction boundary: BEGIN
   a. Insert product (master record only)
   b. Create DEFAULT variant with variant-level fields
   c. Create standard price entry (product_prices) for DEFAULT variant
   d. Create additional variants (if provided) with prices
   e. Create product_images (product-level and variant-level)
   f. Seed warehouse_inventory (if warehouse_id provided)
   
3. Transaction boundary: COMMIT or ROLLBACK
```

**Error rollback strategy:**

- Use database transactions (Supabase RPC or explicit transaction)
- If any step fails, rollback entire product creation
- Delete created records in reverse order if transaction not available
- Return specific error indicating which step failed

### 2.2 Product Update Flow

**Current flow:** Direct product table update**New flow required:**

```javascript
1. Validate product exists and is_active status
2. Update product master fields (name, description, price, category_id, slug)
3. If is_active changed:
            - If deactivated: Trigger DB function to deactivate all variants
            - If activated: Allow variant activation (enforced by DB trigger)
4. Update DEFAULT variant fields if provided
5. Handle variant-level updates separately (new endpoint)
```



### 2.3 Product Read Flow

**Current flow:** Single product query + images query**New flow required:**

```javascript
1. Query product (master)
2. Query all variants with:
            - product_prices (standard price: sale_price, mrp_price)
            - brand (if brand_id exists)
            - tax (if tax_id exists)
3. Query product_images:
            - Product-level images (product_id only)
            - Variant-specific images (variant_id set)
4. Aggregate into nested response:
   {
     product: { id, name, description, ... },
     variants: [
       {
         id, name, sku,
         prices: { sale_price, mrp_price },
         brand: { id, name, logo_url },
         tax: { id, name, rate },
         images: [...],
         is_featured, is_active, unit, unit_type, ...
       }
     ],
     images: [...] // product-level images
   }
```



## 3. Brand Module Plan

### 3.1 Required APIs

**CRUD endpoints:**

- `GET /api/brands` - List brands (filter by is_active, search by name)
- `GET /api/brands/:id` - Get brand details
- `POST /api/brands` - Create brand (validate slug uniqueness per company)
- `PUT /api/brands/:id` - Update brand
- `DELETE /api/brands/:id` - Delete brand (with relationship check)

**Additional endpoints:**

- `GET /api/brands/:id/products` - Get all products/variants for a brand
- `GET /api/brands/active` - Get only active brands

### 3.2 Relationship Handling

**Brand ↔ Product Variants:**

- Many-to-many relationship (variants can have brand_id)
- Brand deletion strategy: SET NULL on variants (soft delete preferred)
- Validation: Check if brand exists and belongs to company before assigning

**Brand service methods:**

- `createBrand()` - Generate slug, validate uniqueness
- `updateBrand()` - Handle slug regeneration if name changes
- `deleteBrand()` - Check for variant references, prevent deletion if in use (or soft delete)
- `getBrandProducts()` - Query variants with brand_id

### 3.3 Deletion Strategy

**Recommended: Soft delete**

- Set `is_active = false` instead of hard delete
- Prevents breaking existing variant references
- Allows reactivation if needed
- Hard delete only if no variants reference the brand (with admin confirmation)

**Validation rules:**

- Before soft delete: Check `SELECT COUNT(*) FROM product_variants WHERE brand_id = ?`
- If count > 0: Return error or set is_active = false
- If count = 0: Allow hard delete

## 4. Stock Management Strategy

### 4.1 Stock Movements Entry Creation

**Architecture:**

- **`warehouse_inventory` table** - Source of truth for current stock levels (read and write here)
- **`stock_movements` table** - Audit trail only, stores all historical movements for reporting/audit

**When to create stock_movements entries (for audit trail):Flow:**

1. Update `warehouse_inventory.stock_count` (primary operation - source of truth)
2. Record movement in `stock_movements` (audit trail - historical record)

**Automatic triggers:**

- Order creation (SALE) - reduces `warehouse_inventory.stock_count`, records SALE movement
- Order cancellation/return (RETURN) - increases `warehouse_inventory.stock_count`, records RETURN movement
- Goods receipt (RECEIPT) - increases `warehouse_inventory.stock_count`, records RECEIPT movement
- Inventory adjustment (ADJUSTMENT) - updates `warehouse_inventory.stock_count`, records ADJUSTMENT movement
- Warehouse transfer (TRANSFER) - Updates both source and destination `warehouse_inventory.stock_count`, records TRANSFER movements

**Manual operations:**

- Admin inventory adjustment - Updates `warehouse_inventory.stock_count`, records ADJUSTMENT
- Stock correction entries - Updates `warehouse_inventory.stock_count`, records ADJUSTMENT
- Physical stock count reconciliation - Updates `warehouse_inventory.stock_count`, records ADJUSTMENT

### 4.2 Movement Types

**Allowed types (from schema):**

- `SALE` - Customer order fulfillment (negative quantity)
- `RETURN` - Customer return/order cancellation (positive quantity)
- `ADJUSTMENT` - Manual stock correction (positive or negative)
- `TRANSFER` - Warehouse-to-warehouse transfer (OUT negative, IN positive)
- `RECEIPT` - Goods receipt from supplier (positive quantity)

**Business rules:**

- SALE/RETURN must reference order_id
- RECEIPT must reference goods_receipt_id
- TRANSFER must reference transfer_id (both OUT and IN entries)
- ADJUSTMENT requires notes/justification

### 4.3 Current Stock Derivation

**Architecture:**

- **`warehouse_inventory` table is the source of truth** for current stock levels
- **`stock_movements` table is for audit trail only** - tracks all historical movements
- Current stock should be read directly from `warehouse_inventory.stock_count`
- Stock movements are recorded in `stock_movements` for audit/reporting purposes

**Method:**

- **Read current stock:** Query `warehouse_inventory.stock_count` directly
  ```sql
                      SELECT stock_count FROM warehouse_inventory 
                      WHERE product_id = ? AND variant_id = ? AND warehouse_id = ?
  ```




- **Update stock:** Modify `warehouse_inventory.stock_count` when movements occur
- **Record movement:** Insert into `stock_movements` for audit trail (after updating warehouse_inventory)
- **Reconciliation:** Use `stock_movements` to verify/audit stock levels, but not as primary source

**Current implementation:**

- `InventoryService.getCurrentStock()` should read from `warehouse_inventory` table
- `InventoryService.updateWarehouseInventory()` updates `warehouse_inventory.stock_count` - this is correct
- `InventoryService.recordStockMovement()` should:

                                                                                                                                                                                                                                                                1. Update `warehouse_inventory.stock_count` (add/subtract quantity)
                                                                                                                                                                                                                                                                2. Insert record into `stock_movements` for audit trail

### 4.4 Negative Stock Prevention

**Business Rules:Negative stock is ALLOWED for:**

- Sales dashboard orders (created by sales person/admin) - Allows pre-orders, future delivery, special arrangements
- Admin inventory adjustments (with explicit override flag)
- Manual stock corrections

**Negative stock is PREVENTED for:**

- Website orders (created by users from main website) - Must have sufficient stock
- TRANSFER OUT movements - Source warehouse must have sufficient stock
- Regular user-facing operations

**Rules:**

- Before SALE movement (website orders only): Check `currentStock >= quantity`
- Before TRANSFER OUT: Check `currentStock >= quantity`
- ADJUSTMENT can go negative (with admin override flag)
- RECEIPT and RETURN can always proceed
- Sales dashboard orders: Skip stock validation, allow negative stock

**Implementation:**

- **`orders.ts` createOrder()** (website orders - created by users):
                                - Validate stock before creating order
                                - Check `warehouse_inventory.stock_count >= quantity` for each item
                                - Return 400 error if insufficient stock
                                - Use `InventoryService.recordStockMovement()` with stock validation enabled
- **`orderController.ts` createOrder()** (sales dashboard orders - created by sales/admin):
                                - Skip stock validation
                                - Allow negative stock_count (can go negative when sales recorded manually)
                                - Use `InventoryService.recordStockMovement()` with `allowNegativeStock: true` flag
- Add `allowNegativeStock` parameter to `InventoryService.recordStockMovement()`:
                                - Default: `false` (prevent negative stock)
                                - When `true`: Skip validation, allow negative stock
                                - Check `warehouse_inventory.stock_count` before SALE/TRANSFER OUT movements (only if `allowNegativeStock === false`)
                                - Return 400 error if negative stock would result (only if `allowNegativeStock === false`)
- Update `warehouse_inventory.stock_count` first, then record in `stock_movements`

## 5. API Contract Changes

### 5.1 Breaking Changes

**GET /api/products**

- **Current:** Returns flat product array
- **New:** Returns products with nested variants array
- **Migration:** Add `?format=legacy` query param for backward compatibility

**GET /api/products/:id**

- **Current:** Returns product + images array
- **New:** Returns product + variants (with prices, images, brand, tax) + product-level images
- **Migration:** Version API (`/api/v2/products/:id`) or accept `?include=variants` param

**POST /api/products**

- **Current:** Accepts product-level fields
- **New:** Accepts variants array with variant-level fields
- **Migration:** Accept both formats, auto-create DEFAULT variant from product fields

### 5.2 Backward-Compatible Changes

**POST /api/products**

- Accept deprecated product-level fields (image_url, is_featured, etc.)
- Map to DEFAULT variant automatically
- Log deprecation warning

**GET /api/products**

- Include deprecated fields in response for compatibility
- Mark as deprecated in response metadata

### 5.3 New Endpoints Required

**Variant management:**

- `GET /api/products/:id/variants` - List all variants for a product
- `GET /api/variants/:id` - Get variant details with prices/images
- `POST /api/products/:id/variants` - Create new variant
- `PUT /api/variants/:id` - Update variant
- `DELETE /api/variants/:id` - Delete variant (prevent if is_default)

**Brand management:**

- `GET /api/brands` - List brands
- `POST /api/brands` - Create brand
- `PUT /api/brands/:id` - Update brand
- `DELETE /api/brands/:id` - Delete brand

**Price management:**

- `GET /api/variants/:id/prices` - Get all prices for variant
- `POST /api/variants/:id/prices` - Create price entry (sale, bulk, etc.)
- `PUT /api/prices/:id` - Update price entry

### 5.4 Response Structure Changes

**Product list response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Product Name",
      "description": "...",
      "category_id": "uuid",
      "variants": [
        {
          "id": "uuid",
          "name": "DEFAULT",
          "sale_price": 100,
          "mrp_price": 120,
          "is_active": true,
          "is_featured": false,
          "brand": { "id": "uuid", "name": "Brand Name" },
          "tax": { "id": "uuid", "rate": 18 }
        }
      ],
      "default_variant_id": "uuid"
    }
  ]
}
```

**Product detail response:**

```json
{
  "success": true,
  "data": {
    "product": { /* master fields */ },
    "variants": [ /* full variant details */ ],
    "images": [ /* product-level images */ ]
  }
}
```



## 6. Validation & Safety Rules

### 6.0 Error Message Standards

**Principle:** Return clear, specific error messages instead of generic 404/400 errors**Error Message Requirements:**

- **Product not found:**
                - ❌ Bad: `"Product not found"` or `404`
                - ✅ Good: `"Product with ID 'abc123' not found or does not belong to your company"`
- **Variant not found:**
                - ❌ Bad: `"Variant not found"`
                - ✅ Good: `"Variant with ID 'xyz789' not found for product 'abc123'. Ensure variant belongs to the product and your company."`
- **Insufficient stock:**
                - ❌ Bad: `"Insufficient stock"` or `400`
                - ✅ Good: `"Insufficient stock: Product 'Product Name' (Variant: '500g') has only 5 units available in warehouse 'Main Warehouse', but 10 units requested"`
- **Brand not found:**
                - ❌ Bad: `"Brand not found"`
                - ✅ Good: `"Brand with ID 'brand123' not found or is inactive. Please select an active brand from your company."`
- **Tax not found:**
                - ❌ Bad: `"Tax not found"`
                - ✅ Good: `"Tax with ID 'tax456' not found or is inactive. Please select an active tax rate from your company."`
- **Invalid variant activation:**
                - ❌ Bad: `"Cannot activate variant"`
                - ✅ Good: `"Cannot activate variant: Product 'Product Name' is currently inactive. Activate the product first before activating its variants."`
- **Price validation:**
                - ❌ Bad: `"Invalid price"`
                - ✅ Good: `"Invalid price: sale_price (100) cannot be greater than mrp_price (90). MRP must be equal to or greater than sale price."`

**Implementation Guidelines:**

- Use `ApiError` class with descriptive messages
- Include relevant IDs, names, and context in error messages
- Provide actionable guidance (e.g., "Activate the product first")
- Include current vs. required values when applicable
- Use consistent error message format across all endpoints
- Log detailed errors server-side, return user-friendly messages client-side

**Example Error Response Structure:**

```json
{
  "success": false,
  "error": {
    "message": "Insufficient stock: Product 'Organic Apples' (Variant: '1kg') has only 5 units available in warehouse 'Main Warehouse', but 10 units requested",
    "code": "INSUFFICIENT_STOCK",
    "details": {
      "product_id": "abc123",
      "variant_id": "xyz789",
      "product_name": "Organic Apples",
      "variant_name": "1kg",
      "warehouse_id": "wh001",
      "warehouse_name": "Main Warehouse",
      "available_stock": 5,
      "requested_quantity": 10
    }
  }
}
```



### 6.1 Cross-Table Validations

**Product → Variant validations:**

- Product must exist before variant creation
- Product.is_active = false → All variants must be is_active = false (DB trigger enforced)
- Variant.is_active = true → Product.is_active must be true (DB trigger enforced)
- At least one variant must exist (DEFAULT variant)
- Only one variant can be is_default = true (DB constraint)

**Variant → Price validations:**

- Every variant must have exactly one standard price entry (price_type='standard', outlet_id=NULL)
        - Error: `"Variant '{variantName}' must have exactly one standard price entry. Current standard prices: {count}. Please ensure one standard price exists."`
- Variant deletion → Cascade delete prices (or prevent if orders reference)
        - Error: `"Cannot delete variant '{variantName}': {orderCount} order(s) reference this variant. Archive the variant instead or update existing orders first."`
- Price.sale_price <= Price.mrp_price (business rule validation)
        - Error: `"Invalid pricing for variant '{variantName}': sale_price ({salePrice}) cannot be greater than mrp_price ({mrpPrice}). MRP must be equal to or greater than sale price."`

**Variant → Brand validations:**

- Brand must exist and belong to same company
        - Error: `"Brand with ID '{brandId}' not found or does not belong to your company. Please select a valid brand."`
- Brand.is_active check (optional: prevent assigning inactive brands)
        - Error: `"Cannot assign inactive brand '{brandName}' to variant. Please activate the brand first or select an active brand."`

**Variant → Tax validations:**

- Tax must exist and belong to same company
        - Error: `"Tax with ID '{taxId}' not found or does not belong to your company. Please select a valid tax rate."`
- Tax.is_active check (optional: prevent assigning inactive taxes)
        - Error: `"Cannot assign inactive tax '{taxName}' ({taxRate}%) to variant. Please activate the tax first or select an active tax rate."`

**Image validations:**

- At least one of product_id or variant_id must be set (DB constraint)
        - Error: `"Product image must be associated with either a product or a variant. Provide either product_id or variant_id."`
- Variant_id must reference existing variant
        - Error: `"Variant with ID '{variantId}' not found. Cannot assign image to non-existent variant. Ensure variant exists and belongs to your company."`

### 6.2 Concurrency Considerations

**Product creation:**

- Slug uniqueness check → Use database unique constraint
- Race condition: Two products with same slug → Second insert fails gracefully

**Variant creation:**

- Variant name uniqueness per product → Database constraint
- Default variant creation → Use database trigger/constraint

**Stock updates:**

- Use database-level locking or optimistic locking
- Check stock before SALE movement → Prevent overselling
- Consider: `SELECT FOR UPDATE` or application-level locking

**Price updates:**

- Multiple price entries per variant allowed (different price_types)
- Standard price uniqueness enforced by partial unique index

### 6.3 Idempotency Needs

**Stock movements:**

- Use reference_id + reference_type for idempotency
- Check if movement already exists before creating
- Example: `SELECT id FROM stock_movements WHERE reference_type='order' AND reference_id=?`

**Product creation:**

- Slug-based idempotency (check if product with slug exists)
- Return existing product if duplicate slug detected

**Price creation:**

- Unique constraint on (product_id, variant_id, outlet_id, price_type, company_id)
- Upsert pattern: Insert or update existing

## 7. Execution Order

### Phase 1: Foundation (Week 1)

**Priority: Critical path blockers**

1. **Brand Module Implementation**

- Create BrandService
- Create brands controller
- Add brand routes
- Test brand CRUD operations
- **Why first:** Variants depend on brands, need brand_id validation

2. **ProductService Refactoring**

- Complete variant creation with all new fields
- Implement variant update method
- Add variant deletion method (with safety checks)
- Test transaction rollback scenarios
- **Why second:** Core product operations depend on this

### Phase 2: Data Flow Updates (Week 2)

**Priority: High - affects all product operations**

3. **Product Read APIs Refactoring**

- Update getProducts() to include variants
- Update getProductById() to include full variant details
- Add variant filtering/sorting
- Maintain backward compatibility
- **Why third:** Most-used endpoints, need to work correctly

4. **Product Write APIs Refactoring**

- Update createProduct() to handle variant arrays
- Update updateProduct() to handle product-level changes
- Add variant management endpoints
- Test error scenarios
- **Why fourth:** Product creation is critical but less frequent than reads

### Phase 3: Integration Points (Week 3)

**Priority: Medium - affects dependent systems**

5. **Order/Cart Integration**

**Specific changes required:`backend/src/controllers/orders.ts`:**

- `getOrders()` (line 45): Update query to include variant info:
  ```typescript
                        .select('*, order_items(*, products(*), variant:product_variants(*, price:product_prices!price_id(sale_price, mrp_price), brand:brands(*), tax:taxes(*)))')
  ```




- `getUserOrders()` (line 139): Include variant info in order_items
- `getOrderById()` (line 186): Include variant details with prices, brand, tax
- `getSalesOrders()` (line 1167): Include variant info in order_items query
- `getSalesAnalytics()` (line 1488): Query variant pricing instead of product.price for accurate revenue calculations

**`backend/src/controllers/orderController.ts`:**

- `createOrder()` (lines 79-98, 209-228): Replace product.price/sale_price queries with variant pricing:
- Query product_variants with product_prices instead of products table
- Use variant.sale_price from product_prices table
- Default to DEFAULT variant if variant_id not provided
- `getCustomerOrders()` (line 468): Include variant info in order_items query
- `getOrder()` (line 530): Include variant details with prices
- `getSalesOrders()` (line 666): Include variant info in order_items query

**`backend/src/controllers/warehouses.ts`:**

- `getWarehouseInventory()` (line 263): Update query to include variant details:
  ```typescript
                        .select(`
                          *,
                          products (...),
                          warehouses (...),
                          variant:product_variants (
                            id, name, sku,
                            price:product_prices!price_id (sale_price, mrp_price),
                            brand:brands (id, name, logo_url),
                            tax:taxes (id, name, rate)
                          )
                        `)
  ```




- `getProductStockAcrossWarehouses()` (line 330): Include variant info in warehouse_inventory query
- `getBulkProductStock()` (line 387): Include variant details for accurate stock tracking per variant
- Update `orders.ts` controller:
- `getOrders()` - Include variant info in order_items queries
- `getUserOrders()` - Include variant info in order_items
- `getOrderById()` - Include variant details with prices/brand/tax
- `getSalesOrders()` - Include variant info in order_items
- `getSalesAnalytics()` - Query variant pricing for accurate revenue calculations
- Update `orderController.ts`:
- `createOrder()` - Use variant pricing instead of product.price/sale_price
- `getCustomerOrders()` - Include variant info in order_items
- `getOrder()` - Include variant details with prices
- `getSalesOrders()` - Include variant info in order_items
- Update cart to handle variants
- Update tax calculation to use variant tax_id
- Test end-to-end order flow
- **Why fifth:** Depends on product APIs being stable

6. **Inventory Integration**

- Update `warehouses.ts` controller:
- `getWarehouseInventory()` - Include variant info in warehouse_inventory queries
- `getProductStockAcrossWarehouses()` - Include variant details
- `getBulkProductStock()` - Include variant info for accurate stock tracking
- Verify stock_movements usage (already implemented)
- Update inventory queries to include variant details
- Add variant-aware stock filtering
- **Why sixth:** Inventory already uses variants, verify completeness

### Phase 4: Advanced Features (Week 4)

**Priority: Low - enhancements**

7. **Price Management APIs**

- Create price management endpoints
- Support multiple price types (sale, bulk, wholesale)
- Add price history/validity tracking
- **Why seventh:** Advanced feature, not critical for MVP

8. **Image Management Enhancement**

- Verify variant_id support (already implemented)
- Add bulk image operations
- Add image reordering per variant
- **Why eighth:** Nice-to-have, can be done incrementally

### Phase 5: Cleanup & Optimization (Week 5)

**Priority: Low - polish**

9. **Deprecation Handling**

- Add deprecation warnings to APIs
- Create migration guide for API consumers
- Plan removal timeline for deprecated fields
- **Why ninth:** Can be done after core functionality works

10. **Performance Optimization**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Add database indexes if needed