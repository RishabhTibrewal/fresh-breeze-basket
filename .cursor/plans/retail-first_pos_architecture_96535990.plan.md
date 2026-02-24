---
name: Retail-first POS architecture
overview: Refactor the existing Express.js + Supabase backend into a retail-first, industry-agnostic POS system with modular services, extensible schema, and feature flags. Keep Express.js and Supabase client, migrate existing data, and prepare extension points for future restaurant support.
todos:
  - id: db_schema_orders
    content: Create migration to add order_type, industry_context, and outlet_id to orders table, with backfill script for existing data
    status: completed
  - id: db_schema_order_items
    content: Create migration to add variant_id and tax_amount to order_items table, with tax calculation backfill
    status: completed
  - id: db_schema_product_variants
    content: Create product_variants table migration (nullable, retail-focused)
    status: completed
  - id: db_schema_product_prices
    content: Create product_prices table migration for flexible pricing by outlet
    status: completed
  - id: db_schema_taxes
    content: Create taxes table migration for tax management
    status: completed
  - id: db_schema_stock_movements
    content: Create stock_movements table migration for inventory audit trail
    status: completed
  - id: db_schema_feature_flags
    content: Create feature_flags table migration for feature management
    status: completed
  - id: service_order
    content: Implement OrderService with industry-agnostic order creation, status updates, and retrieval
    status: completed
    dependencies:
      - db_schema_orders
      - db_schema_order_items
  - id: service_inventory
    content: Implement InventoryService with stock movement recording, stock calculation, and reservation logic
    status: completed
    dependencies:
      - db_schema_stock_movements
  - id: service_payment
    content: Implement PaymentService for payment processing and refunds
    status: completed
  - id: service_pricing
    content: Implement PricingService for product price lookups and line total calculations
    status: completed
    dependencies:
      - db_schema_product_prices
  - id: service_feature_flags
    content: Implement FeatureFlagService for checking and managing feature flags
    status: completed
    dependencies:
      - db_schema_feature_flags
  - id: service_tax
    content: Implement TaxService for tax calculations
    status: completed
    dependencies:
      - db_schema_taxes
  - id: refactor_orders_controller
    content: Refactor orders controller to use OrderService instead of direct Supabase queries
    status: completed
    dependencies:
      - service_order
  - id: refactor_inventory_controller
    content: Refactor inventory controller to use InventoryService
    status: completed
    dependencies:
      - service_inventory
  - id: refactor_payments_controller
    content: Refactor payments controller to use PaymentService
    status: completed
    dependencies:
      - service_payment
  - id: refactor_pos_controller
    content: Refactor POS controller to use OrderService and InventoryService
    status: completed
    dependencies:
      - service_order
      - service_inventory
  - id: update_api_routes
    content: Ensure API routes remain industry-agnostic (no /restaurant/orders, etc.)
    status: completed
    dependencies:
      - refactor_orders_controller
      - refactor_pos_controller
  - id: migration_backfill
    content: Create and run migration scripts to backfill order_type, industry_context, and stock_movements from existing data
    status: completed
    dependencies:
      - db_schema_orders
      - db_schema_stock_movements
  - id: documentation_extension
    content: Create extension-strategy.md documenting how restaurant module will extend core without schema changes
    status: completed
---

# Retail-First POS SaaS Backend Architecture

## Overview

Refactor the existing Express.js + Supabase backend into a production-grade, retail-first POS system that can later support restaurants and other industries without schema rewrites. The architecture will be modular, domain-driven, and extensible.

## Current State Analysis

**Existing:**

- Express.js backend with controller/route pattern
- Supabase (PostgreSQL) with direct client usage
- Multi-tenant with `companies` table
- `warehouses` table (will be used as outlets)
- `warehouse_inventory` table (will be used as inventory)
- `orders` and `order_items` tables (need refactoring)
- Products with `price`/`sale_price` (need flexible pricing system)

**Missing:**

- `order_type` and `industry_context` fields in orders
- `product_variants` table
- `product_prices` table
- `taxes` table
- `stock_movements` table
- Feature flags system
- Modular service layer
- Industry-agnostic inventory logic

## Architecture Design

### 1. Database Schema Refactoring

#### 1.1 Core Tables (Industry-Agnostic)

**Orders Table Enhancement:**

```sql
-- Migration: Add order_type and industry_context to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'SALE',
ADD COLUMN IF NOT EXISTS industry_context VARCHAR(50) DEFAULT 'retail',
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.warehouses(id);

-- Backfill existing orders
UPDATE public.orders 
SET order_type = 'SALE', industry_context = 'retail' 
WHERE order_type IS NULL;

-- Add constraints
ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_type CHECK (order_type IN ('SALE', 'RETURN')),
ADD CONSTRAINT valid_industry_context CHECK (industry_context IN ('retail', 'restaurant', 'service'));
```

