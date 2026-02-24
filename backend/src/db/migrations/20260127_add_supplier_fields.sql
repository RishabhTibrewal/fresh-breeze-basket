-- Add new fields to suppliers table
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_balance DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS udyam_registration_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);

-- Add new fields to supplier_bank_accounts table
ALTER TABLE supplier_bank_accounts
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),

-- Add comments for documentation
COMMENT ON COLUMN suppliers.opening_balance IS 'Opening balance for the supplier';
COMMENT ON COLUMN suppliers.closing_balance IS 'Closing balance for the supplier';
COMMENT ON COLUMN suppliers.vendor_name IS 'Vendor name';
COMMENT ON COLUMN suppliers.trade_name IS 'Trade name of the supplier';
COMMENT ON COLUMN suppliers.legal_name IS 'Legal name of the supplier';
COMMENT ON COLUMN suppliers.udyam_registration_number IS 'Udyam Registration Number (URN) for MSME details';
COMMENT ON COLUMN suppliers.pan_number IS 'PAN Number of the supplier';
COMMENT ON COLUMN supplier_bank_accounts.bank_address IS 'Address of the bank branch';
COMMENT ON COLUMN supplier_bank_accounts.pin_code IS 'Pin code of the bank branch';

