import apiClient from '@/lib/apiClient';

export interface PurchaseInvoice {
  id: string;
  purchase_order_id: string;
  goods_receipt_id: string;
  invoice_number: string;
  supplier_invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  invoice_file_url?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  purchase_orders?: any;
  goods_receipts?: any;
  supplier_payments?: any[];
}

export interface CreatePurchaseInvoiceData {
  goods_receipt_id: string;
  purchase_order_id?: string;
  supplier_invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  invoice_file_url?: string;
  notes?: string;
}

export interface PurchaseInvoicesResponse {
  success: boolean;
  data: PurchaseInvoice[];
}

export const purchaseInvoicesService = {
  async getAll(filters?: {
    status?: string;
    supplier_id?: string;
    purchase_order_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PurchaseInvoice[]> {
    const { data } = await apiClient.get<PurchaseInvoicesResponse>('/purchase-invoices', {
      params: filters,
    });
    return data.data || [];
  },

  async getById(id: string): Promise<PurchaseInvoice> {
    const { data } = await apiClient.get<{ success: boolean; data: PurchaseInvoice }>(`/purchase-invoices/${id}`);
    return data.data;
  },

  async create(invoiceData: CreatePurchaseInvoiceData): Promise<PurchaseInvoice> {
    const { data } = await apiClient.post<{ success: boolean; data: PurchaseInvoice }>('/purchase-invoices', invoiceData);
    return data.data;
  },

  async update(id: string, invoiceData: Partial<CreatePurchaseInvoiceData>): Promise<PurchaseInvoice> {
    const { data } = await apiClient.put<{ success: boolean; data: PurchaseInvoice }>(`/purchase-invoices/${id}`, invoiceData);
    return data.data;
  },

  async uploadInvoiceFile(id: string, file: File): Promise<PurchaseInvoice> {
    const formData = new FormData();
    formData.append('invoiceFile', file);
    formData.append('purchaseInvoiceId', id);

    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string }>(
      `/uploads/purchase-invoice`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    // Update invoice with file URL
    return this.update(id, { invoice_file_url: data.url });
  },
};
