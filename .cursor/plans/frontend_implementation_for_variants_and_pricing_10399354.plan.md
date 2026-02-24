---
name: Frontend Implementation for Variants and Pricing
overview: Update frontend to support mandatory product variants, variant-level inventory tracking, and the new product_prices table structure. This includes updating types, API services, product forms, inventory displays, and cart functionality.
todos:
  - id: update-types
    content: Update TypeScript interfaces for Product, ProductVariant, and ProductPrice in frontend/src/api/products.ts
    status: pending
  - id: update-api-service
    content: Add variant and pricing API methods to productsService (getVariants, createVariant, updateVariant, getVariantPrices, etc.)
    status: pending
    dependencies:
      - update-types
  - id: update-product-form
    content: Add variant management section to ProductForm.tsx with add/edit/delete variant functionality
    status: pending
    dependencies:
      - update-api-service
  - id: create-variant-manager
    content: Create VariantManager.tsx component for reusable variant management UI
    status: pending
    dependencies:
      - update-types
  - id: update-product-details
    content: Add variant selector to ProductDetails.tsx and update stock display to show variant-level inventory
    status: pending
    dependencies:
      - update-api-service
  - id: update-cart-context
    content: Update CartContext to include variant_id in cart items and handle variant selection
    status: pending
    dependencies:
      - update-types
  - id: update-warehouse-inventory
    content: Update WarehouseInventory.tsx to display variant-level inventory and require variant_id in updates
    status: pending
    dependencies:
      - update-api-service
  - id: update-inventory-types
    content: Update WarehouseInventory interface to include variant_id and variant data
    status: pending
    dependencies:
      - update-types
  - id: update-product-list
    content: Update ProductList.tsx and Products.tsx to show variant information and prices
    status: pending
    dependencies:
      - update-api-service
  - id: add-backend-endpoints
    content: Add variant and pricing endpoints to backend/src/routes/products.ts if not already present
    status: pending
---

# Frontend Implementation for Variants and Pricing

## Overview

Update the frontend to support the new backend schema changes:

- **Mandatory Variants**: Every product must have at least one DEFAULT variant
- **Variant-Level Inventory**: Inventory tracked at warehouse × product × variant level
- **Product Prices Table**: All pricing stored in `product_prices` table (not in products or product_variants)
- Each variant must have exactly one standard price entry (`price_type='standard'`)
- Each variant can have multiple additional prices (sale, bulk, wholesale, etc.)
- Base price comes from standard price in `product_prices` table, not from products table
- **Variant Selection**: Users need to select variants when adding products to cart
- **Multiple Price Types**: Support displaying and managing multiple price types per variant

## 1. Update Type Definitions

### 1.1 Product and Variant Types

**File**: `frontend/src/api/products.ts`

- Add `ProductVariant` interface:
  ```typescript
                    export interface ProductVariant {
                      id: string;
                      product_id: string;
                      name: string;
                      sku: string | null;
                      price_id: string; // References product_prices.id
                      is_default: boolean;
                      company_id: string;
                      created_at: string;
                      updated_at: string;
                    }
  ```




- Add `ProductPrice` interface:
  ```typescript
                    export interface ProductPrice {
                      id: string;
                      product_id: string | null;
                      variant_id: string | null;
                      outlet_id: string | null;
                      price_type: 'standard' | 'sale' | 'bulk' | 'wholesale';
                      amount: number;
                      valid_from: string;
                      valid_until: string | null;
                      company_id: string;
                      created_at: string;
                      updated_at: string;
                    }
  ```




