import apiClient from '@/lib/apiClient';

export interface CreditNote {
  id: string;
  company_id: string;
  order_id: string;
  customer_id: string | null;
  cn_number: string;
  cn_date: string;
  reason: string;
  cd_percentage: number;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'issued' | 'applied' | 'cancelled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  order?: { id: string; order_number: string; total_amount: number };
  customer?: { id: string; name: string; phone: string };
}

export const creditNotesService = {
  async list(): Promise<CreditNote[]> {
    const { data } = await apiClient.get<{ success: boolean; data: CreditNote[] }>('/credit-notes');
    return data.data;
  },

  async create(order_id: string): Promise<CreditNote> {
    const { data } = await apiClient.post<{ success: boolean; data: CreditNote }>('/credit-notes', { order_id });
    return data.data;
  },

  async updateStatus(id: string, status: CreditNote['status']): Promise<CreditNote> {
    const { data } = await apiClient.patch<{ success: boolean; data: CreditNote }>(`/credit-notes/${id}/status`, { status });
    return data.data;
  },

  async getForOrder(order_id: string): Promise<CreditNote | null> {
    const { data } = await apiClient.get<{ success: boolean; data: CreditNote | null }>(`/credit-notes/order/${order_id}`);
    return data.data;
  },
  
  async createManual(payload: {
    customer_id: string;
    reason: string;
    amount: number;
    tax_amount: number;
    total_amount: number;
    notes?: string;
    order_id?: string;
  }): Promise<CreditNote> {
    const { data } = await apiClient.post<{ success: boolean; data: CreditNote }>('/credit-notes/manual', payload);
    return data.data;
  },
};
