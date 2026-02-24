import apiClient from '@/lib/apiClient';
import { Tax } from './products';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export interface CreateTaxInput {
  name: string;
  code: string;
  rate: number;
  is_active?: boolean;
}

export interface UpdateTaxInput extends Partial<CreateTaxInput> {}

export const taxesService = {
  /**
   * Get all taxes
   */
  async getAll(): Promise<Tax[]> {
    const { data: response } = await apiClient.get<ApiResponse<Tax[]>>('/taxes');
    return response.data;
  },

  /**
   * Get tax by ID
   */
  async getById(id: string): Promise<Tax> {
    const { data: response } = await apiClient.get<ApiResponse<Tax>>(`/taxes/${id}`);
    return response.data;
  },

  /**
   * Create a new tax
   */
  async create(taxData: CreateTaxInput): Promise<Tax> {
    const { data: response } = await apiClient.post<ApiResponse<Tax>>('/taxes', taxData);
    return response.data;
  },

  /**
   * Update an existing tax
   */
  async update(id: string, taxData: UpdateTaxInput): Promise<Tax> {
    const { data: response } = await apiClient.put<ApiResponse<Tax>>(`/taxes/${id}`, taxData);
    return response.data;
  },

  /**
   * Delete a tax
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/taxes/${id}`);
  },
};


export type { Tax };
