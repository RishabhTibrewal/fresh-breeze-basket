import apiClient from '@/lib/apiClient';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseInventory {
  id: string;
  warehouse_id: string;
  product_id: string;
  stock_count: number;
  reserved_stock: number;
  location?: string;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    unit_type?: string;
  };
  warehouses?: {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
  };
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active?: boolean;
}

export interface UpdateWarehouseInput extends Partial<CreateWarehouseInput> {}

export interface ProductStockAcrossWarehouses {
  warehouses: Array<WarehouseInventory & { warehouses: Warehouse }>;
  total_stock: number;
}

export const warehousesService = {
  // Get all warehouses
  async getAll(is_active?: boolean): Promise<Warehouse[]> {
    const params = is_active !== undefined ? { is_active: is_active.toString() } : {};
    const { data } = await apiClient.get('/warehouses', { params });
    return data.data || data;
  },

  // Get warehouse by ID
  async getById(id: string): Promise<Warehouse> {
    const { data } = await apiClient.get(`/warehouses/${id}`);
    return data.data || data;
  },

  // Create warehouse (admin only)
  async create(warehouseData: CreateWarehouseInput): Promise<Warehouse> {
    const { data } = await apiClient.post('/warehouses', warehouseData);
    return data.data || data;
  },

  // Update warehouse (admin only)
  async update(id: string, warehouseData: UpdateWarehouseInput): Promise<Warehouse> {
    const { data } = await apiClient.put(`/warehouses/${id}`, warehouseData);
    return data.data || data;
  },

  // Delete warehouse (admin only)
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/warehouses/${id}`);
  },

  // Get warehouse inventory
  async getWarehouseInventory(
    warehouseId: string,
    options?: { product_id?: string; low_stock?: boolean }
  ): Promise<WarehouseInventory[]> {
    const params: any = {};
    if (options?.product_id) params.product_id = options.product_id;
    if (options?.low_stock) params.low_stock = 'true';
    
    const { data } = await apiClient.get(`/warehouses/${warehouseId}/inventory`, { params });
    return data.data || data;
  },

  // Get product stock across all warehouses
  async getProductStockAcrossWarehouses(productId: string): Promise<ProductStockAcrossWarehouses> {
    const { data } = await apiClient.get(`/warehouses/products/${productId}/stock`);
    return data.data || data;
  },

  // Get stock for multiple products at once (bulk)
  async getBulkProductStock(productIds: string[]): Promise<Record<string, ProductStockAcrossWarehouses>> {
    const { data } = await apiClient.post('/warehouses/products/bulk-stock', {
      productIds
    });
    return data.data || data;
  },

  // Update warehouse inventory (admin only)
  async updateInventory(
    productId: string,
    warehouseId: string,
    stockCount: number,
    location?: string
  ): Promise<WarehouseInventory> {
    const { data } = await apiClient.put(`/inventory/${productId}`, {
      warehouse_id: warehouseId,
      stock_count: stockCount,
      location,
    });
    return data.data || data;
  },
};
