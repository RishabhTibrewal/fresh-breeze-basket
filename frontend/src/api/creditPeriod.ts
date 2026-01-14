import apiClient from '@/lib/apiClient';

export interface CreditPeriod {
  id: string;
  customer_id: string;
  order_id: string;
  amount: number;
  period: number;
  start_date: string;
  end_date: string;
  type: 'credit' | 'payment';
  description: string | null;
  created_at: string;
  status?: string;
  due_date?: string;
  interest_rate?: number;
}

export const creditPeriodService = {
  // Get credit period by order ID
  async getCreditPeriodByOrderId(orderId: string): Promise<CreditPeriod | null> {
    try {
      console.log('Fetching credit period for order ID:', orderId);
      const response = await apiClient.get(`/credit-period/order/${orderId}`);
      if (response.data.success) {
        console.log('Credit period found:', response.data.data);
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      // Handle 404 as a normal case (no credit period for this order)
      if (error.response?.status === 404) {
        console.log('No credit period found for order ID:', orderId);
        return null;
      }
      console.error('Error fetching credit period for order:', error);
      return null;
    }
  },

  // Get all credit periods for a customer
  async getCustomerCreditPeriods(customerId: string): Promise<CreditPeriod[]> {
    try {
      console.log('Fetching credit periods for customer ID:', customerId);
      const response = await apiClient.get(`/credit-period/customer/${customerId}`);
      if (response.data.success) {
        console.log(`Found ${response.data.data.length} credit periods`);
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching credit periods for customer:', error);
      return [];
    }
  },

  // Update credit period status
  async updateStatus(
    creditPeriodId: string, 
    status: 'paid' | 'partial' | 'unpaid',
    paymentMethod?: string,
    paymentAmount?: number
  ): Promise<CreditPeriod | null> {
    try {
      console.log('=== CREDIT PERIOD UPDATE CALL ===');
      console.log('Credit Period ID:', creditPeriodId);
      console.log('Status:', status);
      console.log('Payment Method:', paymentMethod);
      console.log('Payment Amount:', paymentAmount);
      
      if (!creditPeriodId) {
        console.error('Credit period ID is required');
        throw new Error('Credit period ID is required');
      }
      
      // Make sure payment amount is a number
      let parsedPaymentAmount: number | undefined = undefined;
      if (paymentAmount !== undefined) {
        parsedPaymentAmount = parseFloat(paymentAmount.toString());
        if (isNaN(parsedPaymentAmount)) {
          console.error('Invalid payment amount:', paymentAmount);
          throw new Error('Payment amount must be a valid number');
        }
      }
      
      // For partial payments, payment amount is required
      if (status === 'partial' && (parsedPaymentAmount === undefined || parsedPaymentAmount <= 0)) {
        console.error('Payment amount is required for partial payments');
        throw new Error('Payment amount is required for partial payments');
      }
      
      // Build the update data without 'status' field (since it doesn't exist in the table)
      const updateData: any = {};
      // We still send the payment status as a parameter for the backend to use
      updateData.status = status; // Backend will use this to determine what to do, but won't directly update this field
      if (paymentMethod) updateData.payment_method = paymentMethod;
      if (parsedPaymentAmount !== undefined) updateData.payment_amount = parsedPaymentAmount;
      
      console.log('Sending data to backend:', JSON.stringify(updateData, null, 2));
      
      // Make API call with proper error handling
      try {
        const response = await apiClient.put(`/credit-period/${creditPeriodId}/status`, updateData);
        console.log('Response from credit period update:', response.data);
        
        if (response.data && response.data.success) {
          console.log('Credit period updated successfully:', response.data.data);
          
          // Log summary data if available
          if (response.data.summary) {
            console.log('Update summary:', response.data.summary);
          }
          
          return response.data.data;
        } else {
          console.error('Credit period update failed:', response.data);
          throw new Error(response.data?.message || 'Failed to update credit period');
        }
      } catch (apiError: any) {
        console.error('API error during credit period update:', apiError);
        if (apiError.response) {
          console.error('API response details:', {
            status: apiError.response.status,
            statusText: apiError.response.statusText,
            data: apiError.response.data
          });
          throw new Error(apiError.response.data?.message || 'API error during credit period update');
        }
        throw apiError;
      }
    } catch (error: any) {
      console.error('Error updating credit period status:', error);
      throw error;
    }
  }
}; 