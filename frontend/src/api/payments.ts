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

export const paymentsService = {
  async createPaymentIntent(amount: number, currency: string = 'aed'): Promise<PaymentIntent> {
    const { data } = await apiClient.post<PaymentIntent>('/payments/intents', {
      amount,
      currency,
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
}; 