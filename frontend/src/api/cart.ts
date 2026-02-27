import apiClient from '@/lib/apiClient';

export interface CartItem {
  id: string;
  quantity: number;
  variant_id: string | null;
  products: {
    id: string;
    name: string;
    image_url?: string | null;
    description?: string | null;
    category_id?: string | null;
    is_active?: boolean;
    slug?: string | null;
  };
  // Joined variant with its price — present when variant_id is set
  variant?: {
    id: string;
    name: string;
    sku?: string | null;
    image_url?: string | null;
    unit?: number | null;
    unit_type?: string | null;
    is_default?: boolean;
    price?: {
      id: string;
      sale_price: number;
      mrp_price: number;
      price_type: string;
    } | null;
  } | null;
}

export interface Cart {
  success: boolean;
  data: CartItem[];
}

export const cartService = {
  async getCart(): Promise<Cart> {
    const response = await apiClient.get<Cart>('/cart');
    return response.data;
  },

  async addItem(product_id: string, quantity: number, variant_id: string): Promise<any> {
    const response = await apiClient.post('/cart', { product_id, quantity, variant_id });
    return response.data;
  },

  async updateItemQuantity(itemId: string, quantity: number): Promise<any> {
    const response = await apiClient.put(`/cart/${itemId}`, { quantity });
    return response.data;
  },

  async removeItem(itemId: string): Promise<any> {
    const response = await apiClient.delete(`/cart/${itemId}`);
    return response.data;
  },

  async clearCart(): Promise<any> {
    const response = await apiClient.delete('/cart');
    return response.data;
  },
}; 