import apiClient from '@/lib/apiClient';
import { ProductVariant, ProductPrice } from './products';

export interface CreateVariantInput {
  name: string;
  sku?: string | null;
  sale_price?: number | null;
  mrp_price?: number | null;
  image_url?: string | null;
  is_featured?: boolean;
  is_active?: boolean;
  unit?: number | null;
  unit_type?: string;
  best_before?: string | null;
  tax_id?: string | null;
  hsn?: string | null;
  badge?: string | null;
  brand_id?: string | null;
}

export interface UpdateVariantInput extends Partial<CreateVariantInput> {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const variantsService = {
  /**
   * Get all variants for a product
   */
  async getByProduct(productId: string): Promise<ProductVariant[]> {
    const { data: response } = await apiClient.get<ApiResponse<ProductVariant[]>>(`/products/${productId}/variants`);
    return response.data;
  },

  /**
   * Get variant by ID
   */
  async getById(variantId: string): Promise<ProductVariant> {
    const { data: response } = await apiClient.get<ApiResponse<ProductVariant>>(`/products/variants/${variantId}`);
    return response.data;
  },

  /**
   * Create a new variant for a product
   */
  async create(productId: string, variantData: CreateVariantInput): Promise<ProductVariant> {
    const { data: response } = await apiClient.post<ApiResponse<ProductVariant>>(`/products/${productId}/variants`, variantData);
    return response.data;
  },

  /**
   * Update an existing variant
   */
  async update(variantId: string, variantData: UpdateVariantInput): Promise<ProductVariant> {
    const { data: response } = await apiClient.put<ApiResponse<ProductVariant>>(`/products/variants/${variantId}`, variantData);
    return response.data;
  },

  /**
   * Delete a variant
   */
  async delete(variantId: string): Promise<void> {
    await apiClient.delete(`/products/variants/${variantId}`);
  },
};


export type { ProductVariant };
