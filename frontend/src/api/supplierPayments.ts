import apiClient from '@/lib/apiClient';

export interface SupplierPayment {
  id: string;
  purchase_invoice_id: string;
  supplier_id: string;
  payment_number: string;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  amount: number;
  reference_number?: string;
  bank_name?: string;
  cheque_number?: string;
  transaction_id?: string;
  notes?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_by?: string;
  created_at: string;
  updated_at: string;
  purchase_invoices?: any;
  suppliers?: any;
}

export interface CreateSupplierPaymentData {
  purchase_invoice_id: string;
  supplier_id: string;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  amount: number;
  reference_number?: string;
  bank_name?: string;
  cheque_number?: string;
  transaction_id?: string;
  notes?: string;
}

export interface SupplierPaymentsResponse {
  success: boolean;
  data: SupplierPayment[];
}

export const supplierPaymentsService = {
  async getAll(filters?: {
    supplier_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    payment_method?: string;
    purchase_invoice_id?: string;
  }): Promise<SupplierPayment[]> {
    const { data } = await apiClient.get<SupplierPaymentsResponse>('/supplier-payments', {
      params: filters,
    });
    return data.data || [];
  },

  async getById(id: string): Promise<SupplierPayment> {
    const { data } = await apiClient.get<{ success: boolean; data: SupplierPayment }>(`/supplier-payments/${id}`);
    return data.data;
  },

  async create(paymentData: CreateSupplierPaymentData): Promise<SupplierPayment> {
    const { data } = await apiClient.post<{ success: boolean; data: SupplierPayment }>('/supplier-payments', paymentData);
    return data.data;
  },

  async update(id: string, paymentData: Partial<CreateSupplierPaymentData & { status?: string }>): Promise<SupplierPayment> {
    const { data } = await apiClient.put<{ success: boolean; data: SupplierPayment }>(`/supplier-payments/${id}`, paymentData);
    return data.data;
  },
};
