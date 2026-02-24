# Extension Strategy: Adding Restaurant Support Without Schema Changes

This document explains how to extend the retail-first POS system to support restaurants and other industries without modifying core tables.

## Core Principles

1. **Retail is the baseline** - All core tables assume retail operations
2. **Industry context field** - Single `industry_context` field determines behavior
3. **Extension tables** - Industry-specific features use separate tables
4. **Service layer** - Business logic checks `industry_context` to determine behavior

## Core Tables (DO NOT MODIFY)

These tables are industry-agnostic and must remain unchanged:

- `orders` - Contains `industry_context` field
- `order_items` - Universal order line items
- `payments` - Universal payment processing
- `warehouses` - Used as outlets (retail) or locations (restaurant)
- `warehouse_inventory` - Inventory tracking (retail baseline)
- `stock_movements` - Audit trail for inventory
- `products` - Universal product catalog
- `product_variants` - Optional product variants

## Restaurant Extension Tables

When adding restaurant support, create these NEW tables (do not modify core tables):

### 1. Tables (Dining Tables)

```sql
CREATE TABLE restaurant.tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES public.warehouses(id),
  table_number VARCHAR(50) NOT NULL,
  capacity INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'available', -- available, occupied, reserved, cleaning
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(outlet_id, table_number, company_id)
);
```

### 2. Table Sessions

```sql
CREATE TABLE restaurant.table_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES restaurant.tables(id),
  order_id UUID REFERENCES public.orders(id), -- Links to core orders table
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  guest_count INTEGER,
  server_id UUID REFERENCES auth.users(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Order Modifiers (for customizations)

```sql
CREATE TABLE restaurant.order_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  modifier_name VARCHAR(255) NOT NULL,
  modifier_price DECIMAL(10,2) DEFAULT 0,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Kitchen Tickets (KOT)

```sql
CREATE TABLE restaurant.kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  table_session_id UUID REFERENCES restaurant.table_sessions(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, preparing, ready, served
  kitchen_station VARCHAR(100),
  notes TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Service Layer Extension

### RestaurantOrderService

Create `services/restaurant/RestaurantOrderService.ts` that extends `OrderService`:

```typescript
import { OrderService } from '../core/OrderService';

export class RestaurantOrderService extends OrderService {
  async createOrder(data: CreateOrderData, context: CreateOrderContext) {
    // Call parent method
    const order = await super.createOrder(data, {
      ...context,
      industryContext: 'restaurant',
    });

    // Add restaurant-specific logic
    if (context.tableId) {
      await this.assignTableToOrder(order.id, context.tableId);
    }

    // Create kitchen ticket
    await this.createKitchenTicket(order.id);

    return order;
  }

  private async assignTableToOrder(orderId: string, tableId: string) {
    // Create table session
    // Link to order
  }

  private async createKitchenTicket(orderId: string) {
    // Create KOT for kitchen
  }
}
```

## API Routes

### DO NOT Create Industry-Specific Routes

**BAD:**
```
POST /api/restaurant/orders
GET /api/restaurant/tables
```

**GOOD:**
```
POST /api/orders (with industry_context: 'restaurant')
GET /api/tables (if feature flag enabled)
```

### Route Implementation

```typescript
// routes/orders.ts
export const createOrder = async (req: Request, res: Response) => {
  const { industry_context } = req.body;
  
  let orderService: OrderService;
  
  if (industry_context === 'restaurant') {
    orderService = new RestaurantOrderService(req.companyId);
  } else {
    orderService = new OrderService(req.companyId);
  }
  
  const order = await orderService.createOrder(req.body, {
    industryContext: industry_context || 'retail',
    // ...
  });
  
  res.json({ success: true, data: order });
};
```

## Feature Flags

Use feature flags to enable restaurant features:

```typescript
const featureFlags = new FeatureFlagService(companyId);

if (await featureFlags.isEnabled(outletId, 'tables')) {
  // Enable table management UI
}

if (await featureFlags.isEnabled(outletId, 'kitchen')) {
  // Enable kitchen display system
}
```

## Inventory Logic

### Retail (Baseline)
- SALE reduces stock
- RETURN increases stock
- Stock tracked per outlet

### Restaurant (Extension)
- Uses same `stock_movements` table
- May have different movement types (PREP, WASTE, etc.)
- Extend `InventoryService` with restaurant-specific methods

```typescript
// services/restaurant/RestaurantInventoryService.ts
export class RestaurantInventoryService extends InventoryService {
  async recordPrepWaste(productId: string, outletId: string, quantity: number) {
    // Record waste during food preparation
    await this.recordStockMovement({
      productId,
      outletId,
      movementType: 'ADJUSTMENT', // or create new type
      quantity: -quantity,
      referenceType: 'prep_waste',
      notes: 'Food preparation waste',
    });
  }
}
```

## Order Flow Comparison

### Retail Order Flow
1. Customer selects products
2. Create order with `industry_context: 'retail'`
3. Reserve stock
4. Process payment
5. Update inventory (SALE movement)
6. Ship/deliver

### Restaurant Order Flow
1. Server assigns table
2. Create order with `industry_context: 'restaurant'`
3. Create table session
4. Create kitchen ticket (KOT)
5. Kitchen prepares items
6. Serve to table
7. Process payment
8. Update inventory (may have prep waste)

## Migration Path

1. **Phase 1**: Core tables support `industry_context`
2. **Phase 2**: Create restaurant extension tables
3. **Phase 3**: Implement `RestaurantOrderService`
4. **Phase 4**: Add restaurant-specific routes (if needed)
5. **Phase 5**: Enable feature flags for restaurant features

## Key Points

- ✅ Core tables remain unchanged
- ✅ Use `industry_context` to determine behavior
- ✅ Create extension tables for industry-specific features
- ✅ Extend services, don't modify core services
- ✅ Use feature flags to enable/disable features
- ✅ API routes remain industry-agnostic

## Example: Adding Table Management

```typescript
// New route (optional, or use existing orders route)
router.post('/tables/:tableId/orders', async (req, res) => {
  const orderService = new RestaurantOrderService(req.companyId);
  
  const order = await orderService.createOrder(req.body, {
    industryContext: 'restaurant',
    tableId: req.params.tableId,
  });
  
  res.json({ success: true, data: order });
});
```

This approach ensures:
- No schema changes to core tables
- Backward compatibility with retail
- Clean separation of concerns
- Easy to add more industries later

