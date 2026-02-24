# Production Readiness Checklist

This checklist ensures the ERP system is ready for production deployment after the explicit order model and return orders refactor.

## Pre-Deployment Validation

### 1. Database Integrity

- [ ] **Run all SQL validation queries** from `validation_queries.sql`
  - [ ] Order table integrity checks pass
  - [ ] Stock movements integrity checks pass
  - [ ] Return order validation checks pass
  - [ ] RLS validation checks pass
  - [ ] No NULL values in required fields
  - [ ] No invalid enum values
  - [ ] No cross-company data leakage

- [ ] **Verify all migrations have been applied**
  - [ ] `20260202_add_explicit_order_fields.sql`
  - [ ] `20260202_backfill_order_fields.sql`
  - [ ] `20260202_update_stock_movements_for_purchase.sql`
  - [ ] `20260202_backfill_stock_movements_source_type.sql`
  - [ ] `20260201_add_stock_movements_rls.sql`

- [ ] **Verify database constraints are active**
  - [ ] `valid_order_type` constraint
  - [ ] `valid_order_source` constraint
  - [ ] `valid_fulfillment_type` constraint
  - [ ] `valid_movement_type` constraint
  - [ ] `valid_source_type` constraint

- [ ] **Verify indexes exist**
  - [ ] `idx_orders_order_type`
  - [ ] `idx_orders_order_source`
  - [ ] `idx_orders_fulfillment_type`
  - [ ] `idx_orders_original_order_id`
  - [ ] `idx_stock_movements_source_type`

### 2. Code Audit Completion

- [ ] **Review code audit checklist** (`code_audit_checklist.md`)
  - [ ] All critical checkpoints verified
  - [ ] All issues documented
  - [ ] All warnings acknowledged

- [ ] **Fix identified issues**
  - [ ] Add `sourceType: 'return'` to `cancelOrder()` reverse movement
  - [ ] Add `order_type='sales'` filter to sales KPI endpoint

- [ ] **Address warnings**
  - [ ] Consider making `sourceType` required for new movements
  - [ ] Add explicit warehouse-company validation

### 3. Risk Assessment

- [ ] **Review risk matrix** (`risk_matrix.md`)
  - [ ] All critical risks mitigated
  - [ ] High risks have mitigation plans
  - [ ] Medium risks are acceptable

- [ ] **Implement high-priority recommendations**
  - [ ] Add explicit database transactions for critical operations
  - [ ] Add database-level locking for return creation
  - [ ] Fix missing filters in KPI endpoints

### 4. Testing

#### 4.1 Unit Tests

- [ ] **OrderService tests**
  - [ ] `createOrder()` with all order types
  - [ ] `updateOrderStatus()` for sales and return orders
  - [ ] `cancelOrder()` for pending and completed orders
  - [ ] Stock movement creation logic

- [ ] **InventoryService tests**
  - [ ] `handleOrderStockMovement()` for sales and returns
  - [ ] `handlePurchaseStockMovement()` for GRNs
  - [ ] `recordStockMovement()` with correct `sourceType`

- [ ] **Return order controller tests**
  - [ ] Full return creation
  - [ ] Partial return creation
  - [ ] Multiple partial returns
  - [ ] Return quantity validation
  - [ ] Permission checks

#### 4.2 Integration Tests

- [ ] **E-commerce order flow**
  - [ ] Order creation with explicit fields
  - [ ] Status update creates stock movement
  - [ ] Order cancellation releases reserved stock

- [ ] **POS order flow**
  - [ ] Order creation with `order_source='pos'`
  - [ ] Stock movement on completion

- [ ] **Sales executive order flow**
  - [ ] Order creation with `order_source='sales'`
  - [ ] Role-based filtering works

- [ ] **Purchase flow**
  - [ ] GRN completion creates PURCHASE stock movement
  - [ ] Purchase invoice creates order entry (no stock movement)
  - [ ] Purchase order in `orders` table is reporting-only

- [ ] **Return flow**
  - [ ] Return order creation links to original
  - [ ] Return order inherits fields from original
  - [ ] Return completion increases stock
  - [ ] Multiple partial returns work correctly
  - [ ] Return quantity validation prevents over-return

#### 4.3 Edge Case Tests

- [ ] **Return after cancellation** - Should fail
- [ ] **Return quantity exceeds original** - Should fail
- [ ] **Return for non-existent item** - Should fail
- [ ] **Customer returns another's order** - Should fail (unless admin/sales)
- [ ] **Concurrent return creation** - Should handle gracefully
- [ ] **Order status transitions** - All paths tested

#### 4.4 Performance Tests

