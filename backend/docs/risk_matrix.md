# Risk Matrix - ERP System Validation

This document identifies and categorizes risks related to the explicit order model and return orders implementation.

## Risk Assessment Scale

- **Probability**: Low / Medium / High
- **Impact**: Low / Medium / High / Critical
- **Overall Risk**: Low / Medium / High / Critical

## 1. Data Consistency Risks

### 1.1 NULL Values in Required Fields

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| `order_type`, `order_source`, or `fulfillment_type` is NULL | Low | High | Medium | Database constraints + backfill migration + validation queries |
| `original_order_id` set for non-return orders | Low | Medium | Low | Code logic ensures only returns have this field |
| Return orders missing `original_order_id` | Low | High | Medium | Validation in `createReturnOrder()` + database constraint |

**Mitigation Status**: ✅ Constraints in place, backfill completed, validation queries available

### 1.2 Invalid Enum Values

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Invalid `order_type` values | Low | High | Medium | Database CHECK constraint |
| Invalid `order_source` values | Low | Medium | Low | Database CHECK constraint |
| Invalid `fulfillment_type` values | Low | Medium | Low | Database CHECK constraint |

**Mitigation Status**: ✅ All constraints in place

### 1.3 Cross-Company Data Leakage

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Return order links to order from different company | Low | Critical | High | RLS policies + explicit company_id checks in code |
| Stock movement references warehouse from different company | Low | Critical | High | RLS policies + foreign key constraints |

**Mitigation Status**: ✅ RLS policies active, company_id checks in controllers

## 2. Stock Safety Risks

### 2.1 Double Inventory Updates

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Stock movement created twice for same order | Low | High | Medium | `inventory_updated` flag prevents double execution |
| GRN completion creates duplicate stock movements | Low | High | Medium | Single call to `handlePurchaseStockMovement()` |
| Purchase invoice creates duplicate stock movements | Low | High | Medium | Invoice creation doesn't call stock movement functions |

**Mitigation Status**: ✅ Flag-based protection in place, single call pattern verified

