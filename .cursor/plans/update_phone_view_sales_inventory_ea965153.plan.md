---
name: Update Phone View Sales Inventory
overview: Add mobile card views where missing (Payments, Warehouses) and improve existing mobile layouts across the Sales and Inventory modules for a consistent, touch-friendly phone experience.
todos: []
isProject: false
---

# Update Phone View for Sales and Inventory Modules

## Current State

**Sales module:**

- **Customers** – Mobile Card View (block md:hidden), Table on desktop
- **Orders** – Mobile Card View, Table on desktop  
- **Payments** – No mobile view; Table with overflow-x-auto (poor on phones)
- **Leads** – Mobile Card View
- **Credit Management** – Mobile Card View
- **Sales Analytics** – Mobile Card View sections

**Inventory module:**

- **WarehouseInventory** – ResponsiveTable with renderCard
- **StockMovements** – ResponsiveTable with renderCard
- **Warehouses** – Table only; some columns use `hidden md:table-cell` (no dedicated mobile cards)
- **Stock Adjustment / Stock Transfer** – Mobile-aware step UI

---

## Implementation Plan

### Part 1: Add Mobile Views Where Missing

#### 1.1 Sales – [frontend/src/pages/sales/Payments.tsx](frontend/src/pages/sales/Payments.tsx)

Add a mobile card section similar to Customers/Orders:

- Use `block md:hidden` for mobile cards and `hidden md:block` for the Table
- Each card shows: date, order link, customer, amount (emphasized), method, status, View/Edit actions
- Reuse `getStatusBadge`, `getPaymentMethodLabel`, and `formatCurrency`
- Make cards tappable to navigate to order detail or open edit dialog
- Ensure summary cards stack correctly on mobile (already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)

#### 1.2 Inventory – [frontend/src/pages/admin/Warehouses.tsx](frontend/src/pages/admin/Warehouses.tsx)

Add a mobile card section:

- Use `block md:hidden` for cards and `hidden md:block` for the Table
- Each card shows: warehouse name, code, status badge, location (city/country), contact phone
- Actions: View Inventory, Edit, Deactivate
- Follow the pattern from [frontend/src/pages/admin/CreditManagement.tsx](frontend/src/pages/admin/CreditManagement.tsx) (lines 143–160) for layout and spacing

---

### Part 2: Improve Existing Mobile Views

#### 2.1 Shared Patterns

- **Breakpoint**: Continue using `md` (768px) via `block md:hidden` / `hidden md:block`
- **Card padding**: `p-3` or `p-4` for touch targets
- **Text sizes**: `text-sm` for primary, `text-xs` for secondary/muted
- **Spacing**: `space-y-2.5` or `space-y-3` between cards
- **Touch targets**: Buttons/links min 44px for tap areas
- **Truncation**: `truncate`, `break-words`, `min-w-0` to avoid overflow

#### 2.2 Sales – Customers ([frontend/src/pages/sales/Customers.tsx](frontend/src/pages/sales/Customers.tsx))

- Ensure action buttons (View, Edit, New Order) use `size="sm"` and adequate spacing
- Add `cursor-pointer` and `hover:bg-muted/50` for card click
- Add `active:scale-[0.98]` for touch feedback
- Ensure credit/order info does not overflow on narrow screens
- Make filter row wrap on small screens if not already

#### 2.3 Sales – Orders ([frontend/src/pages/sales/Orders.tsx](frontend/src/pages/sales/Orders.tsx))

- Same touch feedback (`active:scale-[0.98]`) on cards
- Ensure type filter pills (All, Sales, Returns) wrap on narrow screens
- Improve spacing between status and payment badges on mobile
- Verify date and amount remain readable without horizontal scroll

#### 2.4 Sales – Leads / Credit Management / Sales Analytics

- Audit mobile sections for consistency (padding, typography, touch targets)
- Align with patterns used in Customers and Orders

#### 2.5 Inventory – [frontend/src/pages/admin/WarehouseInventory.tsx](frontend/src/pages/admin/WarehouseInventory.tsx)

- Check `renderCard` output: ensure StockDisplay and actions are readable on small screens
- Stack action buttons vertically or use icon-only buttons on mobile if needed
- Ensure search + “Transfer Stock” / “Adjust Stock” layout is mobile-friendly (e.g. full-width search, stacked buttons)

#### 2.6 Inventory – [frontend/src/pages/admin/StockMovements.tsx](frontend/src/pages/admin/StockMovements.tsx)

- Ensure filter popover and date pickers work well on mobile (full-width triggers)
- Make pagination mobile-friendly (compact or simplified controls)
- Review `renderCard` for product/variant/warehouse/type info and truncation

---

### Part 3: Consistency and Polish

- Use `useIsMobile` only where logic changes; rely on Tailwind `md:` for layout
- Ensure dialogs/sheets use `max-w-[95vw]` or `w-[95%]` on mobile
- Add `overflow-x-hidden` on page containers to prevent horizontal scroll
- Use `pb-20` or similar for pages with bottom nav to avoid content cutoff

---

## Files to Modify


| File                                              | Changes                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `frontend/src/pages/sales/Payments.tsx`           | Add mobile card view block               |
| `frontend/src/pages/admin/Warehouses.tsx`         | Add mobile card view block               |
| `frontend/src/pages/sales/Customers.tsx`          | Touch feedback, overflow fixes           |
| `frontend/src/pages/sales/Orders.tsx`             | Touch feedback, layout tweaks            |
| `frontend/src/pages/admin/WarehouseInventory.tsx` | Mobile action layout, responsive filters |
| `frontend/src/pages/admin/StockMovements.tsx`     | Mobile filter layout, pagination tweaks  |


---

## Testing

1. Sales module: Customers, Orders, Payments, Leads, Credit Management – list views on phone width (~375px).
2. Inventory module: Warehouses, WarehouseInventory, StockMovements – list views on phone width.
3. Confirm no horizontal scroll; filters and actions usable without zoom.
4. Dialogs/sheets open correctly and fit on small screens.

