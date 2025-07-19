import apiClient from '@/lib/apiClient';

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

export interface Payment {
  id: string;
  order_id: string | null;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  stripe_payment_intent_id: string | null;
  payment_gateway_response: any;
  transaction_references: any;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistoryResponse {
  success: boolean;
  data: Payment[];
  count: number;
  page: number;
  limit: number;
}

export const paymentsService = {
  async createPaymentIntent(amount: number, currency: string = 'aed', orderId?: string): Promise<PaymentIntent> {
    const { data } = await apiClient.post<PaymentIntent>('/payments/intents', {
      amount,
      currency,
      order_id: orderId
    });
    return data;
  },

  async confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<PaymentIntent> {
    const { data } = await apiClient.post<PaymentIntent>(`/payments/${paymentIntentId}/confirm`, {
      paymentMethodId,
    });
    return data;
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data } = await apiClient.get<PaymentMethod[]>('/payments/methods');
    return data;
  },

  async attachPaymentMethod(paymentMethodId: string): Promise<void> {
    await apiClient.post(`/payments/methods/${paymentMethodId}/attach`);
  },

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await apiClient.post(`/payments/methods/${paymentMethodId}/detach`);
  },

  async getPaymentHistory(params?: { page?: number; limit?: number }): Promise<PaymentHistoryResponse> {
    const { data } = await apiClient.get<PaymentHistoryResponse>('/payments/history', { params });
    return data;
  },

  async getPaymentById(id: string): Promise<Payment> {
    const { data } = await apiClient.get<{ success: boolean; data: Payment }>(`/payments/${id}`);
    return data.data;
  },

  async createPaymentRecord(params: {
    order_id: string;
    amount: number;
    payment_method: string;
    stripe_payment_intent_id?: string;
    status?: string;
  }): Promise<Payment> {
    const { data } = await apiClient.post<{ success: boolean; data: Payment }>('/payments/create-record', params);
    return data.data;
  },

  async linkPaymentToOrder(payment_intent_id: string, order_id: string): Promise<Payment> {
    const { data } = await apiClient.post<{ success: boolean; data: Payment }>('/payments/link-to-order', {
      payment_intent_id,
      order_id
    });
    return data.data;
  }
}; 