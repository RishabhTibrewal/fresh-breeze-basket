---
name: Warehouse Manager Role and Updated Procurement Permissions
overview: "Add warehouse_manager role and update procurement permissions: warehouse_manager can create PO/GRN and manage their warehouse inventory; accounts/admin can approve PO/GRN; accounts can create invoices and update payments; admin can do everything."
todos: []
---

# Warehouse Manager Role and Updated Procurement Permissions

## Overview

Add a new `warehouse_manager` role and update the procurement workflow permissions:

- **Warehouse Manager**: Can create PO/GRN, manage their assigned warehouse inventory
- **Accounts**: Can approve PO/GRN, create invoices, update supplier payments
- **Admin**: Full access to everything (admin override)

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Add warehouse_manager Role

**File:** `backend/src/db/migrations/20260125_add_warehouse_manager_role.sql` (new)

- Insert `warehouse_manager` role into `public.roles` table
- Description: "Warehouse manager role for managing warehouse inventory and creating procurement documents"

#### 1.2 Create Warehouse Managers Assignment Table

**File:** `backend/src/db/migrations/20260125_create_warehouse_managers_table.sql` (new)

- Create `public.warehouse_managers` table:
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `warehouse_id` (UUID, references warehouses)
- `company_id` (UUID, references companies)
- `is_active` (BOOLEAN, default true)
- `created_at`, `updated_at` (timestamps)
- Unique constraint: `(user_id, warehouse_id, company_id)`
- Enable RLS
- Add policies:
- Users can view their own warehouse assignments
- Admins can manage all warehouse assignments
- Warehouse managers can view their assigned warehouses

### Phase 2: Update Role Functions

**File:** `backend/src/db/migrations/20260125_update_role_functions_for_warehouse_manager.sql` (new)

- Add `is_warehouse_manager(user_id UUID)` function
- Add `has_warehouse_access(user_id UUID, warehouse_id UUID)` function
- Update existing role functions to include warehouse_manager in admin override logic where appropriate

### Phase 3: Update Middleware

#### 3.1 Create Warehouse Manager Middleware

**File:** `backend/src/middleware/auth.ts` (update)

- Add `requireWarehouseManager` middleware
- Add `requireAccountsOrAdmin` middleware (for approval actions)
- Add `requireAccounts` middleware (for invoice/payment actions)
- Add `canManageWarehouse` helper function to check warehouse access

#### 3.2 Update Procurement Route Middleware

**Files to update:**

- `backend/src/routes/purchaseOrders.ts`
- `backend/src/routes/goodsReceipts.ts`
- `backend/src/routes/purchaseInvoices.ts`
- `backend/src/routes/supplierPayments.ts`

**Changes:**

- **PO Create**: Change from `adminOnly` to `requireWarehouseManager` OR `adminOnly`
- **PO Approve**: Change from `adminOnly` to `requireAccountsOrAdmin`
- **GRN Create**: Change from `adminOnly` to `requireWarehouseManager` OR `adminOnly`
- **GRN Approve/Complete**: Change from `adminOnly` to `requireAccountsOrAdmin`
- **Invoice Create**: Change from `adminOnly` to `requireAccounts` OR `adminOnly`
- **Invoice Update**: Change from `adminOnly` to `requireAccounts` OR `adminOnly`
- **Payment Create/Update**: Change from `adminOnly` to `requireAccounts` OR `adminOnly`

### Phase 4: Update RLS Policies

#### 4.1 Warehouse Inventory Policies

**File:** `backend/src/db/migrations/20260125_update_warehouse_inventory_rls.sql` (new)

- Update `warehouse_inventory` RLS policies:
- Warehouse managers can manage inventory for their assigned warehouses
- Admins can manage all warehouse inventory
- Sales can view warehouse inventory

#### 4.2 Procurement Table Policies

**File:** `backend/src/db/migrations/20260125_update_procurement_rls.sql` (new)

