import apiClient from '@/lib/apiClient';

export interface GoodsReceipt {
  id: string;
  purchase_order_id: string;
  grn_number: string;
  receipt_date: string;
  warehouse_id: string;
  received_by?: string;
  inspected_by?: string;
  inspection_notes?: string;
  status: 'pending' | 'inspected' | 'approved' | 'rejected' | 'completed';
  total_received_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  purchase_orders?: any;
  warehouses?: any;
  goods_receipt_items?: GoodsReceiptItem[];
}

export interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  purchase_order_item_id: string;
  product_id: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  unit_price: number;
  batch_number?: string;
  expiry_date?: string;
  condition_notes?: string;
  unit?: string;
  product_code?: string;
  hsn_code?: string;
  tax_percentage?: number;
  created_at: string;
  products?: any;
  purchase_order_items?: any;
}

export interface CreateGoodsReceiptData {
  purchase_order_id: string;
  receipt_date?: string;
  warehouse_id: string;
  inspection_notes?: string;
  notes?: string;
  items: Array<{
    purchase_order_item_id: string;
    product_id: string;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected?: number;
    unit_price: number;
    batch_number?: string;
    expiry_date?: string;
    condition_notes?: string;
  }>;
}

export interface GoodsReceiptsResponse {
  success: boolean;
  data: GoodsReceipt[];
}

export const goodsReceiptsService = {
  async getAll(filters?: {
    status?: string;
    warehouse_id?: string;
    purchase_order_id?: string;
    search?: string;
  }): Promise<GoodsReceipt[]> {
    const { data } = await apiClient.get<GoodsReceiptsResponse>('/goods-receipts', {
      params: filters,
    });
    return data.data || [];
  },

  async getById(id: string): Promise<GoodsReceipt> {
    const { data } = await apiClient.get<{ success: boolean; data: GoodsReceipt }>(`/goods-receipts/${id}`);
    return data.data;
  },

  async create(receiptData: CreateGoodsReceiptData): Promise<GoodsReceipt> {
    const { data } = await apiClient.post<{ success: boolean; data: GoodsReceipt }>('/goods-receipts', receiptData);
    return data.data;
  },

  async update(id: string, receiptData: Partial<CreateGoodsReceiptData>): Promise<GoodsReceipt> {
    const { data } = await apiClient.put<{ success: boolean; data: GoodsReceipt }>(`/goods-receipts/${id}`, receiptData);
    return data.data;
  },

  async receiveGoods(id: string, items: Array<{ product_id: string; quantity_accepted: number; warehouse_id: string }>): Promise<GoodsReceipt> {
    const { data } = await apiClient.post<{ success: boolean; message: string; data: GoodsReceipt }>(
      `/goods-receipts/${id}/receive`,
      { items }
    );
    return data.data;
  },

  async complete(id: string): Promise<GoodsReceipt> {
    const { data } = await apiClient.post<{ success: boolean; message: string; data: GoodsReceipt }>(
      `/goods-receipts/${id}/complete`
    );
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(`/goods-receipts/${id}`);
  },
};
