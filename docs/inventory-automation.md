# Inventory Automation in Fresh Breeze Basket

This document describes the automated inventory update system implemented in Fresh Breeze Basket.

## Overview

The system automatically updates product inventory five minutes after an order is placed. This implementation:

1. Adds a delay to allow for possible order cancellations
2. Only updates inventory after the waiting period
3. Automatically restores inventory if an updated order is cancelled
4. Prevents race conditions and ensures inventory consistency
5. Handles edge cases like cancellations and status changes

## Implementation Details

### Database Schema Changes

- Added `inventory_updated` boolean field to the `orders` table (default: false)
- Enabled PostgreSQL extensions:
  - `pg_cron` for scheduling the inventory update
  - `pg_net` for making HTTP requests from the database

### Database Functions

1. **`decrement_quantity(item_id UUID, amount INTEGER)`**:
   - Safely decrements inventory with proper locking to prevent race conditions
   - Ensures quantities never go below zero

2. **`schedule_inventory_update()`**:
   - Triggered when orders are created or their status changes
   - Schedules inventory updates 5 minutes after an order is confirmed
   - Only applies to orders with status 'confirmed' or 'processing'

### Supabase Edge Function

The `update-inventory` Edge Function:
- Processes scheduled inventory updates
- Verifies the order status before making inventory changes
- Updates the `inventory_updated` flag to prevent duplicate inventory updates
- Handles edge cases and errors

### Order Cancellation Logic

- When an order is cancelled, the `inventory_updated` flag is reset
- If inventory was already deducted, it is automatically restored
- Cancellation is only allowed within 5 minutes of order placement

## Flow

1. Customer places an order
2. Order status is initially set to 'pending'
3. Database trigger schedules an inventory update in 5 minutes
4. After 5 minutes:
   - If the order is still valid (not cancelled), inventory is deducted
   - The order status is automatically updated to 'processing'
   - The `inventory_updated` flag is set to true
5. If order is cancelled:
   - If before the 5-minute mark: No inventory was deducted, so no action needed
   - If after inventory update: Database trigger automatically restores the inventory
   - The `inventory_updated` flag is used to track and ensure accurate restoration

## Advantages

- **Reliable**: Updates happen in the database layer, not dependent on client connections
- **Timely**: 5-minute delay provides a window for order cancellations
- **Safe**: Prevents overselling by using atomic database operations
- **Consistent**: Handles race conditions and prevents duplicate inventory updates 