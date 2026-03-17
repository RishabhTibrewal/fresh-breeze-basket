import apiClient from '@/lib/apiClient';

export interface Modifier {
  id: string;
  company_id: string;
  modifier_group_id: string;
  name: string;
  price_adjust: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ModifierGroup {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  min_select: number;
  max_select: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Nested relation
  modifiers?: Modifier[];
}

export interface CreateModifierGroupInput {
  name: string;
  description?: string | null;
  min_select?: number;
  max_select?: number | null;
  is_active?: boolean;
}

export interface UpdateModifierGroupData extends Partial<CreateModifierGroupInput> {}

export interface CreateModifierInput {
  modifier_group_id: string;
  name: string;
  price_adjust?: number;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateModifierData extends Partial<Omit<CreateModifierInput, 'modifier_group_id'>> {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const modifiersService = {
  // --- Modifier Groups ---
  
  async getModifierGroups(): Promise<ModifierGroup[]> {
    const { data: response } = await apiClient.get<ApiResponse<ModifierGroup[]>>('/modifiers');
    return response.data;
  },

  async createModifierGroup(data: CreateModifierGroupInput): Promise<ModifierGroup> {
    const { data: response } = await apiClient.post<ApiResponse<ModifierGroup>>('/modifiers', data);
    return response.data;
  },

  async updateModifierGroup(id: string, data: UpdateModifierGroupData): Promise<ModifierGroup> {
    const { data: response } = await apiClient.put<ApiResponse<ModifierGroup>>(`/modifiers/${id}`, data);
    return response.data;
  },

  async deleteModifierGroup(id: string): Promise<void> {
    await apiClient.delete(`/modifiers/${id}`);
  },

  // --- Modifiers ---

  async getModifiersByGroup(groupId: string): Promise<Modifier[]> {
    const { data: response } = await apiClient.get<ApiResponse<Modifier[]>>(`/modifiers/${groupId}/modifiers`);
    return response.data;
  },

  async createModifier(data: CreateModifierInput): Promise<Modifier> {
    const { data: response } = await apiClient.post<ApiResponse<Modifier>>('/modifiers/items', data);
    return response.data;
  },

  async updateModifier(id: string, data: UpdateModifierData): Promise<Modifier> {
    const { data: response } = await apiClient.put<ApiResponse<Modifier>>(`/modifiers/items/${id}`, data);
    return response.data;
  },

  async deleteModifier(id: string): Promise<void> {
    await apiClient.delete(`/modifiers/items/${id}`);
  }
};
