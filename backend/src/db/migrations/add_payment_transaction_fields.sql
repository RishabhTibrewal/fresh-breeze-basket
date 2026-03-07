-- Add transaction_id, cheque_no, and payment_date columns to payments table
-- These fields are needed for bank transfers, cheques, and other payment methods
-- that require transaction references and dates

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS cheque_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.payments.transaction_id IS 'Transaction reference number for bank transfers, NEFT, RTGS, UPI, etc.';
COMMENT ON COLUMN public.payments.cheque_no IS 'Cheque number for cheque payments';
COMMENT ON COLUMN public.payments.payment_date IS 'Date when the payment transaction occurred (for cheques, bank transfers). Different from created_at which is when the record was created.';

