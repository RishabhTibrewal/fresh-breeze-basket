import { supabase } from '@/integrations/supabase/client';

export interface RecipeInput {
  product_id: string;
  variant_id: string;
  quantity_per_batch: number;
  wastage_per_unit: number;
  notes?: string;
}

export interface RecipeOutput {
  product_id: string;
  variant_id: string;
  quantity_per_batch: number;
  additional_cost_per_unit: number;
  notes?: string;
}

export interface CreateRecipeTemplatePayload {
  name: string;
  recipe_type: 'one_to_one' | 'many_to_one' | 'one_to_many' | 'many_to_many';
  notes?: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
}

export interface RepackOrderInput {
  product_id: string;
  variant_id: string;
  input_quantity: number;
  wastage_quantity: number;
}

export interface RepackOrderOutput {
  product_id: string;
  variant_id: string;
  output_quantity: number;
  unit_cost: number;
  additional_cost_per_unit: number;
}

export interface CreateRepackOrderPayload {
  warehouse_id: string;
  recipe_template_id?: string;
  notes?: string;
  inputs: RepackOrderInput[];
  outputs: RepackOrderOutput[];
}

// Helper: resolve company_id from JWT user_metadata first, then fall back to the profiles table.
async function getCompanyId(userId: string): Promise<string> {
  // 1. Try user_metadata (present when Supabase was seeded with it)
  const { data: { user } } = await supabase.auth.getUser();
  const metaCompanyId = user?.user_metadata?.company_id;
  if (metaCompanyId) return metaCompanyId;

  // 2. Fall back to the profiles table (always populated by backend)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.company_id)
    throw new Error('Could not determine company context');

  return profile.company_id;
}