- [ ] **Return validation performance** - Test with large number of existing returns
- [ ] **Stock movement queries** - Test with large dataset
- [ ] **Analytics queries** - Test with large order history
- [ ] **Index usage** - Verify indexes are being used

### 5. Security & Access Control

- [ ] **RLS policies verified**
  - [ ] Company-level isolation works
  - [ ] Warehouse-level isolation works
  - [ ] Role-based access works
  - [ ] Cross-company access blocked

- [ ] **Permission checks verified**
  - [ ] Admin can return any order
  - [ ] Sales can return their customers' orders
  - [ ] Customers can only return their own orders
  - [ ] Warehouse managers can create stock movements

- [ ] **Input validation verified**
  - [ ] Return quantity validation
  - [ ] Enum value validation
  - [ ] Foreign key validation
  - [ ] Company context validation

### 6. Monitoring & Observability

- [ ] **Logging configured**
  - [ ] Order creation logged
  - [ ] Stock movement creation logged
  - [ ] Return order creation logged
  - [ ] Error cases logged

- [ ] **Metrics configured**
  - [ ] Order creation rate by type
  - [ ] Stock movement rate by type
  - [ ] Return order rate
  - [ ] Failed return attempts

- [ ] **Alerts configured**
  - [ ] Constraint violations
  - [ ] NULL values in required fields
  - [ ] Cross-company data access attempts
  - [ ] Stock movement failures

### 7. Documentation

- [ ] **API documentation updated**
  - [ ] Return order endpoint documented
  - [ ] Order fields documented
  - [ ] Stock movement fields documented

- [ ] **Database schema documented**
  - [ ] Order table fields explained
  - [ ] Stock movements table fields explained
  - [ ] Constraints documented

- [ ] **Business logic documented**
  - [ ] Order type semantics
  - [ ] Order source semantics
  - [ ] Fulfillment type semantics
  - [ ] Return order flow

### 8. Rollback Plan

- [ ] **Rollback procedure documented**
  - [ ] Database migration rollback steps
  - [ ] Code rollback steps
  - [ ] Data recovery procedure

- [ ] **Rollback tested**
  - [ ] Migration rollback tested in staging
  - [ ] Code rollback tested in staging

### 9. Deployment Checklist

- [ ] **Pre-deployment**
  - [ ] All tests passing
  - [ ] Code review completed
  - [ ] Documentation updated
  - [ ] Risk assessment reviewed
  - [ ] Stakeholders notified

- [ ] **Deployment steps**
  - [ ] Backup database
  - [ ] Run migrations in order
  - [ ] Verify migrations succeeded
  - [ ] Deploy backend code
  - [ ] Deploy frontend code
  - [ ] Run validation queries
  - [ ] Verify system functionality

- [ ] **Post-deployment**
  - [ ] Monitor error logs
  - [ ] Monitor performance metrics
  - [ ] Verify critical flows work
  - [ ] Check for constraint violations
  - [ ] Verify RLS policies active

### 10. Production Monitoring

- [ ] **First 24 hours**
  - [ ] Monitor order creation rates
  - [ ] Monitor stock movement rates
  - [ ] Monitor return order creation
  - [ ] Check for errors
  - [ ] Verify data consistency

- [ ] **First week**
  - [ ] Review analytics accuracy
  - [ ] Check for performance issues
  - [ ] Verify no data corruption
  - [ ] Collect user feedback

- [ ] **Ongoing**
  - [ ] Run validation queries weekly
  - [ ] Review error logs daily
  - [ ] Monitor performance metrics
  - [ ] Review risk matrix quarterly

## Critical Path Items

These items **MUST** be completed before production:

1. ✅ All database migrations applied
2. ✅ All validation queries pass
3. ✅ Code audit issues fixed
4. ✅ RLS policies verified
5. ✅ Return order flow tested end-to-end
6. ✅ Stock movement logic verified
7. ✅ Analytics queries verified
8. ✅ Rollback plan documented

## Optional Enhancements

These items can be addressed post-deployment:

1. Add explicit database transactions
2. Add database-level locking for returns
3. Make `sourceType` required for new movements
4. Add explicit warehouse-company validation
5. Enhanced monitoring and alerting

## Sign-Off

- [ ] **Backend Lead** - Code review and testing complete
- [ ] **Database Admin** - Migrations and constraints verified
- [ ] **QA Lead** - All tests passing
- [ ] **Security Lead** - RLS and permissions verified
- [ ] **Product Owner** - Business logic verified
- [ ] **DevOps Lead** - Deployment plan reviewed

## Notes

- All validation queries are in `backend/src/db/validation_queries.sql`
- Code audit results are in `backend/docs/code_audit_checklist.md`
- Risk assessment is in `backend/docs/risk_matrix.md`
- Run validation queries after deployment to verify data integrity

