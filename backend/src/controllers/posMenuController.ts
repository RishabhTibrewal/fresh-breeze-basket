import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError, ValidationError } from '../middleware/error';

// ─── List all menus for the company ──────────────────────────────────────────
// GET /api/pos/menus
export const listMenus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');

    const { data, error } = await supabaseAdmin
      .from('pos_menus')
      .select(`
        id, name, description, created_at, updated_at,
        outlets:pos_menu_outlets(id, warehouse_id, warehouses(id, name, code))
      `)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(500, 'Failed to fetch menus');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Create a new menu ────────────────────────────────────────────────────────
// POST /api/pos/menus
export const createMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { name, description } = req.body;
    if (!name?.trim()) throw new ValidationError('Menu name is required');

    const { data, error } = await supabaseAdmin
      .from('pos_menus')
      .insert({ company_id: req.companyId, name: name.trim(), description: description?.trim() || null })
      .select()
      .single();

    if (error) throw new ApiError(500, 'Failed to create menu');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Get active menu for a warehouse (used by POS sale view) ─────────────────
// GET /api/pos/menus/active?warehouse_id=xxx
export const getActiveMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { warehouse_id } = req.query as { warehouse_id?: string };
    if (!warehouse_id) throw new ValidationError('warehouse_id is required');

    // Find which menu is assigned to this outlet
    const { data: outlet, error: outletErr } = await supabaseAdmin
      .from('pos_menu_outlets')
      .select('menu_id')
      .eq('company_id', req.companyId)
      .eq('warehouse_id', warehouse_id)
      .maybeSingle();

    if (outletErr) throw new ApiError(500, 'Failed to fetch outlet menu assignment');
    if (!outlet) return res.json({ success: true, data: null }); // no menu assigned

    // Fetch menu + items
    const { data: menu, error: menuErr } = await supabaseAdmin
      .from('pos_menus')
      .select(`
        id, name, description,
        items:pos_menu_items(
          id, product_id, variant_id, is_visible, pos_price, sort_order
        )
      `)
      .eq('id', outlet.menu_id)
      .eq('company_id', req.companyId)
      .single();

    if (menuErr) throw new ApiError(500, 'Failed to fetch active menu');
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
};

// ─── Get a single menu with all items ────────────────────────────────────────
// GET /api/pos/menus/:id
export const getMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('pos_menus')
      .select(`
        id, name, description, created_at, updated_at,
        outlets:pos_menu_outlets(id, warehouse_id, warehouses(id, name, code)),
        items:pos_menu_items(
          id, product_id, variant_id, is_visible, pos_price, sort_order
        )
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) throw new ApiError(404, 'Menu not found');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Update menu name / description ──────────────────────────────────────────
// PUT /api/pos/menus/:id
export const updateMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name?.trim()) throw new ValidationError('Menu name is required');

    const { data, error } = await supabaseAdmin
      .from('pos_menus')
      .update({ name: name.trim(), description: description?.trim() || null })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) throw new ApiError(500, 'Failed to update menu');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Delete a menu ────────────────────────────────────────────────────────────
// DELETE /api/pos/menus/:id
export const deleteMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('pos_menus')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) throw new ApiError(500, 'Failed to delete menu');
    res.json({ success: true, message: 'Menu deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Bulk upsert menu items ───────────────────────────────────────────────────
// PUT /api/pos/menus/:id/items
// Body: { items: [{ variant_id, product_id, is_visible, pos_price, sort_order }] }
export const upsertMenuItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id: menu_id } = req.params;
    const { items } = req.body as {
      items: Array<{
        variant_id: string;
        product_id: string;
        is_visible?: boolean;
        pos_price?: number | null;
        sort_order?: number;
      }>;
    };

    if (!Array.isArray(items)) throw new ValidationError('items must be an array');

    // Verify the menu belongs to this company
    const { data: menu, error: menuErr } = await supabaseAdmin
      .from('pos_menus')
      .select('id')
      .eq('id', menu_id)
      .eq('company_id', req.companyId)
      .maybeSingle();

    if (menuErr || !menu) throw new ApiError(404, 'Menu not found');

    if (items.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const records = items.map((item, idx) => ({
      company_id: req.companyId as string,
      menu_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      is_visible: item.is_visible !== false,
      pos_price: item.pos_price ?? null,
      sort_order: item.sort_order ?? idx,
    }));

    const { data, error } = await supabaseAdmin
      .from('pos_menu_items')
      .upsert(records, { onConflict: 'menu_id,variant_id' })
      .select();

    if (error) throw new ApiError(500, `Failed to upsert menu items: ${error.message}`);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Assign an outlet to a menu ───────────────────────────────────────────────
// POST /api/pos/menus/:id/outlets/:warehouseId
export const assignOutlet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id: menu_id, warehouseId: warehouse_id } = req.params;

    // Verify menu belongs to company
    const { data: menu, error: menuErr } = await supabaseAdmin
      .from('pos_menus')
      .select('id')
      .eq('id', menu_id)
      .eq('company_id', req.companyId)
      .maybeSingle();

    if (menuErr || !menu) throw new ApiError(404, 'Menu not found');

    // Upsert: replace any existing assignment for this outlet
    const { data, error } = await supabaseAdmin
      .from('pos_menu_outlets')
      .upsert(
        { company_id: req.companyId, menu_id, warehouse_id },
        { onConflict: 'company_id,warehouse_id' }
      )
      .select()
      .single();

    if (error) throw new ApiError(500, 'Failed to assign outlet');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── Remove outlet assignment ─────────────────────────────────────────────────
// DELETE /api/pos/menus/:id/outlets/:warehouseId
export const unassignOutlet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id: menu_id, warehouseId: warehouse_id } = req.params;

    const { error } = await supabaseAdmin
      .from('pos_menu_outlets')
      .delete()
      .eq('company_id', req.companyId)
      .eq('menu_id', menu_id)
      .eq('warehouse_id', warehouse_id);

    if (error) throw new ApiError(500, 'Failed to remove outlet assignment');
    res.json({ success: true, message: 'Outlet unassigned' });
  } catch (err) {
    next(err);
  }
};
