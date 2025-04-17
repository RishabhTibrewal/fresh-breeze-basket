# Database Schema Setup

This directory contains the SQL schema for the Fresh Breeze Basket application and scripts to apply it to your Supabase database.

## Files

- `supabase_schema.sql`: The SQL schema for the database
- `apply-schema.js`: A Node.js script to apply the schema to Supabase

## How to Apply the Schema

### Option 1: Using the Supabase Dashboard (Recommended)

1. Log in to your [Supabase Dashboard](https://app.supabase.io/)
2. Select your project
3. Go to the SQL Editor
4. Copy the contents of `supabase_schema.sql`
5. Paste into the SQL Editor
6. Click "Run" to execute the SQL

### Option 2: Using the Node.js Script

1. Make sure your `.env` file in the backend directory contains:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Run the script:
   ```bash
   node src/db/apply-schema.js
   ```

## Schema Overview

The schema includes the following tables:

- `categories`: Product categories
- `products`: Product information
- `orders`: Order details
- `order_items`: Items within orders
- `payments`: Payment information

And the following functions:

- `update_stock`: Updates product stock when orders are placed
- `is_admin`: Checks if a user has admin privileges

## Row Level Security (RLS)

The schema includes Row Level Security policies to ensure:

- Products and categories are viewable by everyone
- Orders, order items, and payments are only viewable by the user who created them

## Notes

- The script assumes that the `profiles` table already exists in your Supabase database
- If you need to modify the schema, update the `supabase_schema.sql` file and reapply it 