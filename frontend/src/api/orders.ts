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
  tax_amount?: number;
  tax_rate?: number;
  items: OrderItem[];
  order_items?: OrderItem[];
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
  // Explicit order classification fields (may be undefined for older data)
  order_type?: 'sales' | 'purchase' | 'return';
  order_source?: 'ecommerce' | 'pos' | 'sales' | 'internal';
  fulfillment_type?: 'delivery' | 'pickup' | 'cash_counter';
  original_order_id?: string;
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
  // Optional explicit fields – backend will infer sane defaults if omitted
  fulfillment_type?: 'delivery' | 'pickup';
  order_source?: 'ecommerce' | 'pos' | 'sales';
}

export interface CreateReturnOrderData {
  original_order_id: string;
  items: {
    product_id: string;
    variant_id?: string;
    quantity: number;
  }[];
  reason?: string;
}

export interface OrdersResponse {
  success: boolean;
  data: Order[];
  count: number;
}

export const ordersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: string;
    order_type?: 'sales' | 'purchase' | 'return';
    order_source?: 'ecommerce' | 'pos' | 'sales' | 'internal';
    fulfillment_type?: 'delivery' | 'pickup' | 'cash_counter';
    original_order_id?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<OrdersResponse> {
    const { data } = await apiClient.get<OrdersResponse>('/orders', { params });
    
    // Added logging to debug the API response structure
    console.log('Orders API response:', data);
    
    return {
      success: data.success,
      count: data.count,
      data: data.data.map(order => ({
        ...order,
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
        tax_rate: order.tax_rate,
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
      }))
    };
  },

  async getById(id: string): Promise<Order> {
    try {
      // Try first with user orders endpoint which returns {success, data} structure
      const response = await apiClient.get(`/orders/${id}`);
      console.log('Order detail API direct response:', response);
      
      // Handle both response formats - either {success, data} or direct object
      let order;
      if (response.data.success && response.data.data) {
        // Response has success/data structure
        order = response.data.data;
      } else {
        // Direct object response
        order = response.data;
      }
      
      // Handle case where order is not found
      if (!order || !order.id) {
        throw new Error('Order not found');
      }
      
      console.log('Processed order:', order);
      
      return {
        ...order,
        id: order.id,
        status: order.status || 'pending',
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
        tax_rate: order.tax_rate,
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
    } catch (error) {
      console.error('Error in getById:', error);
      
      // If first attempt fails, try customer order endpoint
      try {
        // Try to find the customer ID from local storage or another source
        const customerId = localStorage.getItem('currentCustomerId');
        if (customerId) {
          console.log('Trying to get order through customer orders endpoint');
          const allOrdersResponse = await apiClient.get(`/customer/${customerId}/orders`);
          const orders = allOrdersResponse.data;
          
          if (Array.isArray(orders)) {
            const order = orders.find(o => o.id === id);
            if (order) {
              return {
                ...order,
                id: order.id,
                status: order.status || 'pending',
                total_amount: order.total_amount,
                created_at: order.created_at,
                items: order.order_items || [],
                userId: order.user_id,
                user_id: order.user_id,
                payment_status: order.payment_status,
                payment_method: order.payment_method
              };
            }
          }
        }
      } catch (customerError) {
        console.error('Error fetching from customer orders:', customerError);
      }
      
      // If all attempts fail, rethrow the original error
      throw error;
    }
  },

  async getMyOrders(): Promise<Order[]> {
    const { data } = await apiClient.get<{ success: boolean, data: any[] }>('/orders/my-orders');
    return data.data.map(order => ({
      ...order,
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      tax_amount: order.tax_amount,
      tax_rate: order.tax_rate,
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

  async updatePayment(
    id: string,
    payment_status: 'pending' | 'full_payment' | 'partial_payment' | 'full_credit',
    payment_method?: 'cash' | 'card' | 'cheque',
    partial_payment_amount?: number
  ): Promise<Order> {
    const updateData: any = { payment_status };
    
    if (payment_method) updateData.payment_method = payment_method;
    if (partial_payment_amount) updateData.partial_payment_amount = partial_payment_amount;
    
    console.log('Updating payment with data:', updateData);
    
    // Use the status endpoint which is available in the backend
    const { data } = await apiClient.put<{ success: boolean, data: Order }>(
      `/orders/${id}/status`, 
      updateData
    );
    return data.data;
  },

  async cancel(id: string): Promise<Order> {
    // Reverted to use PUT /orders/:id/cancel, as indicated by backend routes in `backend/src/routes/orders.ts`
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
  },

  // Get sales dashboard stats for the logged-in sales executive
  async getSalesDashboardStats() {
    const { data } = await apiClient.get('/orders/sales/dashboard-stats');
    return data;
  },

  // Get detailed sales analytics for the logged-in sales executive
  async getSalesAnalytics(period: number = 30) {
    const { data } = await apiClient.get(`/orders/sales/analytics?period=${period}`);
    return data;
  },

  // Create a return order
  async createReturn(orderData: CreateReturnOrderData): Promise<Order> {
    const { data } = await apiClient.post<{ success: boolean, data: Order }>(
      '/orders/returns', 
      orderData
    );
    return data.data;
  }
}; 