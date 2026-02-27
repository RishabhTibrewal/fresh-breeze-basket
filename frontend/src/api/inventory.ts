import apiClient from '@/lib/apiClient';

export interface AdjustStockInput {
  warehouse_id: string;
  product_id: string;
  variant_id: string;
  physical_quantity: number;
  reason: string;
}

export interface AdjustStockResponse {
  movement_id: string | null;
  difference: number;
  new_stock_count: number;
  message?: string;
}

export interface TransferStockItem {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export interface TransferStockInput {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  items: TransferStockItem[];
  notes?: string;
}

export interface TransferStockMovement {
  product_id: string;
  variant_id: string;
  quantity: number;
  transfer_out_id: string;
  transfer_in_id: string;
}

export interface TransferStockResponse {
  transfer_id: string;
  movements: TransferStockMovement[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  variant_id: string | null;
  outlet_id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  company_id: string;
  created_by: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string | null;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  user?: {
    id: string;
    email: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export interface ProductWarehouseStock {
  id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  stock_count: number;
  location?: string | null;
  warehouses?: {
    id: string;
    name: string;
    code: string;
    is_active?: boolean;
  };
}

export const inventoryService = {
  /**
   * Adjust stock to reconcile physical count with system count
   * Creates ADJUSTMENT_IN or ADJUSTMENT_OUT movement
   */
  async adjustStock(adjustData: AdjustStockInput): Promise<AdjustStockResponse> {
    const { data: response } = await apiClient.post<ApiResponse<AdjustStockResponse>>('/inventory/adjust', adjustData);
    return response.data;
  },

  /**
   * Transfer stock between warehouses
   * Creates TRANSFER_OUT and TRANSFER_IN movements atomically
   */
  async transferStock(transferData: TransferStockInput): Promise<TransferStockResponse> {
    const { data: response } = await apiClient.post<ApiResponse<TransferStockResponse>>('/inventory/transfer', transferData);
    return response.data;
  },

  /**
   * Get stock movements history
   */
  async getStockMovements(filters?: {
    warehouse_id?: string;
    product_id?: string;
    variant_id?: string;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<StockMovement[]> {
    const { data: response } = await apiClient.get<ApiResponse<StockMovement[]>>('/inventory/movements', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get inventory for a specific product across all warehouses
   * Backend: GET /api/inventory/:product_id
   */
  async getInventoryByProductId(productId: string): Promise<{
    warehouses: ProductWarehouseStock[];
    total_stock: number;
  }> {
    const { data: response } = await apiClient.get<ApiResponse<{
      warehouses: ProductWarehouseStock[];
      total_stock: number;
    }>>(`/inventory/${productId}`);
    return response.data;
  },
};