**Order Items Enhancement:**

```sql
-- Add variant_id and tax_amount to order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;

-- Backfill tax_amount from products.tax if exists
UPDATE public.order_items oi
SET tax_amount = (oi.quantity * oi.unit_price * COALESCE(p.tax, 0) / 100)
FROM public.products p
WHERE oi.product_id = p.id AND oi.tax_amount = 0;
```

**New Tables:**

1. **product_variants** (nullable, retail-focused):
```sql
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "500g", "Red", "Large"
  sku VARCHAR(100),
  price DECIMAL(10,2),
  stock_count INTEGER DEFAULT 0,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, name, company_id)
);
```




2. **product_prices** (flexible pricing):
```sql
CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.warehouses(id), -- NULL = all outlets
  price_type VARCHAR(50) DEFAULT 'standard', -- standard, sale, bulk, etc.
  amount DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP WITH TIME ZONE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, outlet_id, price_type, company_id)
);
```




3. **taxes** (tax management):
```sql
CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL, -- e.g., "GST", "VAT"
  rate DECIMAL(5,2) NOT NULL, -- percentage
  is_active BOOLEAN DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code)
);
```




4. **stock_movements** (inventory tracking):
```sql
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  outlet_id UUID NOT NULL REFERENCES public.warehouses(id),
  movement_type VARCHAR(50) NOT NULL, -- SALE, RETURN, ADJUSTMENT, TRANSFER
  quantity INTEGER NOT NULL, -- positive for increase, negative for decrease
  reference_type VARCHAR(50), -- order, adjustment, transfer
  reference_id UUID,
  notes TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_outlet ON public.stock_movements(outlet_id);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
```




5. **feature_flags** (feature management):
```sql
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id), -- NULL = global
  outlet_id UUID REFERENCES public.warehouses(id), -- NULL = company-wide
  flag_name VARCHAR(100) NOT NULL, -- barcode, inventory, tables, kitchen
  is_enabled BOOLEAN DEFAULT false,
  config JSONB, -- additional configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, outlet_id, flag_name)
);
```




#### 1.2 Update Warehouse Inventory Logic

Modify `warehouse_inventory` to work with stock_movements:

- `stock_count` = calculated from stock_movements
- Keep `reserved_stock` for pending orders
- Add triggers/functions to maintain consistency

### 2. Service Layer Architecture

Create modular services following domain-driven design:

```javascript
backend/src/
  services/
    core/
      OrderService.ts          # Industry-agnostic order management
      InventoryService.ts      # Stock movement and inventory logic
      PaymentService.ts        # Payment processing
      PricingService.ts        # Product pricing logic
    retail/
      RetailOrderService.ts    # Retail-specific order logic (extends OrderService)
    shared/
      FeatureFlagService.ts    # Feature flag management
      TaxService.ts            # Tax calculation
```

**Key Services:**

1. **OrderService** (`services/core/OrderService.ts`):

- `createOrder(data, context)` - Industry-agnostic order creation
- `updateOrderStatus(id, status)` - Status transitions
- `getOrderById(id)` - Fetch order with items
- Uses `industry_context` to determine behavior
- Handles SALE vs RETURN order types

2. **InventoryService** (`services/core/InventoryService.ts`):

- `recordStockMovement(productId, outletId, type, quantity, reference)` - Record movements
- `getCurrentStock(productId, outletId)` - Calculate from movements
- `reserveStock(productId, outletId, quantity)` - Reserve for orders
- `releaseStock(productId, outletId, quantity)` - Release reservations
- Retail logic: SALE reduces stock, RETURN increases stock

3. **PaymentService** (`services/core/PaymentService.ts`):

- `processPayment(orderId, amount, method)` - Process payments
- `refundPayment(paymentId, amount)` - Handle refunds
- Industry-agnostic payment processing

4. **PricingService** (`services/core/PricingService.ts`):

- `getProductPrice(productId, variantId?, outletId?)` - Get current price
- `calculateLineTotal(productId, variantId, quantity, outletId)` - Calculate with tax
- Handles product_prices table lookups

### 3. Controller Refactoring

Refactor existing controllers to use services:**Before:** Controllers directly query Supabase**After:** Controllers call services, services handle business logicExample:

```typescript
// controllers/orders.ts
import { OrderService } from '../services/core/OrderService';

export const createOrder = async (req: Request, res: Response) => {
  const orderService = new OrderService(req.companyId);
  const order = await orderService.createOrder(req.body, {
    userId: req.user?.id,
    outletId: req.body.outlet_id,
    industryContext: 'retail' // Default, can be overridden
  });
  res.json({ success: true, data: order });
};
```



### 4. API Design (Industry-Agnostic Routes)

**DO:**

