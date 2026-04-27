import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError, ValidationError } from '../middleware/error';

const ACTIVE_TICKET_STATUSES = ['open', 'preparing', 'ready'] as const;

/**
 * GET /api/pos/kot/tickets
 * Query: outlet_id (required), status, from, to, counter_id
 */
export const listKotTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id, status, from, to, counter_id } = req.query as Record<string, string | undefined>;
    if (!outlet_id) throw new ValidationError('outlet_id is required');

    let q = supabaseAdmin
      .from('pos_kot_tickets')
      .select(
        'id, order_id, outlet_id, counter_id, kot_number_seq, kot_number_text, status, ticket_items_snapshot, printed_at, printed_count, created_at'
      )
      .eq('company_id', req.companyId)
      .eq('outlet_id', outlet_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (counter_id) q = q.eq('counter_id', counter_id);

    if (status === 'active' || status === 'open') {
      q = q.in('status', [...ACTIVE_TICKET_STATUSES]);
    } else if (status) {
      q = q.eq('status', status);
    }

    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);

    const { data, error } = await q;
    if (error) throw new ApiError(500, error.message);
    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pos/kot/tickets/:id
 */
export const getKotTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { ticketId: id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('pos_kot_tickets')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !data) throw new ApiError(404, 'KOT ticket not found');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/pos/kot/tickets/:id/status
 */
export const patchKotTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { ticketId: id } = req.params;
    const { status } = req.body as { status?: string };
    const allowed = ['open', 'preparing', 'ready', 'served', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      throw new ValidationError(`status must be one of: ${allowed.join(', ')}`);
    }

    const { data, error } = await supabaseAdmin
      .from('pos_kot_tickets')
      .update({ status })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error || !data) throw new ApiError(404, 'KOT ticket not found');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pos/kot/tickets/:id/reprint
 */
export const reprintKotTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { ticketId: id } = req.params;

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('pos_kot_tickets')
      .select('printed_count')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchErr || !row) throw new ApiError(404, 'KOT ticket not found');

    const nextCount = Number(row.printed_count ?? 0) + 1;
    const { data, error } = await supabaseAdmin
      .from('pos_kot_tickets')
      .update({
        printed_at: new Date().toISOString(),
        printed_count: nextCount,
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error || !data) throw new ApiError(500, 'Failed to record reprint');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pos/kot/settings?outlet_id=
 */
export const getKotSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id } = req.query as { outlet_id?: string };
    if (!outlet_id) throw new ValidationError('outlet_id is required');

    const { data, error } = await supabaseAdmin
      .from('pos_kot_settings')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('outlet_id', outlet_id)
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);
    res.json({ success: true, data: data ?? null });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/pos/kot/settings
 * Body: outlet_id, reset_frequency, timezone, number_prefix, default_counter_id
 */
