---
name: Product Variants and Brands Schema Migration
overview: Migrate product fields to variants, create brands table, update product_prices structure (mrp_price/sale_price replacing amount), and add variant_id to product_images. This refactoring moves variant-specific attributes to the variants table and introduces brand management.
todos:
  - id: create-brands-table
    content: Create brands table migration with company_id, name, slug, legal_name, logo_url, is_active fields
    status: completed
  - id: add-variant-fields
    content: Add image_url, is_featured, is_active, unit, unit_type, best_before, tax, hsn, badge, brand_id to product_variants table
    status: completed
    dependencies:
      - create-brands-table
  - id: deprecate-product-fields
    content: Mark image_url, is_featured, unit, unit_type, best_before, tax, hsn_code, badge as deprecated in products table (add comments, keep columns)
    status: completed
  - id: restructure-product-prices
    content: Add mrp_price, sale_price, brand_id to product_prices. Migrate amount → sale_price, then remove amount column
    status: completed
    dependencies:
      - create-brands-table
  - id: add-variant-id-images
    content: Add variant_id to product_images table with foreign key and constraint allowing both product_id and variant_id
    status: completed
    dependencies:
      - add-variant-fields
  - id: update-typescript-types
    content: "Update database.ts types: add Brand, update ProductVariant/ProductPrice/ProductImage interfaces"
    status: completed
    dependencies:
      - create-brands-table
      - add-variant-fields
      - restructure-product-prices
      - add-variant-id-images
  - id: update-pricing-service
    content: Replace all amount references with sale_price in PricingService.ts
    status: completed
    dependencies:
      - restructure-product-prices
  - id: update-product-service
    content: Update ProductService to handle variant-level fields (image_url, is_featured, etc.) and brand_id
    status: completed
    dependencies:
      - add-variant-fields
      - restructure-product-prices
  - id: update-product-controllers
    content: Update products.ts controller to accept and handle variant-level fields
    status: completed
    dependencies:
      - update-product-service
  - id: update-image-controllers
    content: Update productImages.ts controller to support variant_id parameter
    status: completed
    dependencies:
      - add-variant-id-images
  - id: update-frontend-types
    content: Update frontend/src/api/products.ts interfaces for new variant fields and pricing structure
    status: pending
    dependencies:
      - update-typescript-types
  - id: add-brands-rls
    content: Add RLS policies for brands table with company isolation
    status: completed
    dependencies:
      - create-brands-table
---

# Product Variants and Brands Schema Migration

## Overview

This plan migrates product-level fields to variant-level, creates a brands table, restructures product_prices (replacing `amount` with `mrp_price` and `sale_price`), and adds variant support to product_images. Fields are deprecated (not removed) from products table for backward compatibility during migration.

## Database Schema Changes

### 1. Create Brands Table

**File:** `backend/src/db/migrations/YYYYMMDD_create_brands_table.sql` (new)Create `public.brands` table with:

- `id` UUID PRIMARY KEY
- `company_id` UUID NOT NULL (multi-tenant isolation)
- `name` TEXT NOT NULL (display name)
- `slug` TEXT (URL/SEO friendly)
- `legal_name` TEXT (optional, for invoices)
- `logo_url` TEXT (brand logo)
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Add:

- Unique constraint on `(company_id, slug)`
- Indexes on `company_id`, `slug`, `is_active`
- RLS policies for company isolation
- Foreign key constraint to `companies` table

### 2. Add Fields to product_variants Table

**File:** `backend/src/db/migrations/YYYYMMDD_add_fields_to_product_variants.sql` (new)Add columns to `public.product_variants`:

- `image_url` TEXT
- `is_featured` BOOLEAN DEFAULT false
- `is_active` BOOLEAN DEFAULT true
- `unit` DECIMAL(10,2) (numeric field)
- `unit_type` VARCHAR(50) DEFAULT 'piece'
- `best_before` DATE
- `tax` DECIMAL(5,2) DEFAULT 0
- `hsn` VARCHAR(50) (HSN code)
- `badge` TEXT
- `brand_id` UUID REFERENCES `public.brands(id)` ON DELETE SET NULL

Add:

- Indexes on `brand_id`, `is_featured`, `is_active`, `hsn`
- Foreign key constraint for `brand_id`
- Comments documenting each field

### 3. Deprecate Fields from products Table

**File:** `backend/src/db/migrations/YYYYMMDD_deprecate_product_fields.sql` (new)Mark as deprecated (keep columns, add comments):

- `image_url` → deprecated, use `product_variants.image_url`
- `is_featured` → deprecated, use `product_variants.is_featured`
- `unit` → deprecated, use `product_variants.unit`
- `unit_type` → deprecated, use `product_variants.unit_type`
- `best_before` → deprecated, use `product_variants.best_before`
- `tax` → deprecated, use `product_variants.tax`
- `hsn_code` → deprecated, use `product_variants.hsn`
- `badge` → deprecated, use `product_variants.badge`

Add COMMENT statements marking these as deprecated. Columns remain for backward compatibility.

### 4. Modify product_prices Table

