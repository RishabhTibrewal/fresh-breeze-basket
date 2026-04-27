import apiClient from '@/lib/apiClient';

export type KotTicketSummary = {
  id: string;
  order_id: string;
  outlet_id: string;
  counter_id: string;
  kot_number_seq: number;
  kot_number_text: string;
  status: string;
  ticket_items_snapshot: unknown;
  printed_at: string | null;
  printed_count: number;
  created_at: string;
};

export type PosFoodCounter = {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number;
};

export type PosKotSettings = {
  id: string;
  company_id: string;
  outlet_id: string;
  reset_frequency: string;
  timezone: string;
  number_prefix: string;
  default_counter_id: string;
};

export const kotApi = {
  async getSettings(outletId: string): Promise<PosKotSettings | null> {
    const res = await apiClient.get('/pos/kot/settings', { params: { outlet_id: outletId } });
    return res.data?.data ?? null;
  },

  async saveSettings(body: {
    outlet_id: string;
    reset_frequency?: string;
    timezone?: string;
    number_prefix?: string;
    default_counter_id: string;
  }): Promise<PosKotSettings> {
    const res = await apiClient.put('/pos/kot/settings', body);
    return res.data.data;
  },

  async listCounters(outletId: string): Promise<PosFoodCounter[]> {
    const res = await apiClient.get('/pos/kot/counters', { params: { outlet_id: outletId } });
    return res.data.data ?? [];
  },

  async createCounter(body: {
    outlet_id: string;
    name: string;
    code: string;
    is_active?: boolean;
    sort_order?: number;
  }): Promise<PosFoodCounter> {
    const res = await apiClient.post('/pos/kot/counters', body);
    return res.data.data;
  },

  async patchCounter(
    id: string,
    patch: Partial<Pick<PosFoodCounter, 'name' | 'code' | 'is_active' | 'sort_order'>>
  ): Promise<PosFoodCounter> {
    const res = await apiClient.patch(`/pos/kot/counters/${id}`, patch);
    return res.data.data;
  },

  async listProductMappings(outletId: string): Promise<
    Array<{ product_id: string; counter_id: string; product?: { id: string; name: string } }>
  > {
    const res = await apiClient.get('/pos/kot/product-mappings', { params: { outlet_id: outletId } });
    return res.data.data ?? [];
  },

  async setProductMapping(productId: string, counterId: string): Promise<void> {
    await apiClient.post('/pos/kot/product-mappings', { product_id: productId, counter_id: counterId });
  },

  async clearProductMapping(productId: string): Promise<void> {
    await apiClient.delete(`/pos/kot/product-mappings/${productId}`);
  },

  async listTickets(params: {
    outlet_id: string;
    status?: string;
    counter_id?: string;
    from?: string;
    to?: string;
  }): Promise<KotTicketSummary[]> {
    const res = await apiClient.get('/pos/kot/tickets', { params });
    return res.data.data ?? [];
  },

  async patchTicketStatus(ticketId: string, status: string): Promise<KotTicketSummary> {
    const res = await apiClient.patch(`/pos/kot/tickets/${ticketId}/status`, { status });
    return res.data.data;
  },

  async reprintTicket(ticketId: string): Promise<KotTicketSummary> {
    const res = await apiClient.post(`/pos/kot/tickets/${ticketId}/reprint`);
    return res.data.data;
  },
};