export const upsertKotSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id, reset_frequency, timezone, number_prefix, default_counter_id } = req.body as Record<
      string,
      string | undefined
    >;
    if (!outlet_id) throw new ValidationError('outlet_id is required');
    if (!default_counter_id) throw new ValidationError('default_counter_id is required');

    const payload = {
      company_id: req.companyId,
      outlet_id,
      reset_frequency: reset_frequency || 'daily',
      timezone: timezone || 'Asia/Kolkata',
      number_prefix: (number_prefix || 'KOT').trim(),
      default_counter_id,
    };

    const { data: existing } = await supabaseAdmin
      .from('pos_kot_settings')
      .select('id')
      .eq('company_id', req.companyId)
      .eq('outlet_id', outlet_id)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('pos_kot_settings')
        .update({
          reset_frequency: payload.reset_frequency,
          timezone: payload.timezone,
          number_prefix: payload.number_prefix,
          default_counter_id: payload.default_counter_id,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new ApiError(500, error.message);
      res.json({ success: true, data });
    } else {
      const { data, error } = await supabaseAdmin.from('pos_kot_settings').insert(payload).select().single();
      if (error) throw new ApiError(500, error.message);
      res.status(201).json({ success: true, data });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pos/kot/counters?outlet_id=
 */
export const listFoodCounters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id } = req.query as { outlet_id?: string };
    if (!outlet_id) throw new ValidationError('outlet_id is required');

    const { data, error } = await supabaseAdmin
      .from('pos_food_counters')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('outlet_id', outlet_id)
      .order('sort_order', { ascending: true });

    if (error) throw new ApiError(500, error.message);
    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pos/kot/counters
 */
export const createFoodCounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id, name, code, is_active, sort_order } = req.body as Record<string, unknown>;
    if (!outlet_id || typeof outlet_id !== 'string') throw new ValidationError('outlet_id is required');
    if (!name || typeof name !== 'string') throw new ValidationError('name is required');
    if (!code || typeof code !== 'string') throw new ValidationError('code is required');

    const { data, error } = await supabaseAdmin
      .from('pos_food_counters')
      .insert({
        company_id: req.companyId,
        outlet_id,
        name: name.trim(),
        code: code.trim(),
        is_active: is_active !== false,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/pos/kot/counters/:id
 */
export const patchFoodCounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { id } = req.params;
    const patch: Record<string, unknown> = {};
    const { name, code, is_active, sort_order } = req.body as Record<string, unknown>;
    if (name !== undefined) patch.name = String(name).trim();
    if (code !== undefined) patch.code = String(code).trim();
    if (is_active !== undefined) patch.is_active = !!is_active;
    if (sort_order !== undefined) patch.sort_order = Number(sort_order);

    const { data, error } = await supabaseAdmin
      .from('pos_food_counters')
      .update(patch)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error || !data) throw new ApiError(404, 'Counter not found');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pos/kot/product-mappings?outlet_id=
 */
export const listProductMappingsForOutlet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { outlet_id } = req.query as { outlet_id?: string };
    if (!outlet_id) throw new ValidationError('outlet_id is required');

    const { data: counters } = await supabaseAdmin
      .from('pos_food_counters')
      .select('id')
      .eq('company_id', req.companyId)
      .eq('outlet_id', outlet_id);

    const counterIds = (counters ?? []).map((c: { id: string }) => c.id);
    if (counterIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { data: mappings, error } = await supabaseAdmin
      .from('product_food_counters')
      .select('product_id, counter_id, product:products(id, name)')
      .eq('company_id', req.companyId)
      .in('counter_id', counterIds);

    if (error) throw new ApiError(500, error.message);
    res.json({ success: true, data: mappings ?? [] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pos/kot/product-mappings
 * Body: product_id, counter_id
 */
export const upsertProductMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { product_id, counter_id } = req.body as { product_id?: string; counter_id?: string };
    if (!product_id || !counter_id) throw new ValidationError('product_id and counter_id are required');

    const { data: counter, error: cErr } = await supabaseAdmin
      .from('pos_food_counters')
      .select('id, outlet_id')
      .eq('id', counter_id)
      .eq('company_id', req.companyId)
      .single();

    if (cErr || !counter) throw new ValidationError('Invalid counter_id');

    const { data: existing } = await supabaseAdmin
      .from('product_food_counters')
      .select('id')
      .eq('company_id', req.companyId)
      .eq('product_id', product_id)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('product_food_counters')
        .update({ counter_id })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new ApiError(500, error.message);
      return res.json({ success: true, data });
    }

    const { data, error } = await supabaseAdmin
      .from('product_food_counters')
      .insert({
        company_id: req.companyId,
        product_id,
        counter_id,
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/pos/kot/product-mappings/:productId
 */
export const deleteProductMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.companyId) throw new ValidationError('Company context is required');
    const { productId } = req.params;

    const { error } = await supabaseAdmin
      .from('product_food_counters')
      .delete()
      .eq('company_id', req.companyId)
      .eq('product_id', productId);

    if (error) throw new ApiError(500, error.message);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