- Update `Product` interface:
- Add `variants?: ProductVariant[]`
- Add `default_variant?: ProductVariant`
- Keep `stock_count` for backward compatibility but mark as deprecated
- Remove `base_price` from Product interface (prices come from product_prices table)
- Add `price?: number` (computed from default_variant's standard price for display convenience)
- Update `CreateProductInput`:
- Add `variants?: Array<{ name: string; sku?: string; price?: number }>` (price is for standard price entry)
- Remove direct `price_override` references
- Note: `price` field in products table is the base price, but frontend should use standard price from product_prices table

### 1.2 Inventory Types

**File**: `frontend/src/api/warehouses.ts`

- Update `WarehouseInventory` interface:
- Add `variant_id: string` (required)
- Add `variant?: ProductVariant`
- Update comments to indicate variant-level tracking

## 2. Update API Services

### 2.1 Products API Service

**File**: `frontend/src/api/products.ts`

- Add variant management methods:
  ```typescript
                    async getVariants(productId: string): Promise<ProductVariant[]>
                    async createVariant(productId: string, variantData: {...}): Promise<ProductVariant>
                    async updateVariant(variantId: string, variantData: {...}): Promise<ProductVariant>
                    async deleteVariant(variantId: string): Promise<void>
  ```




- Add pricing methods:
  ```typescript
                    async getVariantPrices(variantId: string, priceType?: string): Promise<ProductPrice[]>
                    async getProductPrices(productId: string, priceType?: string): Promise<ProductPrice[]>
                    async createPrice(priceData: {
                      product_id?: string;
                      variant_id?: string;
                      outlet_id?: string | null;
                      price_type: 'standard' | 'sale' | 'bulk' | 'wholesale';
                      amount: number;
                      valid_from?: string;
                      valid_until?: string | null;
                    }): Promise<ProductPrice>
                    async updatePrice(priceId: string, priceData: Partial<ProductPrice>): Promise<ProductPrice>
                    async deletePrice(priceId: string): Promise<void>
                    async getStandardPrice(variantId: string): Promise<number> // Get standard price for variant
                    async getProductStandardPrice(productId: string): Promise<number> // Get standard price from default variant
  ```




- Update `getById()` to include variants and default_variant
- Update `getAll()` to optionally include variants
- Update `create()` to accept variants array
- Update `update()` to handle variant updates

### 2.2 Inventory API Service

**File**: `frontend/src/api/warehouses.ts` (or create `frontend/src/api/inventory.ts`)

- Update `getWarehouseInventory()` to require/return variant_id
- Add `getVariantInventory(warehouseId, productId, variantId)`
- Update stock movement endpoints to include variant_id

## 3. Update Product Form

### 3.1 Product Creation/Edit Form

**File**: `frontend/src/pages/admin/ProductForm.tsx`

- Add variant management section:
- Display list of variants (always show DEFAULT variant)
- Add "Add Variant" button
- Variant form fields: name, SKU, standard price (for standard price entry in product_prices)
- Price management per variant:
- Show all price types for each variant (standard, sale, bulk, wholesale)
- Add/edit/delete prices for each variant
- Each variant can have multiple prices with different price_type
- Mark default variant (only one can be default)
- Delete variant (prevent deletion of DEFAULT if it's the only one)
- Update form schema:
- Add `variants` field (array of variant objects)
- Remove `price_override` references
- Update form submission:
- Send variants array to backend
- Backend will create DEFAULT variant automatically if not provided
- Update form initialization:
- Load variants when editing product
- Pre-populate variant fields

### 3.2 Variant Management Component

**File**: `frontend/src/components/products/VariantManager.tsx` (new)

- Create reusable component for variant management
- Features:
- List variants with edit/delete actions
- Add new variant form (name, SKU, standard price)
- Price management per variant:
- Display all price types for selected variant
- Add new price entry (select price_type, amount, valid dates, outlet)
- Edit existing price entries
- Delete price entries (prevent deletion of standard price if it's the only one)
- Show price type badges (standard, sale, bulk, wholesale)
- Default variant indicator
- Validation (at least one variant, exactly one default, each variant must have standard price)

## 4. Update Product Display Pages

### 4.1 Product Details Page

**File**: `frontend/src/pages/ProductDetails.tsx`

- Add variant selector:
- Dropdown/radio buttons for variant selection
- Show variant name, SKU, and standard price
- Default to DEFAULT variant
- Update price display based on selected variant:
- Show standard price by default
- Optionally show sale price if available and valid
- Display price type selector if multiple price types exist
- Update stock display:
- Fetch variant-level inventory
- Show stock for selected variant
- Update `getProductStockAcrossWarehouses` to accept variant_id
- Update add to cart:
- Include `variant_id` in cart item
- Store selected variant with cart item

### 4.2 Product List Pages

**File**: `frontend/src/pages/admin/ProductList.tsx`

- Update stock display:
- Show stock for default variant (or aggregate)
- Add tooltip showing variant breakdown

**File**: `frontend/src/pages/Products.tsx`

- Update product cards to show variant prices
- Handle variant selection in product cards (if multiple variants)

## 5. Update Inventory Management

### 5.1 Warehouse Inventory Page

**File**: `frontend/src/pages/admin/WarehouseInventory.tsx`

- Update inventory table:
- Add "Variant" column
- Group by product, show variants as sub-rows or expandable rows
- Show variant name, SKU, stock_count, reserved_stock
- Update add/edit inventory dialog:
- Add variant selector (defaults to DEFAULT variant)
- Require variant selection
- Update API calls to include variant_id
- Update stock display:
- Show variant-level stock instead of product-level
- Aggregate view option (show total across all variants)

### 5.2 Inventory API Integration

- Update `warehousesService.getWarehouseInventory()` to return variant data
- Update `warehousesService.updateInventory()` to require variant_id
- Add variant filtering options

## 6. Update Cart Context

### 6.1 Cart Context

**File**: `frontend/src/contexts/CartContext.tsx`

- Update `CartItem` interface:
- Add `variant_id: string` (required)
- Add `variant?: ProductVariant`
- Add `variant_name?: string` (for display)
- Update `addToCart()`:
- Require variant_id parameter
- Default to DEFAULT variant if not provided
- Store variant information
- Update cart display:
- Show variant name in cart items
- Show variant-specific prices

### 6.2 Cart Components

**Files**: Cart-related components

- Update cart item display to show variant name
- Update price calculation to use variant prices
- Update quantity validation to check variant stock

## 7. Update Order Creation

### 7.1 Order Items

**Files**: Order creation pages (`frontend/src/pages/sales/CreateOrder.tsx`, etc.)

- Update order item structure:
- Include `variant_id` in order items
- Validate variant exists
- Use variant prices for calculations
- Update order display:
- Show variant name in order items
- Show variant-specific prices

## 8. Backend API Endpoints (if needed)

### 8.1 Variant Endpoints

**File**: `backend/src/routes/products.ts`

- Add variant routes:
  ```typescript
                    router.get('/:id/variants', getProductVariants);
                    router.post('/:id/variants', createVariant);
                    router.put('/variants/:variantId', updateVariant);
                    router.delete('/variants/:variantId', deleteVariant);
  ```




### 8.2 Price Endpoints

- Add price routes:
  ```typescript
                    router.get('/variants/:variantId/prices', getVariantPrices); // Get all prices for variant
                    router.get('/products/:productId/prices', getProductPrices); // Get all prices for product
                    router.post('/prices', createPrice); // Create price (can be product or variant level)
                    router.put('/prices/:priceId', updatePrice);
                    router.delete('/prices/:priceId', deletePrice);
                    router.get('/variants/:variantId/price/standard', getVariantStandardPrice);
                    router.get('/products/:productId/price/standard', getProductStandardPrice);
  ```




## 9. Migration Considerations

### 9.1 Backward Compatibility

- Keep `stock_count` in Product interface (deprecated, always 0)
- Keep `price` in Product interface (from products table) but prefer standard price from product_prices
- Default to DEFAULT variant when variant_id not provided
- Default to standard price_type when displaying prices
- Show warning messages for deprecated fields
- Fallback to product.price if variant standard price not found (shouldn't happen but safety check)

### 9.2 Data Migration

- Ensure existing products have DEFAULT variants (backend handles this)
- Update existing inventory records to use DEFAULT variant
- Update existing cart items to use DEFAULT variant

## 10. Testing Checklist

- [ ] Product creation with variants
- [ ] Product creation without variants (should create DEFAULT)
- [ ] Variant management (add/edit/delete)
- [ ] Variant selection in product details
- [ ] Cart with variant selection
- [ ] Inventory display with variants
- [ ] Inventory updates with variant_id
- [ ] Order creation with variants
- [ ] Price display for variants
- [ ] Stock calculations for variants

## Implementation Order