- Update procurement table RLS policies:
- **PO**: Warehouse managers can create/view PO, accounts/admin can approve/manage
- **GRN**: Warehouse managers can create/view GRN, accounts/admin can approve/manage
- **Invoices**: Accounts/admin can create/manage, warehouse managers can view
- **Payments**: Accounts/admin can create/manage, warehouse managers can view

### Phase 5: Update Controllers

#### 5.1 Purchase Orders Controller

**File:** `backend/src/controllers/purchaseOrders.ts` (update)

- Update `approvePurchaseOrder` to check for accounts or admin role
- Add validation to ensure warehouse_manager can only create PO for their assigned warehouses
- Update `createPurchaseOrder` to validate warehouse access

#### 5.2 Goods Receipts Controller

**File:** `backend/src/controllers/goodsReceipts.ts` (update)

- Update `completeGoodsReceipt` to check for accounts or admin role (for approval)
- Add validation to ensure warehouse_manager can only create GRN for their assigned warehouses
- Update `createGoodsReceipt` to validate warehouse access

#### 5.3 Purchase Invoices Controller

**File:** `backend/src/controllers/purchaseInvoices.ts` (update)

- Update `createPurchaseInvoice` and `createInvoiceFromGRN` to check for accounts or admin role
- No warehouse restrictions needed (accounts can create invoices for any warehouse)

#### 5.4 Supplier Payments Controller

**File:** `backend/src/controllers/supplierPayments.ts` (update)

- Update `createSupplierPayment` and `updateSupplierPayment` to check for accounts or admin role
- No warehouse restrictions needed

### Phase 6: Warehouse Management API

#### 6.1 Warehouse Managers API

**File:** `backend/src/controllers/warehouseManagers.ts` (new)

- `assignWarehouseManager(userId, warehouseId)` - Assign warehouse manager to warehouse
- `removeWarehouseManager(userId, warehouseId)` - Remove warehouse manager assignment
- `getWarehouseManagers(warehouseId)` - Get all managers for a warehouse
- `getUserWarehouses(userId)` - Get all warehouses assigned to a user

**File:** `backend/src/routes/warehouseManagers.ts` (new)

- `POST /api/warehouse-managers` - Assign warehouse manager
- `DELETE /api/warehouse-managers/:userId/:warehouseId` - Remove assignment
- `GET /api/warehouse-managers/warehouse/:warehouseId` - Get managers for warehouse
- `GET /api/warehouse-managers/user/:userId` - Get warehouses for user

### Phase 7: Frontend Updates

#### 7.1 Update API Services

**File:** `frontend/src/api/purchaseOrders.ts` (update)

- No changes needed (API calls remain the same)

**File:** `frontend/src/api/goodsReceipts.ts` (update)

- No changes needed

**File:** `frontend/src/api/purchaseInvoices.ts` (update)

- No changes needed

**File:** `frontend/src/api/supplierPayments.ts` (update)

- No changes needed

**File:** `frontend/src/api/warehouseManagers.ts` (new)

- Add API service for warehouse manager assignments

#### 7.2 Update Auth Context

**File:** `frontend/src/contexts/AuthContext.tsx` (update)

- Add `isWarehouseManager: boolean`
- Add `isAccounts: boolean` (if not already present)
- Add `hasWarehouseAccess(warehouseId): boolean` helper
- Add `getUserWarehouses(): Promise<Warehouse[]>` method

#### 7.3 Update Pages - Conditional Rendering

**File:** `frontend/src/pages/admin/PurchaseOrders.tsx` (update)

- Show "Create PO" button only if user is warehouse_manager or admin
- Show "Approve" button only if user is accounts or admin
- Filter POs by warehouse if user is warehouse_manager (show only their warehouses)

**File:** `frontend/src/pages/admin/CreatePurchaseOrder.tsx` (update)

- Filter warehouse dropdown to show only warehouses user has access to
- Show validation error if warehouse_manager tries to create PO for unassigned warehouse