export const repackService = {
  async createRecipeTemplate(payload: CreateRecipeTemplatePayload) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    
    const company_id = await getCompanyId(user.id);
    if (!company_id) throw new Error("Could not determine company context");
    
    // Attempt to get company_id from user metadata if possible, but the RLS policies
    // will enforce company_id defaults using current_company_id().
    // We just insert the header without explicit company_id, relying on DB defaults.
    const { data: header, error: headerErr } = await supabase
      .from('packaging_recipe_templates')
      .insert({
        company_id,
        name: payload.name,
        recipe_type: payload.recipe_type,
        notes: payload.notes
      })
      .select()
      .single();

    if (headerErr) throw headerErr;

    if (payload.inputs.length > 0) {
      const { error: inErr } = await supabase
        .from('packaging_recipe_inputs')
        .insert(payload.inputs.map(i => ({ ...i, recipe_id: header.id, company_id })));
      if (inErr) throw inErr;
    }

    if (payload.outputs.length > 0) {
      const { error: outErr } = await supabase
        .from('packaging_recipe_outputs')
        .insert(payload.outputs.map(o => ({ ...o, recipe_id: header.id, company_id })));
      if (outErr) throw outErr;
    }

    return this.getRecipeTemplateById(header.id);
  },

  async updateRecipeTemplate(id: string, payload: CreateRecipeTemplatePayload) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    
    // Update header
    const { error: headerErr } = await supabase
      .from('packaging_recipe_templates')
      .update({
        name: payload.name,
        recipe_type: payload.recipe_type,
        notes: payload.notes
      })
      .eq('id', id);

    if (headerErr) throw headerErr;

    // To cleanly update relations without complex diffing, delete inputs/outputs and re-insert
    await supabase.from('packaging_recipe_inputs').delete().eq('recipe_id', id);
    await supabase.from('packaging_recipe_outputs').delete().eq('recipe_id', id);

    const company_id = await getCompanyId(user.id);

    if (payload.inputs.length > 0) {
      const { error: inErr } = await supabase
        .from('packaging_recipe_inputs')
        .insert(payload.inputs.map(i => ({ ...i, recipe_id: id, company_id })));
      if (inErr) throw inErr;
    }

    if (payload.outputs.length > 0) {
      const { error: outErr } = await supabase
        .from('packaging_recipe_outputs')
        .insert(payload.outputs.map(o => ({ ...o, recipe_id: id, company_id })));
      if (outErr) throw outErr;
    }

    return this.getRecipeTemplateById(id);
  },

  async getRecipeTemplates(): Promise<any[]> {
    const { data, error } = await supabase
      .from('packaging_recipe_templates')
      .select(`
        *,
        inputs:packaging_recipe_inputs(*, product:products(name), variant:product_variants(name, sku)),
        outputs:packaging_recipe_outputs(*, product:products(name), variant:product_variants(name, sku))
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRecipeTemplateById(id: string) {
    const { data, error } = await supabase
      .from('packaging_recipe_templates')
      .select(`
        *,
        inputs:packaging_recipe_inputs(*, product:products(name), variant:product_variants(name, sku)),
        outputs:packaging_recipe_outputs(*, product:products(name), variant:product_variants(name, sku))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createRepackOrder(payload: CreateRepackOrderPayload) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    const company_id = await getCompanyId(user.id);
    if (!company_id) throw new Error("Could not determine company context");

    const { data: order, error: orderErr } = await supabase
      .from('repack_orders')
      .insert({
        company_id,
        warehouse_id: payload.warehouse_id,
        recipe_template_id: payload.recipe_template_id,
        notes: payload.notes,
        status: 'draft',
        created_by: user.id
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    if (payload.inputs.length > 0) {
      const { error: inErr } = await supabase
        .from('repack_order_inputs')
        .insert(payload.inputs.map(i => ({ ...i, repack_order_id: order.id, company_id })));
      if (inErr) throw inErr;
    }

    if (payload.outputs.length > 0) {
      const { error: outErr } = await supabase
        .from('repack_order_outputs')
        .insert(payload.outputs.map(o => ({ ...o, repack_order_id: order.id, company_id })));
      if (outErr) throw outErr;
    }

    return this.getRepackOrderById(order.id);
  },

  async updateRepackOrder(id: string, payload: CreateRepackOrderPayload) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");
    const user = userData.user;
    
    // Check if it's draft first
    const { data: existing } = await supabase
      .from('repack_orders')
      .select('status')
      .eq('id', id)
      .single();
      
    if (existing?.status !== 'draft') {
      throw new Error("Only draft orders can be edited.");
    }

    // Update header
    const { error: orderErr } = await supabase
      .from('repack_orders')
      .update({
        warehouse_id: payload.warehouse_id,
        recipe_template_id: payload.recipe_template_id,
        notes: payload.notes
      })
      .eq('id', id);

    if (orderErr) throw orderErr;

    // Delete existing items
    await supabase.from('repack_order_inputs').delete().eq('repack_order_id', id);
    await supabase.from('repack_order_outputs').delete().eq('repack_order_id', id);

    const company_id = await getCompanyId(user.id);

    if (payload.inputs.length > 0) {
      const { error: inErr } = await supabase
        .from('repack_order_inputs')
        .insert(payload.inputs.map(i => ({ ...i, repack_order_id: id, company_id })));
      if (inErr) throw inErr;
    }

    if (payload.outputs.length > 0) {
      const { error: outErr } = await supabase
        .from('repack_order_outputs')
        .insert(payload.outputs.map(o => ({ ...o, repack_order_id: id, company_id })));
      if (outErr) throw outErr;
    }

    return this.getRepackOrderById(id);
  },

  async confirmRepackOrder(orderId: string) {
    const { data: orderData, error: orderErr } = await supabase
      .from('repack_orders')
      .select('company_id, created_by')
      .eq('id', orderId)
      .single();

    if (orderErr || !orderData) throw new Error("Could not fetch order context");

    const { data, error } = await supabase.rpc('process_repack_order_v3', {
      p_repack_order_id: orderId,
      p_company_id: orderData.company_id,
      p_created_by: orderData.created_by
    });

    if (error) throw error;
    return data;
  },

  async getRepackOrders() {
    const { data, error } = await supabase
      .from('repack_orders')
      .select(`
        *,
        warehouse:warehouses(name),
        recipe:packaging_recipe_templates(name),
        inputs:repack_order_inputs(*, product:products(name), variant:product_variants(name, sku)),
        outputs:repack_order_outputs(*, product:products(name), variant:product_variants(name, sku))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRepackOrderById(id: string) {
    const { data, error } = await supabase
      .from('repack_orders')
      .select(`
        *,
        warehouse:warehouses(name),
        recipe:packaging_recipe_templates(name),
        inputs:repack_order_inputs(*, product:products(name), variant:product_variants(name, sku)),
        outputs:repack_order_outputs(*, product:products(name), variant:product_variants(name, sku))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
};
