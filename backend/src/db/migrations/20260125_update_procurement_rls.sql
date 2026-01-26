-- Update procurement RLS policies for warehouse managers and accounts

-- ============================================
-- Purchase Orders Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Company admins can manage purchase_orders" ON procurement.purchase_orders;
DROP POLICY IF EXISTS "Sales can view purchase_orders" ON procurement.purchase_orders;

-- Policy: Admins can manage all purchase orders
CREATE POLICY "Company admins can manage purchase_orders"
  ON procurement.purchase_orders FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

-- Policy: Accounts can approve/manage purchase orders
CREATE POLICY "Accounts can manage purchase_orders"
  ON procurement.purchase_orders FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

-- Policy: Warehouse managers can create/view purchase orders for their warehouses
CREATE POLICY "Warehouse managers can create purchase_orders"
  ON procurement.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
  );

CREATE POLICY "Warehouse managers can view their purchase_orders"
  ON procurement.purchase_orders FOR SELECT TO authenticated
  USING (
    (
      public.is_warehouse_manager(auth.uid())
      AND company_id = public.current_company_id()
      AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
    )
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin', 'accounts', 'sales'], public.current_company_id())
      AND company_id = public.current_company_id()
    )
  );

-- Policy: Sales can view purchase orders
CREATE POLICY "Sales can view purchase_orders"
  ON procurement.purchase_orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales', public.current_company_id())
    AND company_id = public.current_company_id()
  );

-- ============================================
-- Purchase Order Items Policies
-- ============================================

DROP POLICY IF EXISTS "Company admins can manage purchase_order_items" ON procurement.purchase_order_items;

CREATE POLICY "Company admins can manage purchase_order_items"
  ON procurement.purchase_order_items FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Accounts can manage purchase_order_items"
  ON procurement.purchase_order_items FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can manage purchase_order_items"
  ON procurement.purchase_order_items FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM procurement.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_warehouse_access(auth.uid(), po.warehouse_id, public.current_company_id())
    )
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM procurement.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
      AND public.has_warehouse_access(auth.uid(), po.warehouse_id, public.current_company_id())
    )
  );

CREATE POLICY "Users can view purchase_order_items"
  ON procurement.purchase_order_items FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- ============================================
-- Goods Receipts Policies
-- ============================================

DROP POLICY IF EXISTS "Company admins can manage goods_receipts" ON procurement.goods_receipts;
DROP POLICY IF EXISTS "Sales can view goods_receipts" ON procurement.goods_receipts;

CREATE POLICY "Company admins can manage goods_receipts"
  ON procurement.goods_receipts FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Accounts can manage goods_receipts"
  ON procurement.goods_receipts FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can create goods_receipts"
  ON procurement.goods_receipts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
  );

CREATE POLICY "Warehouse managers can view their goods_receipts"
  ON procurement.goods_receipts FOR SELECT TO authenticated
  USING (
    (
      public.is_warehouse_manager(auth.uid())
      AND company_id = public.current_company_id()
      AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
    )
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin', 'accounts', 'sales'], public.current_company_id())
      AND company_id = public.current_company_id()
    )
  );

CREATE POLICY "Sales can view goods_receipts"
  ON procurement.goods_receipts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales', public.current_company_id())
    AND company_id = public.current_company_id()
  );

-- ============================================
-- Goods Receipt Items Policies
-- ============================================

DROP POLICY IF EXISTS "Company admins can manage goods_receipt_items" ON procurement.goods_receipt_items;

CREATE POLICY "Company admins can manage goods_receipt_items"
  ON procurement.goods_receipt_items FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Accounts can manage goods_receipt_items"
  ON procurement.goods_receipt_items FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can manage goods_receipt_items"
  ON procurement.goods_receipt_items FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM procurement.goods_receipts gr
      WHERE gr.id = goods_receipt_items.goods_receipt_id
      AND public.has_warehouse_access(auth.uid(), gr.warehouse_id, public.current_company_id())
    )
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM procurement.goods_receipts gr
      WHERE gr.id = goods_receipt_items.goods_receipt_id
      AND public.has_warehouse_access(auth.uid(), gr.warehouse_id, public.current_company_id())
    )
  );

CREATE POLICY "Users can view goods_receipt_items"
  ON procurement.goods_receipt_items FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- ============================================
-- Purchase Invoices Policies
-- ============================================

DROP POLICY IF EXISTS "Company admins can manage purchase_invoices" ON procurement.purchase_invoices;
DROP POLICY IF EXISTS "Sales can view purchase_invoices" ON procurement.purchase_invoices;

CREATE POLICY "Company admins can manage purchase_invoices"
  ON procurement.purchase_invoices FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Accounts can manage purchase_invoices"
  ON procurement.purchase_invoices FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can view purchase_invoices"
  ON procurement.purchase_invoices FOR SELECT TO authenticated
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

CREATE POLICY "Sales can view purchase_invoices"
  ON procurement.purchase_invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales', public.current_company_id())
    AND company_id = public.current_company_id()
  );

-- ============================================
-- Supplier Payments Policies
-- ============================================

DROP POLICY IF EXISTS "Company admins can manage supplier_payments" ON procurement.supplier_payments;

CREATE POLICY "Company admins can manage supplier_payments"
  ON procurement.supplier_payments FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Accounts can manage supplier_payments"
  ON procurement.supplier_payments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts', public.current_company_id())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can view supplier_payments"
  ON procurement.supplier_payments FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "Sales can view supplier_payments" ON procurement.supplier_payments;
