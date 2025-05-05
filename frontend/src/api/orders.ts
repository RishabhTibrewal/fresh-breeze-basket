import apiClient from '@/lib/apiClient';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    image?: string;
  };
}

export interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  items: OrderItem[];
  shippingAddress: {
    id: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  billingAddress: {
    id: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  created_at: string;
  updated_at: string;
  payment_method?: string;
  payment_status?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  notes?: string;
  shipping_address_id?: string;
  billing_address_id?: string;
  shipping_address?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  billing_address?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  user_id?: string;
}

export interface CreateOrderData {
  items: {
    product_id: string;
    quantity: number;
    price: number;
  }[];
  shipping_address?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  shipping_address_id: string;
  billing_address?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  billing_address_id: string;
  payment_method?: string;
  total_amount: number;
}

export const ordersService = {
  async getAll(): Promise<Order[]> {
    const { data } = await apiClient.get<{ success: boolean, data: any[] }>('/orders');
    
    // Added logging to debug the API response structure
    console.log('Orders API response:', data);
    
    return data.data.map(order => ({
      ...order,
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      items: order.order_items || [],
      userId: order.user_id,
      user_id: order.user_id,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      tracking_number: order.tracking_number,
      estimated_delivery: order.estimated_delivery,
      notes: order.notes,
      shipping_address_id: order.shipping_address_id,
      billing_address_id: order.billing_address_id,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address
    }));
  },

  async getById(id: string): Promise<Order> {
    const { data } = await apiClient.get<{ success: boolean, data: any }>(`/orders/${id}`);
    
    // Added logging to debug the API response structure for a single order
    console.log('Order detail API response:', data);
    
    const order = data.data;
    return {
      ...order,
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      items: order.order_items || [],
      userId: order.user_id,
      user_id: order.user_id, // Keep original field for compatibility
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      tracking_number: order.tracking_number,
      estimated_delivery: order.estimated_delivery,
      notes: order.notes,
      shipping_address_id: order.shipping_address_id,
      billing_address_id: order.billing_address_id,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address
    };
  },

  async getMyOrders(): Promise<Order[]> {
    const { data } = await apiClient.get<{ success: boolean, data: any[] }>('/orders/my-orders');
    return data.data.map(order => ({
      ...order,
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      items: order.order_items || [],
      userId: order.user_id,
      user_id: order.user_id,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      tracking_number: order.tracking_number,
      estimated_delivery: order.estimated_delivery,
      notes: order.notes,
      shipping_address_id: order.shipping_address_id,
      billing_address_id: order.billing_address_id,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address
    }));
  },

  async create(orderData: CreateOrderData): Promise<{ order_id: string }> {
    // Set default payment method and total amount if not provided
    const finalOrderData = {
      ...orderData,
      payment_method: orderData.payment_method || 'card',
    };
    
    const { data } = await apiClient.post<{ success: boolean, data: { order_id: string } }>('/orders', finalOrderData);
    return data.data;
  },

  async updateStatus(
    id: string, 
    status: Order['status'], 
    tracking_number?: string, 
    estimated_delivery?: string, 
    notes?: string
  ): Promise<Order> {
    const updateData: any = { status };
    
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (estimated_delivery) updateData.estimated_delivery = estimated_delivery;
    if (notes) updateData.notes = notes;
    
    const { data } = await apiClient.put<{ success: boolean, data: Order }>(
      `/orders/${id}/status`, 
      updateData
    );
    return data.data;
  },

  async cancel(id: string): Promise<Order> {
    const { data } = await apiClient.put<{ success: boolean, data: Order }>(`/orders/${id}/cancel`, {});
    return data.data;
  },

  // Check if an order is within the cancellable timeframe (5 minutes)
  canBeCancelled(order: Order): boolean {
    if (order.status !== 'pending' && order.status !== 'processing') {
      return false;
    }
    
    const orderDate = new Date(order.created_at);
    const currentTime = new Date();
    const timeDifferenceMinutes = (currentTime.getTime() - orderDate.getTime()) / (1000 * 60);
    
    return timeDifferenceMinutes <= 5;
  }
}; 