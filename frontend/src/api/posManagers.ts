import apiClient from '@/lib/apiClient';

export interface PosManagerAssignment {
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
  } | null;
  warehouses?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export const posManagersService = {
  // Assign a POS manager to an outlet (admin/accounts only)
  async assignPosManager(userId: string, warehouseId: string): Promise<PosManagerAssignment> {
    const { data } = await apiClient.post('/pos-managers', {
      user_id: userId,
      warehouse_id: warehouseId
    });
    return data.data || data;
  },

  // Remove a POS manager assignment (admin/accounts only)
  async removePosManager(userId: string, warehouseId: string): Promise<void> {
    await apiClient.delete(`/pos-managers/${userId}/${warehouseId}`);
  },

  // Get all assigned outlets for a specific user
  async getUserPosOutlets(userId: string): Promise<PosManagerAssignment[]> {
    const { data } = await apiClient.get(`/pos-managers/user/${userId}`);
    return data.data || data || [];
  },

  // Get all POS managers assigned to a specific outlet
  async getOutletPosManagers(warehouseId: string): Promise<PosManagerAssignment[]> {
    const { data } = await apiClient.get(`/pos-managers/warehouse/${warehouseId}`);
    return data.data || data || [];
  },

  // Get all POS manager assignments (admin/accounts only)
  async getAllPosManagers(): Promise<PosManagerAssignment[]> {
    const { data } = await apiClient.get('/pos-managers');
    return data.data || data || [];
  }
};

export default posManagersService;
