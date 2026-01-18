import apiClient from '@/lib/apiClient';

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  po_number: string;
  order_date: string;
  expected_delivery_date?: string;
  total_amount: number;
  notes?: string;
  terms_conditions?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  suppliers?: any;
  warehouses?: any;
  purchase_order_items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  received_quantity: number;
  created_at: string;
  products?: any;
}

export interface CreatePurchaseOrderData {
  supplier_id: string;
  warehouse_id: string;
  expected_delivery_date?: string;
  notes?: string;
  terms_conditions?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface PurchaseOrdersResponse {
  success: boolean;
  data: PurchaseOrder[];
}

export const purchaseOrdersService = {
  async getAll(filters?: {
    status?: string;
    warehouse_id?: string;
    supplier_id?: string;
    search?: string;
  }): Promise<PurchaseOrder[]> {
    const { data } = await apiClient.get<PurchaseOrdersResponse>('/purchase-orders', {
      params: filters,
    });
    return data.data || [];
  },

  async getById(id: string): Promise<PurchaseOrder> {
    const { data } = await apiClient.get<{ success: boolean; data: PurchaseOrder }>(`/purchase-orders/${id}`);
    return data.data;
  },

  async create(orderData: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    const { data } = await apiClient.post<{ success: boolean; data: PurchaseOrder }>('/purchase-orders', orderData);
    return data.data;
  },

  async update(id: string, orderData: Partial<CreatePurchaseOrderData>): Promise<PurchaseOrder> {
    const { data } = await apiClient.put<{ success: boolean; data: PurchaseOrder }>(`/purchase-orders/${id}`, orderData);
    return data.data;
  },

  async approve(id: string): Promise<PurchaseOrder> {
    const { data } = await apiClient.post<{ success: boolean; message: string; data: PurchaseOrder }>(
      `/purchase-orders/${id}/approve`
    );
    return data.data;
  },

  async cancel(id: string): Promise<PurchaseOrder> {
    const { data } = await apiClient.delete<{ success: boolean; message: string; data: PurchaseOrder }>(
      `/purchase-orders/${id}`
    );
    return data.data;
  },
};
