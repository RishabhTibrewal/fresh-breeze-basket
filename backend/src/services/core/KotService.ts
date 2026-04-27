import { supabaseAdmin } from '../../lib/supabase';
import { ApiError } from '../../middleware/error';

export type KotSnapshotModifier = {
  modifier_id: string;
  name: string;
  price_adjust: number;
};

export type KotSnapshotLine = {
  order_item_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  kitchen_display_name: string;
  modifiers_snapshot: KotSnapshotModifier[];
  used_default_counter: boolean;
};

export type KotTicketRow = {
  id: string;
  order_id: string;
  outlet_id: string;
  counter_id: string;
  kot_number_seq: number;
  kot_number_text: string;
  status: string;
  ticket_items_snapshot: KotSnapshotLine[];
};

type PosRequestItem = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  selected_modifiers?: Array<{ modifier_id: string; price_adjust?: number }>;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
};

/**
 * KOT ticket generation: counter resolution (product map + default), JSONB snapshot,
 * outlet-wide sequence via next_kot_number RPC.
 */
export class KotService {
  constructor(private readonly companyId: string) {}

  /** Returns true when this outlet has a KOT settings row (default counter configured). */
  static async hasKotSettingsForOutlet(companyId: string, outletId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('pos_kot_settings')
      .select('id')
      .eq('company_id', companyId)
      .eq('outlet_id', outletId)
      .maybeSingle();
    if (error) return false;
    return !!data?.id;
  }

