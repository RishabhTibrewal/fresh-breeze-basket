-- Migration: Add customer account type & business fields, delivery slot & date to orders, and company currency setting

-- 1. Profiles Table: Add customer_type and business details
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_type       VARCHAR(20) DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
  ADD COLUMN IF NOT EXISTS trn_number          TEXT,
  ADD COLUMN IF NOT EXISTS tax_id              TEXT,
  ADD COLUMN IF NOT EXISTS business_address    TEXT,
  ADD COLUMN IF NOT EXISTS business_city       TEXT,
  ADD COLUMN IF NOT EXISTS business_state      TEXT,
  ADD COLUMN IF NOT EXISTS business_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS business_country    TEXT;

-- 2. Customers Table: Add customer_type and business details
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type       VARCHAR(20) DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id              TEXT,
  ADD COLUMN IF NOT EXISTS business_address    TEXT,
  ADD COLUMN IF NOT EXISTS business_city       TEXT,
  ADD COLUMN IF NOT EXISTS business_state      TEXT,
  ADD COLUMN IF NOT EXISTS business_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS business_country    TEXT;

-- 3. Orders Table: Add delivery_slot and delivery_date
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_slot VARCHAR(100),
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- 4. Companies Table: Add currency column
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
