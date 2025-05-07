import apiClient from '@/lib/apiClient';

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    price: number;
    sale_price?: number;
    unit?: number;
    unit_type?: string;
    image_url?: string;
    description?: string;
    category_id?: string;
    is_active?: boolean;
    is_featured?: boolean;
  };
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

  async addItem(product_id: string, quantity: number = 1): Promise<any> {
    const response = await apiClient.post('/cart', { product_id, quantity });
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