  async generateTickets(params: {
    orderId: string;
    outletId: string;
    requestItems: PosRequestItem[];
    orderItemRows: OrderItemRow[];
    // Optional: caller can pass the already-fetched settings row to skip a DB round-trip
    prefetchedSettings?: {
      reset_frequency: string;
      timezone: string;
      number_prefix: string;
      default_counter_id: string;
    } | null;
  }): Promise<KotTicketRow[]> {
    const { orderId, outletId, requestItems, orderItemRows, prefetchedSettings } = params;

    if (requestItems.length !== orderItemRows.length) {
      throw new ApiError(
        500,
        'KOT: order line count mismatch; cannot attach ticket snapshots'
      );
    }

    // ── PERF: Use pre-fetched settings if provided; skip DB call ────────────
    let settings: { reset_frequency: string; timezone: string; number_prefix: string; default_counter_id: string };
    if (prefetchedSettings) {
      settings = prefetchedSettings;
    } else {
      const { data, error: settingsErr } = await supabaseAdmin
        .from('pos_kot_settings')
        .select('reset_frequency, timezone, number_prefix, default_counter_id')
        .eq('company_id', this.companyId)
        .eq('outlet_id', outletId)
        .single();
      if (settingsErr || !data) {
        throw new ApiError(
          400,
          'Configure KOT settings and default counter for this outlet (POS → KOT settings).'
        );
      }
      settings = data;
    }

    const defaultCounterId = settings.default_counter_id as string;
    const productIds = [...new Set(requestItems.map((i) => i.product_id))];
    const variantIds = orderItemRows
      .map((r) => r.variant_id)
      .filter((v): v is string => !!v);
    const modifierIds = new Set<string>();
    for (const it of requestItems) {
      for (const m of it.selected_modifiers ?? []) {
        modifierIds.add(m.modifier_id);
      }
    }

    // ── PERF: Run all 4 lookup queries in parallel ────────────────────────
    const [mappingsResult, countersResult, productsResult, variantsResult, modifiersResult] =
      await Promise.all([
        supabaseAdmin
          .from('product_food_counters')
          .select('product_id, counter_id')
          .eq('company_id', this.companyId)
          .in('product_id', productIds),
        supabaseAdmin
          .from('pos_food_counters')
          .select('id, outlet_id')
          .eq('company_id', this.companyId)
          .eq('outlet_id', outletId),
        supabaseAdmin
          .from('products')
          .select('id, name')
          .eq('company_id', this.companyId)
          .in('id', productIds),
        variantIds.length > 0
          ? supabaseAdmin
              .from('product_variants')
              .select('id, product_id, name')
              .in('id', variantIds)
          : Promise.resolve({ data: [] as { id: string; product_id: string; name: string | null }[] }),
        modifierIds.size > 0
          ? supabaseAdmin
              .from('modifiers')
              .select('id, name')
              .eq('company_id', this.companyId)
              .in('id', [...modifierIds])
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

    const counterOutletOk = new Set(
      (countersResult.data ?? []).map((c: { id: string }) => c.id)
    );
    const mappingByProduct = new Map<string, string>();
    for (const m of mappingsResult.data ?? []) {
      const row = m as { product_id: string; counter_id: string };
      mappingByProduct.set(row.product_id, row.counter_id);
    }
    const productNameById = new Map(
      (productsResult.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
    );
    const variantById = new Map(
      (variantsResult.data ?? []).map((v: { id: string; product_id: string; name: string | null }) => [v.id, v])
    );
    const modifierNameById = new Map(
      (modifiersResult.data ?? []).map((m: { id: string; name: string }) => [m.id, m.name])
    );

    type ResolvedLine = KotSnapshotLine & { counter_id: string };
    const resolved: ResolvedLine[] = [];

    for (let i = 0; i < requestItems.length; i++) {
      const req = requestItems[i];
      const oi = orderItemRows[i];
      const mappedCounter = mappingByProduct.get(req.product_id);
      let counterId = defaultCounterId;
      let usedDefault = true;
      if (mappedCounter && counterOutletOk.has(mappedCounter)) {
        counterId = mappedCounter;
        usedDefault = false;
      }

      const vid = oi.variant_id || req.variant_id || '';
      const vrow = vid ? variantById.get(vid) : undefined;
      const pname = (productNameById.get(req.product_id) || 'Item').trim();
      const vname = (vrow?.name ?? '').trim();
      const kitchenName =
        vname.length > 0
          ? (pname.toLowerCase() === vname.toLowerCase() ? pname : `${pname} (${vname})`)
          : pname;

      const mods: KotSnapshotModifier[] = (req.selected_modifiers ?? []).map((m) => ({
        modifier_id: m.modifier_id,
        name: modifierNameById.get(m.modifier_id) || 'Modifier',
        price_adjust: Number(m.price_adjust ?? 0),
      }));

      resolved.push({
        order_item_id: oi.id,
        product_id: req.product_id,
        variant_id: vid,
        quantity: oi.quantity,
        kitchen_display_name: kitchenName,
        modifiers_snapshot: mods,
        used_default_counter: usedDefault,
        counter_id: counterId,
      });
    }

    const byCounter = new Map<string, ResolvedLine[]>();
    for (const line of resolved) {
      const list = byCounter.get(line.counter_id) ?? [];
      list.push(line);
      byCounter.set(line.counter_id, list);
    }

    const inserted: KotTicketRow[] = [];

    for (const [counterId, lines] of byCounter) {
      const { data: seqRows, error: seqErr } = await supabaseAdmin.rpc('next_kot_number', {
        p_company_id: this.companyId,
        p_outlet_id: outletId,
        p_reset_frequency: settings.reset_frequency,
        p_timezone: settings.timezone,
        p_prefix: settings.number_prefix || 'KOT',
      });

      if (seqErr || !seqRows?.length) {
        throw new ApiError(500, seqErr?.message || 'Failed to allocate KOT number');
      }

      const seqRow = seqRows[0] as { kot_number_seq: number; kot_number_text: string };
      const snapshot: KotSnapshotLine[] = lines.map(({ counter_id: _omit, ...snap }) => snap);

      const { data: ticket, error: insErr } = await supabaseAdmin
        .from('pos_kot_tickets')
        .insert({
          company_id: this.companyId,
          order_id: orderId,
          outlet_id: outletId,
          counter_id: counterId,
          kot_number_seq: seqRow.kot_number_seq,
          kot_number_text: seqRow.kot_number_text,
          status: 'open',
          ticket_items_snapshot: snapshot,
        })
        .select(
          'id, order_id, outlet_id, counter_id, kot_number_seq, kot_number_text, status, ticket_items_snapshot'
        )
        .single();

      if (insErr || !ticket) {
        throw new ApiError(500, insErr?.message || 'Failed to insert KOT ticket');
      }

      inserted.push({
        id: ticket.id,
        order_id: ticket.order_id,
        outlet_id: ticket.outlet_id,
        counter_id: ticket.counter_id,
        kot_number_seq: Number(ticket.kot_number_seq),
        kot_number_text: ticket.kot_number_text,
        status: ticket.status,
        ticket_items_snapshot: ticket.ticket_items_snapshot as unknown as KotSnapshotLine[],
      });
    }

    return inserted;
  }
}
