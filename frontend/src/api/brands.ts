import apiClient from '@/lib/apiClient';
import { Product } from './products';

export interface Brand {
  id: string;
  name: string;
  slug: string | null;
  legal_name: string | null;
  logo_url: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandInput {
  name: string;
  slug?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
}

export interface UpdateBrandInput extends Partial<CreateBrandInput> {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const brandsService = {
  /**
   * Get all brands
   */
  async getAll(): Promise<Brand[]> {
    const { data: response } = await apiClient.get<ApiResponse<Brand[]>>('/brands');
    return response.data;
  },

  /**
   * Get brand by ID
   */
  async getById(id: string): Promise<Brand> {
    const { data: response } = await apiClient.get<ApiResponse<Brand>>(`/brands/${id}`);
    return response.data;
  },

  /**
   * Create a new brand
   */
  async create(brandData: CreateBrandInput): Promise<Brand> {
    const { data: response } = await apiClient.post<ApiResponse<Brand>>('/brands', brandData);
    return response.data;
  },

  /**
   * Update an existing brand
   */
  async update(id: string, brandData: UpdateBrandInput): Promise<Brand> {
    const { data: response } = await apiClient.put<ApiResponse<Brand>>(`/brands/${id}`, brandData);
    return response.data;
  },

  /**
   * Delete a brand
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/brands/${id}`);
  },

  /**
   * Get all products for a brand
   */
  async getProducts(brandId: string): Promise<Product[]> {
    const { data: response } = await apiClient.get<ApiResponse<Product[]>>(`/brands/${brandId}/products`);
    return response.data;
  },
};