**File:** `frontend/src/pages/admin/PurchaseOrderDetail.tsx` (update)

- Show "Approve" button only if user is accounts or admin
- Show "Create GRN" button only if user is warehouse_manager or admin

**File:** `frontend/src/pages/admin/GoodsReceipts.tsx` (update)

- Show "Create GRN" button only if user is warehouse_manager or admin
- Filter GRNs by warehouse if user is warehouse_manager

**File:** `frontend/src/pages/admin/CreateGoodsReceipt.tsx` (update)

- Filter warehouse dropdown to show only warehouses user has access to
- Show validation error if warehouse_manager tries to create GRN for unassigned warehouse

**File:** `frontend/src/pages/admin/GoodsReceiptDetail.tsx` (update)

- Show "Complete GRN" button only if user is accounts or admin
- Show "Create Invoice" button only if user is accounts or admin

**File:** `frontend/src/pages/admin/PurchaseInvoices.tsx` (update)

- Show "Create Invoice" button only if user is accounts or admin

**File:** `frontend/src/pages/admin/CreatePurchaseInvoice.tsx` (update)

- No changes needed (already restricted to accounts/admin via backend)

**File:** `frontend/src/pages/admin/SupplierPayments.tsx` (update)

- Show "Record Payment" button only if user is accounts or admin

**File:** `frontend/src/pages/admin/WarehouseInventory.tsx` (update)

- Filter warehouses to show only warehouses user has access to
- Show edit controls only if user is warehouse_manager (for their warehouses) or admin

**File:** `frontend/src/pages/admin/Warehouses.tsx` (update)

- Add "Manage Managers" button for each warehouse (admin only)
- Show warehouse manager assignments

#### 7.4 New Pages

**File:** `frontend/src/pages/admin/WarehouseManagers.tsx` (new)

- List all warehouse-manager assignments
- Assign/remove warehouse managers
- Admin only

**File:** `frontend/src/pages/admin/AssignWarehouseManager.tsx` (new)

- Form to assign warehouse manager to warehouse
- Admin only

### Phase 8: Type Definitions

**File:** `backend/src/types/database.ts` (update)

- Add `WarehouseManager` interface
- Update `UserProfile` to include `warehouses?: Warehouse[]` (assigned warehouses)

**File:** `frontend/src/types/database.ts` (update)

- Add `WarehouseManager` interface
- Update user types

## Permission Matrix

| Action | Admin | Accounts | Warehouse Manager | Sales ||--------|-------|----------|-------------------|-------|| Create PO | ✅ | ❌ | ✅ (their warehouses) | ❌ || Approve PO | ✅ | ✅ | ❌ | ❌ || View PO | ✅ | ✅ | ✅ (their warehouses) | ✅ || Create GRN | ✅ | ❌ | ✅ (their warehouses) | ❌ || Approve/Complete GRN | ✅ | ✅ | ❌ | ❌ || View GRN | ✅ | ✅ | ✅ (their warehouses) | ✅ || Create Invoice | ✅ | ✅ | ❌ | ❌ || Update Invoice | ✅ | ✅ | ❌ | ❌ || View Invoice | ✅ | ✅ | ✅ | ❌ || Create Payment | ✅ | ✅ | ❌ | ❌ || Update Payment | ✅ | ✅ | ❌ | ❌ || View Payment | ✅ | ✅ | ❌ | ❌ || Manage Warehouse Inventory | ✅ | ❌ | ✅ (their warehouses) | ❌ || View Warehouse Inventory | ✅ | ✅ | ✅ (their warehouses) | ✅ |

## Implementation Order

1. Database migrations (roles, warehouse_managers table)
2. Update role functions
3. Update middleware
4. Update RLS policies
5. Update controllers
6. Create warehouse managers API
7. Update frontend API services
8. Update frontend pages with conditional rendering
9. Add warehouse manager assignment UI

## Key Considerations