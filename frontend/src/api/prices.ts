import apiClient from '@/lib/apiClient';
import { ProductPrice } from './products';

export interface CreatePriceInput {
  product_id?: string | null;
  variant_id?: string | null;
  outlet_id?: string | null;
  price_type: string;
  sale_price: number;
  mrp_price: number;
  brand_id?: string | null;
  valid_from: string;
  valid_until?: string | null;
}

export interface UpdatePriceInput extends Partial<CreatePriceInput> {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const pricesService = {
  /**
   * Get all prices for a variant
   */
  async getVariantPrices(variantId: string): Promise<ProductPrice[]> {
    const { data: response } = await apiClient.get<ApiResponse<ProductPrice[]>>(`/prices/variants/${variantId}`);
    return response.data;
  },

  /**
   * Get price by ID
   */
  async getById(priceId: string): Promise<ProductPrice> {
    const { data: response } = await apiClient.get<ApiResponse<ProductPrice>>(`/prices/${priceId}`);
    return response.data;
  },

  /**
   * Create a new price entry for a variant
   */
  async create(variantId: string, priceData: CreatePriceInput): Promise<ProductPrice> {
    const { data: response } = await apiClient.post<ApiResponse<ProductPrice>>(`/prices/variants/${variantId}`, priceData);
    return response.data;
  },

  /**
   * Update an existing price entry
   */
  async update(priceId: string, priceData: UpdatePriceInput): Promise<ProductPrice> {
    const { data: response } = await apiClient.put<ApiResponse<ProductPrice>>(`/prices/${priceId}`, priceData);
    return response.data;
  },

  /**
   * Delete a price entry
   */
  async delete(priceId: string): Promise<void> {
    await apiClient.delete(`/prices/${priceId}`);
  },
};


export type { ProductPrice };
