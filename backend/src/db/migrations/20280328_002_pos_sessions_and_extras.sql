
-- 1. POS Sessions table
CREATE TABLE IF NOT EXISTS pos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES warehouses(id),
  cashier_id uuid NOT NULL REFERENCES auth.users(id),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric DEFAULT 0,
  closing_cash numeric,
  expected_cash numeric,
  status text DEFAULT 'open' CHECK (status IN ('open','closed'))
);
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: company-scoped access
CREATE POLICY "pos_sessions_company_access" ON pos_sessions
  FOR ALL USING (company_id = current_company_id());

-- 2. Add receipt_number, pos_session_id, delivery_address to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_number varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_session_id uuid REFERENCES pos_sessions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address jsonb;

-- 3. Add cash_tendered and change_given to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cash_tendered numeric;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS change_given numeric;

-- 4. order_item_modifiers (selected modifiers per order line)
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id uuid NOT NULL REFERENCES modifiers(id),
  price_adjust numeric DEFAULT 0,
  company_id uuid NOT NULL DEFAULT current_company_id() REFERENCES companies(id)
);
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_modifiers_company_access" ON order_item_modifiers
  FOR ALL USING (company_id = current_company_id());
;