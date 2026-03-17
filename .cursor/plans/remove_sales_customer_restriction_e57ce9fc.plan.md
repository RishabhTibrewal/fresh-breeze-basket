---
name: Remove Sales Customer Restriction
overview: Remove the restriction that limits sales executives to only view and act on customers assigned to them. Sales executives will see all company customers. Includes replacing deprecated `profiles.role` in RLS with `user_roles`/`roles`-based checks.
todos: []
isProject: false
---

# Remove Sales Executive Customer Association Restriction

## Summary

Remove the restriction that limits sales executives to only view and act on customers where `sales_executive_id` matches their user ID. Sales executives will see and interact with all customers in their `company_id`.

**Important:** The customers RLS policy in `20260118_rls_company_isolation.sql` uses deprecated `profiles.role = 'sales'`. Per your note, the project uses the `user_roles` and `roles` tables. This plan includes a migration to replace those deprecated checks with `is_admin_or_sales(auth.uid())`, which uses `has_any_role` and the `user_roles` table.

---

## Part 1: New RLS Migration (profiles.role deprecation)

The current customers policy uses `EXISTS (SELECT 1 FROM profiles WHERE profiles.role = 'sales')`—deprecated. Create a new migration that:

1. **Drops** the existing "Company sales can view customers" and "Company sales can manage customers" policies.
2. **Creates** updated policies that:
  - Use `public.is_admin_or_sales(auth.uid())` (which calls `has_any_role` against `user_roles`/`roles`) instead of `profiles.role`.
  - Allow any admin or sales user to see all company customers (remove `sales_executive_id = auth.uid()` for sales).

```sql
-- New policy: company_id + admin or sales role (from user_roles)
CREATE POLICY "Company sales can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );

CREATE POLICY "Company sales can manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );
```

File: `backend/src/db/migrations/YYYYMMDD_customers_rls_use_roles_table.sql` (use current date).

---

## Part 2: Backend Controller Changes

The backend uses `supabaseAdmin` (service role), which bypasses RLS. The restriction is enforced in controller code. Remove all `sales_executive_id` filters and ownership checks for sales users.

### 2.1 [backend/src/controllers/customerController.ts](backend/src/controllers/customerController.ts)


| Function                                              | Change                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `getCustomers` (lines 41-46)                          | Remove `if (isSales && !isAdmin) { query = query.eq('sales_executive_id', userId); }` |
| `getCustomersWithCredit` (lines 1232-1235)            | Same removal                                                                          |
| `addCreditPeriod` (lines 730-733)                     | Remove `sales_executive_id` filter from customer query                                |
| `getCustomerCreditStatus` (lines 827-830)             | Same removal                                                                          |
| `addCustomerAddress` (lines ~851-853)                 | Remove `sales_executive_id` filter from customer lookup                               |
| Any `updateCustomerAddress` / `deleteCustomerAddress` | Same for customer validation                                                          |


### 2.2 [backend/src/controllers/orders.ts](backend/src/controllers/orders.ts)


| Location                                   | Change                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Order list (lines 58-68, 102-104, 138-141) | Remove `if (isSales && !isAdmin)` block that restricts to `customerUserIds`; do not filter orders by sales exec's customers |
| `getOrderById` (lines 362-370)             | Remove `customer.sales_executive_id === userId` check                                                                       |
| Update order status (lines 823-830)        | Same removal                                                                                                                |
| `getSalesOrders` (lines 1466-1468)         | Fetch all company customers, not filtered by `sales_executive_id`                                                           |
| `getSalesAnalytics` (lines 1665-1674)      | Same                                                                                                                        |
| Analytics targets (lines 1939-1942)        | Keep as-is (sales targets are per-executive)                                                                                |


### 2.3 [backend/src/controllers/orderController.ts](backend/src/controllers/orderController.ts)


| Location                    | Change                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `createOrder` (lines 78-86) | Remove `if (!isAdmin && customer.sales_executive_id !== sales_executive_id)` block |
| Get order (line 780)        | Remove customer ownership check                                                    |
| Update order (line 824)     | Same                                                                               |


### 2.4 [backend/src/controllers/payments.ts](backend/src/controllers/payments.ts)


| Location                                   | Change                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| List payments (lines 1071-1090, 1099-1115) | Remove `if (isSales && !isAdmin)` block; return all company payments for sales |
| Single payment access (lines 655-670)      | Remove `customer.sales_executive_id !== userId` check                          |


### 2.5 [backend/src/controllers/updateOrderStatus.ts](backend/src/controllers/updateOrderStatus.ts)


| Location    | Change                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Lines 52-58 | Remove `customer.sales_executive_id === userId` check; allow sales to update status for any company order |


---

## Scope

- **Included:** Customers, orders, payments, credit management for sales users.
- **Excluded:** Leads (keep per-lead ownership).
- **Unchanged:** `sales_executive_id` column (still used for assignment/analytics); frontend.

---

## Verification

1. Sales executive sees all company customers.
2. Sales can create orders for any company customer.
3. Sales can view/update orders and payments for any company customer.
4. RLS uses `is_admin_or_sales` (user_roles/roles) only; no references to `profiles.role`.

