-- Fix NULL confirmation_token and other token fields in auth.users
-- This fixes the error: "Scan error on column index 3, name \"confirmation_token\": converting NULL to string is unsupported"

-- Update confirmation_token from NULL to empty string
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Update recovery_token from NULL to empty string if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'recovery_token'
  ) THEN
    EXECUTE 'UPDATE auth.users SET recovery_token = '''' WHERE recovery_token IS NULL';
  END IF;
END $$;

-- Update email_change_token from NULL to empty string if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'email_change_token'
  ) THEN
    EXECUTE 'UPDATE auth.users SET email_change_token = '''' WHERE email_change_token IS NULL';
  END IF;
END $$;

-- Update email_change_token_new from NULL to empty string if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'email_change_token_new'
  ) THEN
    EXECUTE 'UPDATE auth.users SET email_change_token_new = '''' WHERE email_change_token_new IS NULL';
  END IF;
END $$;

-- Ensure email_confirmed_at is set for users with confirmed emails
-- This helps with users created via admin API that should be auto-confirmed
UPDATE auth.users
SET email_confirmed_at = created_at
WHERE email_confirmed_at IS NULL 
  AND email IS NOT NULL
  AND encrypted_password IS NOT NULL;
