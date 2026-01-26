-- RLS Policies for purchase_invoice_items table

-- Company admins can manage purchase_invoice_items
CREATE POLICY "Company admins can manage purchase_invoice_items"
  ON procurement.purchase_invoice_items FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

-- Accounts can manage purchase_invoice_items
CREATE POLICY "Accounts can manage purchase_invoice_items"
  ON procurement.purchase_invoice_items FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

-- Warehouse managers can view purchase_invoice_items
CREATE POLICY "Warehouse managers can view purchase_invoice_items"
  ON procurement.purchase_invoice_items FOR SELECT TO authenticated
  USING (
    (
      public.is_warehouse_manager(auth.uid())
      AND company_id = public.current_company_id()
    )
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin', 'accounts', 'sales'], public.current_company_id())
      AND company_id = public.current_company_id()
    )
  );

-- Sales can view purchase_invoice_items
CREATE POLICY "Sales can view purchase_invoice_items"
  ON procurement.purchase_invoice_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales', public.current_company_id())
    AND company_id = public.current_company_id()
  );

