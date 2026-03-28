import apiClient from '@/lib/apiClient';

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuotationItem {
  id?: string;
  quotation_id?: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  tax_percentage?: number;
  discount_percentage?: number;
  tax_amount?: number;
  discount_amount?: number;
  line_total?: number;
  notes?: string;
  product?: { name: string; sku: string };
  variant?: { name: string; sku: string };
}

export interface Quotation {
  id: string;
  quotation_number: string;
  company_id: string;
  lead_id?: string | null;
  customer_id?: string | null;
  sales_executive_id?: string;
  status: QuotationStatus;
  subtotal?: number;
  total_tax?: number;
  total_discount?: number;
  extra_discount_percentage?: number;
  extra_discount_amount?: number;
  extra_charges?: { name: string; amount: number; tax_percent?: number; total_amount?: number }[];
  total_extra_charges?: number;
  round_off_amount?: number;
  taxable_value?: number;
  total_amount: number;
  notes?: string;
  terms_and_conditions?: string;
  valid_until?: string;
  converted_to_order_id?: string;
  created_at: string;
  updated_at: string;
  leads?: { contact_name: string; company_name: string };
  customers?: {
    name: string;
  };
  auth_users?: { email: string; raw_user_meta_data: any };
  quotation_items?: QuotationItem[];
}

export interface CreateQuotationInput {
  lead_id?: string;
  customer_id?: string;
  sales_executive_id?: string;
  valid_until?: string;
  notes?: string;
  terms_and_conditions?: string;
  extra_discount_amount?: number;
  extra_discount_percentage?: number;
  extra_charges?: { name: string; amount: number; tax_percent?: number }[];
  items: QuotationItem[];
}

export interface GetQuotationsParams {
  status?: QuotationStatus;
  search?: string;
}

export const quotationsService = {
  // Get all quotations
  async getQuotations(params?: GetQuotationsParams): Promise<Quotation[]> {
    const response = await apiClient.get('/quotations', { params });
    return response.data.data;
  },

  // Get a single quotation
  async getQuotationById(id: string): Promise<Quotation> {
    const response = await apiClient.get(`/quotations/${id}`);
    return response.data.data;
  },

  // Create a new quotation
  async createQuotation(data: CreateQuotationInput): Promise<Quotation> {
    const response = await apiClient.post('/quotations', data);
    return response.data.data;
  },

  // Accept a quotation (converts to order)
  async acceptQuotation(id: string): Promise<{ order_id: string }> {
    const response = await apiClient.post(`/quotations/${id}/accept`);
    return response.data.data;
  },

  // Update status (e.g. sent, rejected)
  async updateQuotationStatus(id: string, status: QuotationStatus): Promise<Quotation> {
    const response = await apiClient.patch(`/quotations/${id}/status`, { status });
    return response.data.data;
  }
};
