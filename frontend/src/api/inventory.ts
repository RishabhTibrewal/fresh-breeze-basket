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

// ── POS Outlet Inventory Pool ────────────────────────────────────────────────

export interface PosPoolItem {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string;
  qty: number;
  created_at: string;
  updated_at: string;
  product_variants?: { id: string; name: string; sku: string | null };
  products?: { id: string; name: string };
}

export interface PosTransferItem {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export interface PosTransferInput {
  warehouse_id: string;
  items: PosTransferItem[];
  notes?: string;
}

export interface PosTransferResponse {
  transfer_id: string;
  movements: Array<{ productId: string; variantId: string; quantity: number }>;
  message: string;
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

export interface PackagingRecipe {
  id: string;
  company_id: string;
  input_product_id: string;
  input_variant_id: string;
  output_product_id: string;
  output_variant_id: string;
  conversion_ratio: number;
  wastage_per_input: number;
  additional_cost_per_unit: number;
  created_at: string;
  input_products?: { id: string; name: string };
  input_product_variants?: { id: string; name: string; unit: number | null; unit_type: string };
  output_products?: { id: string; name: string };
  output_product_variants?: { id: string; name: string; unit: number | null; unit_type: string };
}

export interface CreatePackagingRecipeInput {
  input_product_id: string;
  input_variant_id: string;
  output_product_id: string;
  output_variant_id: string;
  conversion_ratio: number;
}

export interface RepackOrderItem {
  id: string;
  repack_order_id: string;
  input_product_id: string;
  input_variant_id: string;
  input_quantity: number;
  output_product_id: string;
  output_variant_id: string;
  output_quantity: number;
  wastage_quantity: number;
  unit_cost: number;
  additional_cost_per_unit: number;
  input_products?: { id: string; name: string };
  input_product_variants?: { id: string; name: string; unit: number | null; unit_type: string };
  output_products?: { id: string; name: string };
  output_product_variants?: { id: string; name: string; unit: number | null; unit_type: string };
}

export interface RepackOrder {
  id: string;
  company_id: string;
  warehouse_id: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  warehouses?: { id: string; name: string; code: string };
}

export interface RepackOrderWithItems extends RepackOrder {
  items?: RepackOrderItem[];
}

export interface CreateRepackOrderInput {
  warehouse_id: string;
  notes?: string;
  items: Array<{
    input_product_id: string;
    input_variant_id: string;
    input_quantity: number;
    output_product_id: string;
    output_variant_id: string;
    output_quantity: number;
    wastage_quantity?: number;
    additional_cost_per_unit?: number;
  }>;
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
   * Get POS outlet inventory pool rows for a company/warehouse.
   * GET /inventory/pos-pool?warehouse_id=
   */
  async getPosPool(warehouseId?: string): Promise<PosPoolItem[]> {
    const { data: response } = await apiClient.get<ApiResponse<PosPoolItem[]>>('/inventory/pos-pool', {
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return response.data || [];
  },

  /**
   * Transfer stock from global warehouse_inventory to POS outlet pool.
   * POST /inventory/pos-transfer
   */
  async transferToPosPool(input: PosTransferInput): Promise<PosTransferResponse> {
    const { data: response } = await apiClient.post<ApiResponse<PosTransferResponse>>('/inventory/pos-transfer', input);
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
    reference_type?: string;
    reference_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: StockMovement[]; count: number }> {
    const { data: response } = await apiClient.get<ApiResponse<StockMovement[]>>('/inventory/movements', {
      params: filters,
    });
    return {
      data: response.data || [],
      count: response.count || 0
    };
  },

  /**
   * Packaging recipes CRUD
   */
  async getPackagingRecipes(): Promise<PackagingRecipe[]> {
    const { data: response } = await apiClient.get<ApiResponse<PackagingRecipe[]>>('/inventory/packaging-recipes');
    return response.data;
  },
  async createPackagingRecipe(recipe: CreatePackagingRecipeInput): Promise<PackagingRecipe> {
    const { data: response } = await apiClient.post<ApiResponse<PackagingRecipe>>('/inventory/packaging-recipes', recipe);
    return response.data;
  },
  async updatePackagingRecipe(id: string, recipe: Partial<CreatePackagingRecipeInput>): Promise<PackagingRecipe> {
    const { data: response } = await apiClient.put<ApiResponse<PackagingRecipe>>(`/inventory/packaging-recipes/${id}`, recipe);
    return response.data;
  },
  async deletePackagingRecipe(id: string): Promise<void> {
    await apiClient.delete(`/inventory/packaging-recipes/${id}`);
  },

  /**
   * Repack orders CRUD
   */
  async getRepackOrders(filters?: { warehouse_id?: string; status?: string }): Promise<RepackOrder[]> {
    const { data: response } = await apiClient.get<ApiResponse<RepackOrder[]>>('/inventory/repack-orders', { params: filters });
    return response.data;
  },
  async getRepackOrderById(id: string): Promise<RepackOrderWithItems> {
    const { data: response } = await apiClient.get<ApiResponse<RepackOrderWithItems>>(`/inventory/repack-orders/${id}`);
    return response.data;
  },
  async createRepackOrder(order: CreateRepackOrderInput): Promise<RepackOrderWithItems> {
    const { data: response } = await apiClient.post<ApiResponse<RepackOrderWithItems>>('/inventory/repack-orders', order);
    return response.data;
  },
  async updateRepackOrder(id: string, order: Partial<CreateRepackOrderInput>): Promise<RepackOrderWithItems> {
    const { data: response } = await apiClient.put<ApiResponse<RepackOrderWithItems>>(`/inventory/repack-orders/${id}`, order);
    return response.data;
  },
  async processRepackOrder(id: string): Promise<{
    success: boolean;
    data: {
      success: boolean;
      repack_order_id: string;
      status: string;
      items?: Array<{
        item_id: string;
        input_quantity: number;
        output_quantity: number;
        wastage_quantity: number;
        final_unit_cost: number;
      }>;
    };
  }> {
    const { data } = await apiClient.post<ApiResponse<{
      success: boolean;
      repack_order_id: string;
      status: string;
      items?: Array<{
        item_id: string;
        input_quantity: number;
        output_quantity: number;
        wastage_quantity: number;
        final_unit_cost: number;
      }>;
    }>>(`/inventory/repack-orders/${id}/process`);
    return data;
  },
  async deleteRepackOrder(id: string): Promise<void> {
    await apiClient.delete(`/inventory/repack-orders/${id}`);
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
