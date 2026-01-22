-- Helper to get current user's company_id without RLS recursion
CREATE OR REPLACE FUNCTION public.profile_company_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID AS $$
  SELECT public.profile_company_id(auth.uid());
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.profile_company_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

-- Companies policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
DROP POLICY IF EXISTS "Companies are editable by admins only" ON public.companies;

CREATE POLICY "Companies are viewable by everyone"
  ON public.companies FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Companies are editable by admins only"
  ON public.companies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Set default company_id for tenant-scoped inserts
ALTER TABLE public.categories ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.products ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.product_images ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.warehouses ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.warehouse_inventory ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.inventory_old ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.addresses ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.orders ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.order_status_history ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.order_items ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.payments ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.carts ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.cart_items ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.customers ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.credit_periods ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.leads ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.sales_targets ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.suppliers ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.supplier_bank_accounts ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.purchase_orders ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.purchase_order_items ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.goods_receipts ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.goods_receipt_items ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.purchase_invoices ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE procurement.supplier_payments ALTER COLUMN company_id SET DEFAULT public.current_company_id();

-- Profiles policies (company scoped)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during registration" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id AND company_id = public.current_company_id());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND company_id = public.current_company_id())
  WITH CHECK (auth.uid() = id AND company_id = public.current_company_id());

CREATE POLICY "Allow profile creation during registration"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND company_id IS NOT NULL);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Categories policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Categories are editable by admins only" ON public.categories;

CREATE POLICY "Company users can view categories"
  ON public.categories FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Products policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Products are editable by admins and sales executives" ON public.products;
DROP POLICY IF EXISTS "Products are insertable by admins and sales executives" ON public.products;
DROP POLICY IF EXISTS "Products are deletable by admins only" ON public.products;

CREATE POLICY "Company users can view products"
  ON public.products FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins and sales can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Company admins and sales can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Company admins can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Product images policies
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON public.product_images;
DROP POLICY IF EXISTS "Product images are editable by admins only" ON public.product_images;

CREATE POLICY "Company users can view product images"
  ON public.product_images FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage product images"
  ON public.product_images FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Warehouses policies
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Warehouses are viewable by sales executives" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses are editable by admins only" ON public.warehouses;

CREATE POLICY "Company users can view warehouses"
  ON public.warehouses FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage warehouses"
  ON public.warehouses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Warehouse inventory policies
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Warehouse inventory is viewable by sales executives" ON public.warehouse_inventory;
DROP POLICY IF EXISTS "Warehouse inventory is editable by admins only" ON public.warehouse_inventory;

CREATE POLICY "Company users can view warehouse inventory"
  ON public.warehouse_inventory FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage warehouse inventory"
  ON public.warehouse_inventory FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Addresses policies
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin has full access to all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable delete for users to their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.addresses;
DROP POLICY IF EXISTS "Enable read access for users to their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable update for users to their own addresses" ON public.addresses;

CREATE POLICY "Company admins can manage all addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id AND company_id = public.current_company_id())
  WITH CHECK (auth.uid() = user_id AND company_id = public.current_company_id());

-- Orders policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

CREATE POLICY "Company users can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());

CREATE POLICY "Company admins and sales can manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

-- Order status history policies
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Users can view order status history for their orders" ON public.order_status_history;

CREATE POLICY "Company admins and sales can manage order status history"
  ON public.order_status_history FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Company users can view order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Order items policies
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;

CREATE POLICY "Company admins and sales can manage order items"
  ON public.order_items FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Company users can view their order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Payments policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;

CREATE POLICY "Company admins and sales can manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Company users can view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payments.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Carts policies
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.carts;

CREATE POLICY "Company users can view their own cart"
  ON public.carts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());

CREATE POLICY "Company users can manage their own cart"
  ON public.carts FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());

-- Cart items policies
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage their own cart items" ON public.cart_items;

CREATE POLICY "Company users can view their own cart items"
  ON public.cart_items FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Company users can manage their own cart items"
  ON public.cart_items FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = auth.uid()
    )
  );

-- Customers policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales executives can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Sales executives can insert their own customers" ON public.customers;
DROP POLICY IF EXISTS "Sales executives can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Admins have full access to customers table" ON public.customers;

CREATE POLICY "Company sales can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      sales_executive_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales'
      )
    )
  );

CREATE POLICY "Company sales can manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      sales_executive_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales'
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      sales_executive_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales'
      )
    )
  );

-- Credit periods policies
ALTER TABLE public.credit_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales executives can view their customers' transactions" ON public.credit_periods;
DROP POLICY IF EXISTS "Sales executives can insert their customers' transactions" ON public.credit_periods;
DROP POLICY IF EXISTS "Admins have full access to credit_transactions table" ON public.credit_periods;

CREATE POLICY "Company users can view credit periods"
  ON public.credit_periods FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = credit_periods.customer_id
    )
  );

CREATE POLICY "Company admins and sales can manage credit periods"
  ON public.credit_periods FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

-- Leads policies
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales executives can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Sales executives can create their own leads" ON public.leads;
DROP POLICY IF EXISTS "Sales executives can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Sales executives can delete their own leads" ON public.leads;

CREATE POLICY "Company sales can manage leads"
  ON public.leads FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      sales_executive_id = auth.uid()
      OR public.is_admin(auth.uid())
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      sales_executive_id = auth.uid()
      OR public.is_admin(auth.uid())
    )
  );

-- Sales targets policies
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales executives can view their own targets" ON public.sales_targets;
DROP POLICY IF EXISTS "Admins can manage all sales targets" ON public.sales_targets;

CREATE POLICY "Company sales can view their own targets"
  ON public.sales_targets FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND sales_executive_id = auth.uid());

CREATE POLICY "Company admins can manage sales targets"
  ON public.sales_targets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Suppliers policies
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin has full access to suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Sales can view suppliers" ON public.suppliers;

CREATE POLICY "Company users can view suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Supplier bank accounts policies
ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin has full access to supplier_bank_accounts" ON public.supplier_bank_accounts;
DROP POLICY IF EXISTS "Sales can view supplier_bank_accounts" ON public.supplier_bank_accounts;

CREATE POLICY "Company users can view supplier bank accounts"
  ON public.supplier_bank_accounts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage supplier bank accounts"
  ON public.supplier_bank_accounts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Procurement policies
ALTER TABLE procurement.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin has full access to purchase_orders" ON procurement.purchase_orders;
DROP POLICY IF EXISTS "Admin has full access to purchase_order_items" ON procurement.purchase_order_items;
DROP POLICY IF EXISTS "Admin has full access to goods_receipts" ON procurement.goods_receipts;
DROP POLICY IF EXISTS "Admin has full access to goods_receipt_items" ON procurement.goods_receipt_items;
DROP POLICY IF EXISTS "Admin has full access to purchase_invoices" ON procurement.purchase_invoices;
DROP POLICY IF EXISTS "Admin has full access to supplier_payments" ON procurement.supplier_payments;

CREATE POLICY "Company admins can manage purchase_orders"
  ON procurement.purchase_orders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Company admins can manage purchase_order_items"
  ON procurement.purchase_order_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Company admins can manage goods_receipts"
  ON procurement.goods_receipts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Company admins can manage goods_receipt_items"
  ON procurement.goods_receipt_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Company admins can manage purchase_invoices"
  ON procurement.purchase_invoices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

CREATE POLICY "Company admins can manage supplier_payments"
  ON procurement.supplier_payments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());
