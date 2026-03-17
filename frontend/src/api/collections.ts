import api from '@/lib/apiClient';

export interface Collection {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface AssignVariantsInput {
  assignments: Array<{
    variant_id: string;
    display_order?: number;
  }>;
}

export const collectionsApi = {
  // Get all collections
  getAll: async (include_items: boolean = false): Promise<Collection[]> => {
    const response = await api.get('/collections', {
      params: { include_items }
    });
    return response.data.data;
  },

  // Get single collection
  getByIdOrSlug: async (idOrSlug: string): Promise<Collection> => {
    const response = await api.get(`/collections/${idOrSlug}`);
    return response.data.data;
  },

  // Create collection
  create: async (data: CreateCollectionInput): Promise<Collection> => {
    const response = await api.post('/collections', data);
    return response.data.data;
  },

  // Update collection
  update: async (id: string, data: Partial<CreateCollectionInput>): Promise<Collection> => {
    const response = await api.put(`/collections/${id}`, data);
    return response.data.data;
  },

  // Delete collection
  delete: async (id: string): Promise<void> => {
    await api.delete(`/collections/${id}`);
  },

  // Assign variants to collection
  assignVariants: async (id: string, data: AssignVariantsInput): Promise<void> => {
    await api.post(`/collections/${id}/assignments`, data);
  }
};