### 2.2 Incorrect Stock Quantities

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Sales order increases stock instead of decreasing | Low | Critical | High | `handleOrderStockMovement()` uses negative quantity for sales |
| Return order decreases stock instead of increasing | Low | Critical | High | `handleOrderStockMovement()` uses positive quantity for returns |
| Purchase order creates stock movement (shouldn't) | Low | Medium | Low | Purchase orders in `orders` table are reporting-only, no stock movements |

**Mitigation Status**: ✅ Logic verified in code audit

### 2.3 Missing Stock Movements

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Completed GRN doesn't create stock movement | Low | High | Medium | Validation query checks all completed GRNs have movements |
| Completed return order doesn't increase stock | Low | High | Medium | `updateOrderStatus()` handles return orders |
| Completed sales order doesn't decrease stock | Low | High | Medium | `updateOrderStatus()` handles sales orders |

**Mitigation Status**: ✅ Logic in place, validation queries available

## 3. Return Order Risks

### 3.1 Quantity Validation

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Return quantity exceeds original order quantity | Medium | High | High | Cumulative quantity validation in `createReturnOrder()` |
| Multiple partial returns exceed original total | Medium | High | High | Validation queries existing returns and calculates cumulative |
| Return for non-existent item in original order | Low | Medium | Low | Validation checks item exists in original order |

**Mitigation Status**: ✅ Validation logic implemented

### 3.2 Permission Issues

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Customer returns another customer's order | Low | Medium | Low | Permission check validates `user_id` match |
| Return order created for cancelled original | Low | Medium | Low | Validation checks original order status |

**Mitigation Status**: ✅ Permission checks in place

### 3.3 Data Integrity

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Return order doesn't inherit original order fields | Low | Medium | Low | Code explicitly inherits `order_source`, `fulfillment_type`, `user_id` |
| Return order links to invalid original order | Low | High | Medium | Foreign key constraint + validation in `createReturnOrder()` |

**Mitigation Status**: ✅ Inheritance logic verified, foreign key constraint in place

## 4. Transaction Safety Risks

### 4.1 Partial Failures

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Order created but stock movement fails | Medium | High | High | No explicit transaction wrapping - relies on application-level rollback |
| Stock movement created but `inventory_updated` flag not set | Low | High | Medium | Both operations in same function, but not atomic |
| Return order created but stock update fails on completion | Medium | High | High | No explicit transaction wrapping |

**Mitigation Status**: ⚠️ WARNING - No explicit database transactions, relies on application logic

**Recommendation**: Consider wrapping critical operations in database transactions

### 4.2 Race Conditions

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Multiple concurrent returns for same order | Low | Medium | Low | `inventory_updated` flag prevents double stock updates, but validation happens before order creation |
| Concurrent status updates causing double stock movements | Low | High | Medium | `inventory_updated` flag provides protection |

**Mitigation Status**: ⚠️ WARNING - Race condition possible in return validation

**Recommendation**: Add database-level locking or optimistic locking for return creation

## 5. Reporting & Analytics Risks

### 5.1 Incorrect Filtering

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Sales analytics includes purchase orders | Low | Medium | Low | Most queries filter `order_type='sales'` |
| Sales analytics includes return orders | Low | Medium | Low | Most queries filter `order_type='sales'` |
| KPI endpoints include wrong order types | Low | Medium | Low | Most modules filter correctly, but 'sales' module missing filter |

**Mitigation Status**: ⚠️ ISSUE - 'sales' module KPI missing `order_type` filter

**Recommendation**: Add explicit filter to sales KPI endpoint

### 5.2 Legacy NULL-Based Inference

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Code still uses NULL checks to infer order source | Low | Low | Low | Code audit found no NULL-based inference patterns |
| Analytics queries use implicit logic instead of explicit fields | Low | Low | Low | All queries use explicit fields |

**Mitigation Status**: ✅ No legacy patterns found

## 6. Performance Risks

### 6.1 Missing Indexes

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Queries on `order_type` are slow | Low | Medium | Low | Index exists: `idx_orders_order_type` |
| Queries on `order_source` are slow | Low | Medium | Low | Index exists: `idx_orders_order_source` |
| Queries on `original_order_id` are slow | Low | Medium | Low | Index exists: `idx_orders_original_order_id` |
| Queries on `stock_movements.source_type` are slow | Low | Medium | Low | Index exists: `idx_stock_movements_source_type` |

**Mitigation Status**: ✅ All critical indexes in place

### 6.2 N+1 Query Problems

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Return validation queries existing returns per item | Low | Medium | Low | Single query fetches all existing returns, then processes in memory |
| Stock movement creation loops through items | Low | Low | Low | Acceptable for typical order sizes |

**Mitigation Status**: ✅ No significant N+1 issues identified

## 7. Migration & Backfill Risks

### 7.1 Data Backfill Issues

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Old orders have NULL `order_source` | Low | Medium | Low | Backfill migration completed |
| Old orders have NULL `fulfillment_type` | Low | Medium | Low | Backfill migration completed |
| Old stock movements have NULL `source_type` | Low | Medium | Low | Backfill migration completed |

**Mitigation Status**: ✅ Backfill migrations completed

### 7.2 Constraint Violations

| Risk | Probability | Impact | Overall Risk | Mitigation |
|------|-------------|--------|--------------|------------|
| Backfilled data violates new constraints | Low | High | Medium | Constraints added with `NOT VALID`, then validated after backfill |
| Invalid enum values in existing data | Low | High | Medium | Backfill migration normalizes values before constraint validation |

**Mitigation Status**: ✅ Constraints validated after backfill

## Risk Summary

### Critical Risks: 0
### High Risks: 4
1. Cross-company data leakage (mitigated by RLS)
2. Incorrect stock quantities (mitigated by code logic)
3. Return quantity exceeds original (mitigated by validation)
4. Partial transaction failures (no explicit mitigation)

### Medium Risks: 8
- Mostly related to data consistency and stock safety
- All have mitigations in place

### Low Risks: 12
- Mostly edge cases and performance concerns
- Acceptable for production

## Recommended Actions

### High Priority
1. **Add explicit database transactions** for order creation + stock movement operations
2. **Fix missing `order_type` filter** in sales KPI endpoint
3. **Add `sourceType` to cancelOrder()** reverse movement

### Medium Priority
1. **Add database-level locking** for return order creation to prevent race conditions
2. **Add explicit warehouse-company validation** in `recordStockMovement()`
3. **Consider making `sourceType` required** for new stock movements

### Low Priority
1. **Monitor performance** of return validation queries on large datasets
2. **Add monitoring/alerting** for constraint violations
3. **Document transaction boundaries** for future developers

