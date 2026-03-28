import apiClient from '@/lib/apiClient';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerDetails {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  trn_number: string | null;
  source: 'erp' | 'pos';
  credit_period_days: number | null;
  credit_limit: number | null;
  current_credit: number | null;
  // CD (Cash Discount) fields
  cd_enabled: boolean;
  cd_percentage: number;
  cd_days: number;
  cd_settlement_mode: 'direct' | 'credit_note';
  credit_periods: Array<{
    id: string;
    amount: number;
    period: number;
    start_date: string;
    end_date: string;
    type: 'credit' | 'payment';
    description: string;
    created_at: string;
  }>;
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  order_number: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'partial' | 'paid' | 'credit';
  payment_method: 'full_payment' | 'partial_payment' | 'full_credit' | 'cash';
  created_at: string;
  updated_at: string;
  shipping_address_id?: string;
  billing_address_id?: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  credit_details?: {
    amount: number;
    period: number;
    start_date: string;
    end_date: string;
    type: 'credit' | 'payment';
    description?: string;
  };
}

export interface CustomerFormValues {
  name: string;
  email?: string | null;
  phone?: string | null;
  trn_number?: string | null;
  credit_period_days?: number | null;
  credit_limit?: number | null;
  current_credit?: number | null;
  // CD (Cash Discount) fields
  cd_enabled?: boolean;
  cd_percentage?: number;
  cd_days?: number;
  cd_settlement_mode?: 'direct' | 'credit_note';
  source?: 'erp' | 'pos';
}

export interface CustomerAddress {
  address_type: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
  is_default?: boolean;
}

export const customerService = {
  async getCustomerDetails(): Promise<CustomerDetails> {
    const { data } = await apiClient.get<{ success: boolean; data: CustomerDetails }>('/customer/me');
    return data.data;
  },
  
  async getCustomerById(id: string): Promise<any> {
    const { data } = await apiClient.get<any>(`/customer/${id}`);
    return data;
  },
  
  async getCustomerByUserId(userId: string): Promise<any> {
    const { data } = await apiClient.get<any>(`/customer/by-user/${userId}`);
    return data;
  },
  
  async updateCustomer(id: string, customerData: Partial<CustomerFormValues>): Promise<CustomerDetails> {
    const { data } = await apiClient.put<CustomerDetails>(`/customer/${id}`, customerData);
    return data;
  },
  
  async createCustomer(customerData: CustomerFormValues, password: string = '123456'): Promise<any> {
    try {
      console.log('Creating customer with API - backend will handle user creation');
      
      try {
        const response = await apiClient.post('/customer/with-user', {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          password: password,
          trn_number: customerData.trn_number,
          credit_period_days: customerData.credit_period_days || 0,
          credit_limit: customerData.credit_limit || 0,
          current_credit: customerData.current_credit || 0,
          // CD fields
          cd_enabled: customerData.cd_enabled || false,
          cd_percentage: customerData.cd_percentage || 0,
          cd_days: customerData.cd_days || 0,
          cd_settlement_mode: customerData.cd_settlement_mode || 'direct',
        });
        
        console.log('Customer creation API response:', response.data);
        
        return {
          user: response.data.user,
          customer: response.data.customer
        };
      } catch (apiError: any) {
        console.error('API error during customer creation:', apiError);
        console.error('API error response:', apiError.response?.data);
        console.error('API error status:', apiError.response?.status);
        
        throw apiError;
      }
    } catch (error) {
      console.error('Error creating customer with backend:', error);
      throw error;
    }
  },
  
  async getCustomerOrders(customerId: string): Promise<CustomerOrder[]> {
    const { data } = await apiClient.get<CustomerOrder[]>(`/customer/${customerId}/orders`);
    return data;
  },
  
  async createOrderForCustomer(customerId: string, orderData: any): Promise<CustomerOrder> {
    try {
      console.log('Creating order for customer:', customerId, 'with data:', orderData);
      const response = await apiClient.post(`/customer/${customerId}/orders`, orderData);
      console.log('Order creation response:', response);
      return response.data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      
      // Extract error message from response
      if (error.response && error.response.data) {
        console.error('Server error response:', error.response.data);
        
        if (error.response.data.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw error;
    }
  },
  
  async updateOrderStatus(orderId: string, status: string): Promise<CustomerOrder> {
    const { data } = await apiClient.put<CustomerOrder>(`/orders/${orderId}/status`, { status });
    return data;
  },
  
  // Add a customer address
  async addCustomerAddress(customerId: string, address: CustomerAddress): Promise<any> {
    try {
      const { data } = await apiClient.post(`/customer/${customerId}/address`, address);
      return data;
    } catch (error: any) {
      console.error('Error adding customer address:', error);
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Edit a customer address
  async editCustomerAddress(customerId: string, addressId: string, address: CustomerAddress): Promise<any> {
    try {
      const { data } = await apiClient.put(`/customer/${customerId}/address/${addressId}`, address);
      return data;
    } catch (error: any) {
      console.error('Error updating customer address:', error);
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Delete a customer address
  async deleteCustomerAddress(customerId: string, addressId: string): Promise<any> {
    try {
      const { data } = await apiClient.delete(`/customer/${customerId}/address/${addressId}`);
      return data;
    } catch (error: any) {
      console.error('Error deleting customer address:', error);
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  }
}; 