**File:** `backend/src/db/migrations/YYYYMMDD_restructure_product_prices.sql` (new)Changes:

- Add `mrp_price` DECIMAL(10,2) NOT NULL (Maximum Retail Price)
- Add `sale_price` DECIMAL(10,2) NOT NULL (actual selling price, replaces `amount`)
- Add `brand_id` UUID REFERENCES `public.brands(id)` ON DELETE SET NULL
- Remove `amount` column (after data migration)

Migration steps:

1. Add new columns (`mrp_price`, `sale_price`, `brand_id`) as nullable initially
2. Migrate data: `sale_price = amount`, `mrp_price = amount` (default, can be updated later)
3. Set `sale_price` and `mrp_price` to NOT NULL after data migration
4. Drop `amount` column
5. Add indexes on `brand_id`, `mrp_price`, `sale_price`
6. Update unique constraint if needed (currently: `UNIQUE(product_id, variant_id, outlet_id, price_type, company_id)`)
7. Update comments

**Note:** All existing code using `product_prices.amount` must be updated to use `sale_price`.

### 5. Add variant_id to product_images Table

**File:** `backend/src/db/migrations/YYYYMMDD_add_variant_id_to_product_images.sql` (new)Add:

- `variant_id` UUID REFERENCES `public.product_variants(id)` ON DELETE CASCADE

Allow both `product_id` and `variant_id`:

- `product_id` can be NULL if `variant_id` is set (variant-specific image)
- `variant_id` can be NULL if `product_id` is set (product-level image)
- Both can be set (image applies to both product and variant)
- Add CHECK constraint: at least one must be NOT NULL

Add:

- Index on `variant_id`
- Foreign key constraint
- Update comments

### 6. Update RLS Policies

**File:** `backend/src/db/migrations/YYYYMMDD_add_brands_rls.sql` (new)Add RLS policies for `brands` table:

- Company users can view brands in their company
- Company admins/sales can insert/update brands
- Company admins can delete brands

## Code Updates

### 7. Update TypeScript Types

**File:** `backend/src/types/database.ts`Add interfaces:

- `Brand` interface
- Update `Product` interface (mark deprecated fields with comments)
- Update `ProductVariant` interface (add new fields)
- Update `ProductPrice` interface (replace `amount` with `mrp_price` and `sale_price`, add `brand_id`)
- Update `ProductImage` interface (add `variant_id`)

### 8. Update ProductService

**File:** `backend/src/services/core/ProductService.ts`Update methods:

- `createProduct()`: Handle variant-level fields (image_url, is_featured, is_active, unit, unit_type, best_before, tax, hsn, badge, brand_id)
- `createVariant()`: Accept and store new variant fields
- `updateVariant()`: Support updating new variant fields
- Remove references to deprecated product fields in variant creation

### 9. Update PricingService

**File:** `backend/src/services/core/PricingService.ts`Update all methods:

- Replace `amount` with `sale_price` in queries
- Add support for `mrp_price` where needed
- Update `getProductPrice()` to return `sale_price` instead of `amount`
- Consider returning both `mrp_price` and `sale_price` in price objects

### 10. Update Product Controllers

**File:** `backend/src/controllers/products.ts`Update:

- `createProduct()`: Accept variant-level fields, pass to ProductService
- `updateProduct()`: Handle variant updates with new fields
- `getProductById()`: Include variant fields in response
- Remove/update references to deprecated product fields

### 11. Update Product Images Controllers

**File:** `backend/src/controllers/productImages.ts`Update:

- `addProductImage()`: Accept `variant_id` parameter
- `getProductImages()`: Support filtering by `variant_id`
- `bulkAddProductImages()`: Support `variant_id` in bulk operations
- Update queries to handle both `product_id` and `variant_id`

### 12. Update Frontend Types

**File:** `frontend/src/api/products.ts`Update interfaces:

- `Product`: Mark deprecated fields (keep for backward compatibility)
- `ProductVariant`: Add new fields
- `ProductPrice`: Replace `amount` with `mrp_price` and `sale_price`
- `ProductImage`: Add `variant_id`

### 13. Create Brand Service/Controller (Optional)

**Files:**

- `backend/src/services/core/BrandService.ts` (new)
- `backend/src/controllers/brands.ts` (new)
- `backend/src/routes/brands.ts` (new)

Create CRUD operations for brands:

- Create, read, update, delete brands
- List brands by company
- Validate brand slugs (unique per company)

## Migration Order

1. Create brands table
2. Add fields to product_variants
3. Add variant_id to product_images
4. Restructure product_prices (add new columns, migrate data, remove amount)
5. Deprecate product fields (add comments only)
6. Update code (services, controllers, types)
7. Update RLS policies

## Data Migration Considerations

- Existing `product_prices.amount` values → migrate to `sale_price` and `mrp_price`
- Existing product-level fields → may need to be copied to default variants
- Product images → may need variant_id assignment for existing images
- Brand data → needs to be seeded or migrated from existing data if applicable

## Testing Checklist

- [ ] Brands CRUD operations work