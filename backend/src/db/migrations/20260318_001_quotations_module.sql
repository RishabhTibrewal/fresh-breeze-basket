-- 20260318_001_quotations_module.sql

-- 1. Create quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null default current_company_id() references public.companies(id),
  lead_id uuid references public.leads(id),
  customer_id uuid references public.customers(id),
  sales_executive_id uuid references auth.users(id),
  status varchar not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'revised')),
  quotation_number varchar,
  valid_until date,
  total_amount numeric default 0,
  tax_amount numeric default 0,
  discount_amount numeric default 0,
  notes text,
  terms_and_conditions text,
  version integer not null default 1,
  parent_quotation_id uuid references public.quotations(id),
  converted_to_order_id uuid references public.orders(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create quotation_items table
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  company_id uuid not null default current_company_id() references public.companies(id),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric not null,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- 3. Add columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lead_id uuid references public.leads(id),
  ADD COLUMN IF NOT EXISTS quotation_id uuid references public.quotations(id);

-- 4. Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for quotations
CREATE POLICY "Company admins and sales can manage quotations" ON public.quotations
  FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin'::user_role, 'sales'::user_role]))
    )
  )
  WITH CHECK (
    company_id = current_company_id() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin'::user_role, 'sales'::user_role]))
    )
  );

CREATE POLICY "Company users can view own quotations" ON public.quotations
  FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id() AND (
      created_by = auth.uid() OR sales_executive_id = auth.uid()
    )
  );

-- RLS Policies for quotation_items
CREATE POLICY "Company admins and sales can manage quotation items" ON public.quotation_items
  FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin'::user_role, 'sales'::user_role]))
    )
  )
  WITH CHECK (
    company_id = current_company_id() AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin'::user_role, 'sales'::user_role]))
    )
  );

CREATE POLICY "Company users can view own quotation items" ON public.quotation_items
  FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id() AND (
      EXISTS (
        SELECT 1 FROM public.quotations q 
        WHERE q.id = quotation_items.quotation_id AND (q.created_by = auth.uid() OR q.sales_executive_id = auth.uid())
      )
    )
  );

-- 6. Trigger for updated_at
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Trigger & Function for quotation_number
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_val integer;
  year_prefix text;
BEGIN
  year_prefix := to_char(NEW.created_at, 'YYYY');
  
  -- Prevent concurrent inserts getting the same number
  LOCK TABLE public.quotations IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(
    MAX(regexp_replace(quotation_number, '^QT-' || year_prefix || '-', '')::integer),
    0
  ) + 1 INTO seq_val
  FROM public.quotations
  WHERE company_id = NEW.company_id AND quotation_number LIKE 'QT-' || year_prefix || '-%';

  NEW.quotation_number := 'QT-' || year_prefix || '-' || lpad(seq_val::text, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_quotation_number_trigger
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  WHEN (NEW.quotation_number IS NULL)
  EXECUTE FUNCTION public.generate_quotation_number();

-- 8. accept_quotation function
CREATE OR REPLACE FUNCTION public.accept_quotation(p_quotation_id uuid)
RETURNS uuid AS $$
DECLARE
  v_quotation record;
  v_new_order_id uuid;
  v_customer_user_id uuid;
BEGIN
  -- 1. Get the quotation
  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation % not found', p_quotation_id;
  END IF;

  IF v_quotation.status = 'accepted' THEN
    RAISE EXCEPTION 'Quotation % is already accepted', p_quotation_id;
  END IF;

  -- 2. Update quotation status
  UPDATE public.quotations
  SET status = 'accepted'
  WHERE id = p_quotation_id;

  -- Figure out the user_id for the order if there's a customer
  IF v_quotation.customer_id IS NOT NULL THEN
    SELECT user_id INTO v_customer_user_id
    FROM public.customers
    WHERE id = v_quotation.customer_id;
  END IF;

  -- 3. Create order
  INSERT INTO public.orders (
    company_id,
    user_id,
    sales_executive_id,
    status,
    total_amount,
    order_source,
    quotation_id,
    lead_id
  ) VALUES (
    v_quotation.company_id,
    COALESCE(v_customer_user_id, v_quotation.created_by), -- Default back to creator if no customer user exists
    v_quotation.sales_executive_id,
    'pending',
    v_quotation.total_amount,
    'sales',
    p_quotation_id,
    v_quotation.lead_id
  ) RETURNING id INTO v_new_order_id;

  -- 4. Copy items
  INSERT INTO public.order_items (
    company_id,
    order_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
    tax_amount
  )
  SELECT
    company_id,
    v_new_order_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
    tax_amount
  FROM public.quotation_items
  WHERE quotation_id = p_quotation_id;

  -- 5. Set converted_to_order_id on quotation
  UPDATE public.quotations
  SET converted_to_order_id = v_new_order_id
  WHERE id = p_quotation_id;

  -- 6. Update lead if any
  IF v_quotation.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET converted_at = now(),
        stage = 'won'
    WHERE id = v_quotation.lead_id;
  END IF;

  RETURN v_new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
