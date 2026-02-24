# API Migration Guide: Product Variants and Brands

## Overview

This guide helps API consumers migrate from the old product-centric API structure to the new variant-centric structure. The new structure provides better granularity for product management, pricing, and inventory tracking.

## Key Changes

### 1. Product Structure

**Before (Deprecated):**
```json
{
  "id": "uuid",
  "name": "Product Name",
  "price": 100,
  "sale_price": 90,
  "image_url": "https://...",
  "is_featured": true,
  "is_active": true,
  "unit": 500,
  "unit_type": "g",
  "best_before": "2024-12-31",
  "tax": 18,
  "hsn_code": "12345678",
  "badge": "New"
}
```

**After (New):**
```json
{
  "id": "uuid",
  "name": "Product Name",
  "price": 100, // Base price (deprecated, use variant prices)
  "variants": [
    {
      "id": "variant-uuid",
      "name": "DEFAULT",
      "sku": "PROD-DEFAULT",
      "is_default": true,
      "sale_price": 90,
      "mrp_price": 100,
      "image_url": "https://...",
      "is_featured": true,
      "is_active": true,
      "unit": 500,
      "unit_type": "g",
      "best_before": "2024-12-31",
      "tax": { "id": "tax-uuid", "rate": 18 },
      "hsn": "12345678",
      "badge": "New",
      "brand": { "id": "brand-uuid", "name": "Brand Name" }
    }
  ],
  "default_variant_id": "variant-uuid"
}
```

### 2. Deprecated Product Fields

The following product-level fields are deprecated and will be removed in a future version:

- `image_url` → Use `variants[].image_url`
- `is_featured` → Use `variants[].is_featured`
- `unit` → Use `variants[].unit`
- `unit_type` → Use `variants[].unit_type`
- `best_before` → Use `variants[].best_before`
- `tax` → Use `variants[].tax_id` (references `taxes` table)
- `hsn_code` → Use `variants[].hsn`
- `badge` → Use `variants[].badge`

**Note:** `is_active` at product level is **NOT deprecated**. It controls variant activation - if a product is inactive, all variants are automatically inactive.

### 3. Pricing Changes

**Before:**
- Single `price` field on product
- Optional `sale_price` field on product

**After:**
- Each variant has its own pricing via `product_prices` table
- `sale_price` and `mrp_price` per variant
- Support for multiple price types (standard, bulk, wholesale, etc.)
- Outlet-specific pricing support

### 4. API Endpoint Changes

#### Product List

**Before:**
```
GET /api/products
```

**After:**
```
GET /api/products  # Returns products with variants (new format)
GET /api/products?format=legacy  # Returns old format (deprecated)
```

#### Product Detail

**Before:**
```
GET /api/products/:id
```

**After:**
```
GET /api/products/:id  # Returns product with variants (new format)
GET /api/products/:id?include=false  # Returns old format (deprecated)
```

#### New Endpoints

- `GET /api/products/:id/variants` - Get all variants for a product
- `GET /api/variants/:variantId` - Get variant details
- `POST /api/products/:id/variants` - Create variant
- `PUT /api/variants/:variantId` - Update variant
- `DELETE /api/variants/:variantId` - Delete variant
- `GET /api/prices/variants/:variantId` - Get all prices for variant
- `POST /api/prices/variants/:variantId` - Create price entry
- `PUT /api/prices/:id` - Update price entry
- `DELETE /api/prices/:id` - Delete price entry

### 5. Order Items

**Before:**
```json
{
  "product_id": "uuid",
  "quantity": 2,
  "unit_price": 90
}
```

**After:**
```json
{
  "product_id": "uuid",
  "variant_id": "variant-uuid", // Optional - defaults to DEFAULT variant
  "quantity": 2,
  "unit_price": 90
}
```

### 6. Brand Management

**New Endpoints:**
- `GET /api/brands` - List brands
- `GET /api/brands/active` - Get active brands only
- `GET /api/brands/:id` - Get brand details
- `POST /api/brands` - Create brand
- `PUT /api/brands/:id` - Update brand
- `DELETE /api/brands/:id` - Delete brand
- `GET /api/brands/:id/products` - Get products/variants for a brand

## Migration Steps

### Step 1: Update Product List Queries

**Old Code:**
```javascript
const response = await fetch('/api/products');
const products = response.data;
products.forEach(product => {
  console.log(product.price);
  console.log(product.image_url);
});
```

**New Code:**
```javascript
const response = await fetch('/api/products');
const products = response.data;
products.forEach(product => {
  const defaultVariant = product.variants.find(v => v.is_default);
  console.log(defaultVariant.price.sale_price);
  console.log(defaultVariant.image_url);
});
```

### Step 2: Update Product Creation

**Old Code:**
```javascript
await fetch('/api/products', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Product',
    price: 100,
    image_url: 'https://...',
    is_featured: true
  })
});
```

**New Code:**
```javascript
await fetch('/api/products', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Product',
    price: 100,
    variants: [
      {
        name: 'DEFAULT',
        sale_price: 90,
        mrp_price: 100,
        image_url: 'https://...',
        is_featured: true
      }
    ]
  })
});
```

### Step 3: Update Order Creation

**Old Code:**
```javascript
await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    items: [
      { product_id: 'uuid', quantity: 2 }
    ]
  })
});
```

**New Code:**
```javascript
await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    items: [
      { 
        product_id: 'uuid',
        variant_id: 'variant-uuid', // Optional - defaults to DEFAULT
        quantity: 2 
      }
    ]
  })
});
```

### Step 4: Handle Variant Selection

When displaying products, allow users to select variants:

```javascript
// Display product with variant selector
const product = await getProductById(productId);
const selectedVariant = product.variants.find(v => v.id === selectedVariantId) || product.variants[0];

// Use variant pricing
const price = selectedVariant.price.sale_price;
const image = selectedVariant.image_url || product.images[0];
```

## Deprecation Timeline

- **Phase 1 (Current):** Deprecated fields still accepted and returned for backward compatibility
- **Phase 2 (Q2 2024):** Deprecated fields accepted but warnings returned in API responses
- **Phase 3 (Q3 2024):** Deprecated fields no longer accepted in write operations
- **Phase 4 (Q4 2024):** Deprecated fields removed from read operations

## Backward Compatibility

The API maintains backward compatibility through:

1. **Legacy Format Support:** Use `?format=legacy` or `?include=false` query parameters
2. **Automatic Variant Creation:** Deprecated product-level fields are automatically applied to DEFAULT variant
3. **Default Variant Fallback:** If `variant_id` not provided in orders, DEFAULT variant is used

## Support

For questions or issues during migration, please contact the development team or refer to the API documentation.

