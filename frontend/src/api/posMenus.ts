import apiClient from '@/lib/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PosMenuOutlet {
  id: string;
  warehouse_id: string;
  warehouses: { id: string; name: string; code: string };
}

export interface PosMenuItem {
  id: string;
  product_id: string;
  variant_id: string;
  is_visible: boolean;
  pos_price: number | null;
  sort_order: number;
}

export interface PosMenu {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  outlets: PosMenuOutlet[];
  items?: PosMenuItem[];
}

export interface ActiveMenu {
  id: string;
  name: string;
  description: string | null;
  items: PosMenuItem[];
}

export interface UpsertMenuItemInput {
  variant_id: string;
  product_id: string;
  is_visible: boolean;
  pos_price: number | null;
  sort_order: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

export const posMenusApi = {
  list: async (): Promise<PosMenu[]> => {
    const res = await apiClient.get('/pos/menus');
    return res.data?.data ?? [];
  },

  create: async (payload: { name: string; description?: string }): Promise<PosMenu> => {
    const res = await apiClient.post('/pos/menus', payload);
    return res.data.data;
  },

  getActive: async (warehouseId: string): Promise<ActiveMenu | null> => {
    const res = await apiClient.get('/pos/menus/active', { params: { warehouse_id: warehouseId } });
    return res.data?.data ?? null;
  },

  get: async (id: string): Promise<PosMenu> => {
    const res = await apiClient.get(`/pos/menus/${id}`);
    return res.data.data;
  },

  update: async (id: string, payload: { name: string; description?: string }): Promise<PosMenu> => {
    const res = await apiClient.put(`/pos/menus/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/pos/menus/${id}`);
  },

  upsertItems: async (menuId: string, items: UpsertMenuItemInput[]): Promise<PosMenuItem[]> => {
    const res = await apiClient.put(`/pos/menus/${menuId}/items`, { items });
    return res.data?.data ?? [];
  },

  assignOutlet: async (menuId: string, warehouseId: string): Promise<void> => {
    await apiClient.post(`/pos/menus/${menuId}/outlets/${warehouseId}`);
  },

  unassignOutlet: async (menuId: string, warehouseId: string): Promise<void> => {
    await apiClient.delete(`/pos/menus/${menuId}/outlets/${warehouseId}`);
  },
};
