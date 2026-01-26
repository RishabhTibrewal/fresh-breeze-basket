import apiClient from '@/lib/apiClient';

export interface WarehouseManager {
  id: string;
  user_id: string;
  warehouse_id: string;
  company_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  warehouses?: {
    id: string;
    name: string;
    code: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    is_active: boolean;
  };
}

export interface WarehouseManagerResponse {
  success: boolean;
  data: WarehouseManager[];
}

export interface AssignWarehouseManagerData {
  user_id: string;
  warehouse_id: string;
}

export const warehouseManagersService = {
  async getAll(): Promise<WarehouseManager[]> {
    const { data } = await apiClient.get<WarehouseManagerResponse>('/warehouse-managers');
    return data.data || [];
  },

  async getByWarehouse(warehouseId: string): Promise<WarehouseManager[]> {
    const { data } = await apiClient.get<WarehouseManagerResponse>(`/warehouse-managers/warehouse/${warehouseId}`);
    return data.data || [];
  },

  async getByUser(userId: string): Promise<WarehouseManager[]> {
    const { data } = await apiClient.get<WarehouseManagerResponse>(`/warehouse-managers/user/${userId}`);
    return data.data || [];
  },

  async assign(data: AssignWarehouseManagerData): Promise<WarehouseManager> {
    const { data: response } = await apiClient.post<{ success: boolean; data: WarehouseManager }>(
      '/warehouse-managers',
      data
    );
    return response.data;
  },

  async remove(userId: string, warehouseId: string): Promise<void> {
    await apiClient.delete(`/warehouse-managers/${userId}/${warehouseId}`);
  },
};