- `POST /api/orders` - Create order (industry-agnostic)
- `POST /api/orders/:id/pay` - Process payment
- `POST /api/inventory/move` - Record stock movement
- `GET /api/inventory/:productId` - Get inventory

**DO NOT:**

- `/api/restaurant/orders` - Industry-specific routes
- Hardcode restaurant concepts in core routes

**Request/Response Examples:**

```typescript
// POST /api/orders
{
  "outlet_id": "uuid",
  "order_type": "SALE",
  "industry_context": "retail",
  "items": [
    {
      "product_id": "uuid",
      "variant_id": "uuid", // optional
      "quantity": 2,
      "unit_price": 10.00
    }
  ],
  "payment_method": "cash"
}
```



### 5. Feature Flags System

**FeatureFlagService** (`services/shared/FeatureFlagService.ts`):

```typescript
class FeatureFlagService {
  async isEnabled(companyId: string, outletId: string | null, flagName: string): Promise<boolean>
  async getConfig(companyId: string, outletId: string | null, flagName: string): Promise<any>
}
```

**Usage:**

```typescript
const featureFlags = new FeatureFlagService();
if (await featureFlags.isEnabled(companyId, outletId, 'barcode')) {
  // Enable barcode scanning
}
```



### 6. Extension Strategy (Documentation Only)

Create `docs/extension-strategy.md` explaining:

- How restaurant module will extend core (without modifying core tables)
- Future tables: `tables`, `table_sessions`, `order_modifiers`, `kitchen_tickets`
- How to use `industry_context` field
- How to add industry-specific routes without breaking core

### 7. Migration Scripts

1. **Backfill existing orders:**

- Set `order_type = 'SALE'` for all existing orders
- Set `industry_context = 'retail'` for all existing orders
- Set `outlet_id` to default warehouse if missing

2. **Migrate inventory:**

- Create initial `stock_movements` records from `warehouse_inventory.stock_count`
- Preserve `reserved_stock` logic

3. **Setup default feature flags:**

- Enable `inventory` flag for all companies
- Enable `barcode` flag if needed

## Implementation Plan

### Phase 1: Database Schema

1. Create migration files for new tables
2. Add columns to existing tables
3. Backfill existing data
4. Add indexes and constraints

### Phase 2: Service Layer

1. Create base service classes
2. Implement OrderService
3. Implement InventoryService
4. Implement PaymentService
5. Implement PricingService

### Phase 3: Controller Refactoring

1. Refactor orders controller to use OrderService
2. Refactor inventory controller to use InventoryService
3. Refactor payments controller to use PaymentService
4. Update POS controller

### Phase 4: Feature Flags

1. Create FeatureFlagService
2. Add feature flag checks to relevant endpoints
3. Create admin UI for managing flags (future)

### Phase 5: Testing & Documentation

1. Write unit tests for services
2. Write integration tests for APIs
3. Update API documentation
4. Create extension strategy documentation

## Files to Create/Modify

**New Files:**

- `backend/src/services/core/OrderService.ts`
- `backend/src/services/core/InventoryService.ts`
- `backend/src/services/core/PaymentService.ts`
- `backend/src/services/core/PricingService.ts`
- `backend/src/services/shared/FeatureFlagService.ts`
- `backend/src/services/shared/TaxService.ts`
- `backend/src/db/migrations/YYYYMMDD_add_order_type_and_industry_context.sql`
- `backend/src/db/migrations/YYYYMMDD_create_product_variants.sql`
- `backend/src/db/migrations/YYYYMMDD_create_product_prices.sql`
- `backend/src/db/migrations/YYYYMMDD_create_taxes.sql`
- `backend/src/db/migrations/YYYYMMDD_create_stock_movements.sql`
- `backend/src/db/migrations/YYYYMMDD_create_feature_flags.sql`
- `backend/src/db/migrations/YYYYMMDD_backfill_orders.sql`
- `docs/extension-strategy.md`

**Modified Files:**

- `backend/src/controllers/orders.ts` - Use OrderService
- `backend/src/controllers/inventory.ts` - Use InventoryService
- `backend/src/controllers/payments.ts` - Use PaymentService
- `backend/src/controllers/pos.ts` - Use services
- `backend/src/routes/orders.ts` - Update routes if needed

## Key Design Decisions

1. **Warehouses as Outlets:** Use existing `warehouses` table as outlets (no new table needed)
2. **Warehouse Inventory:** Use `warehouse_inventory` as the inventory table, add `stock_movements` for audit trail
3. **Express.js:** Keep existing framework, add service layer for modularity
4. **Supabase Client:** Continue using Supabase client directly (no ORM migration)
5. **Retail Baseline:** All core logic assumes retail, restaurant features added via extensions
6. **Industry Context:** Single field (`industry_context`) determines behavior, not separate tables

## Success Criteria

- [ ] Orders table supports `order_type` and `industry_context`
- [ ] Stock movements tracked in dedicated table