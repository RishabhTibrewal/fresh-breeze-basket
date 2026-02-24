import { supabaseAdmin } from '../../lib/supabase';

/**
 * PaymentService - Handles payment processing
 * Industry-agnostic payment service
 */
export class PaymentService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Process payment for an order
   */
  async processPayment(params: {
    orderId: string;
    amount: number;
    paymentMethod: string;
    status?: 'pending' | 'completed' | 'failed';
    stripePaymentIntentId?: string;
    paymentGatewayResponse?: any;
    transactionReferences?: any;
  }): Promise<string | null> {
    try {
      const {
        orderId,
        amount,
        paymentMethod,
        status = 'completed',
        stripePaymentIntentId,
        paymentGatewayResponse,
        transactionReferences,
      } = params;

      // Create payment record
      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: orderId,
          amount,
          status,
          payment_method: paymentMethod,
          stripe_payment_intent_id: stripePaymentIntentId || null,
          payment_gateway_response: paymentGatewayResponse || null,
          transaction_references: transactionReferences || null,
          company_id: this.companyId,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error processing payment:', error);
        return null;
      }

      // Update order payment status
      await this.updateOrderPaymentStatus(orderId, status === 'completed' ? 'paid' : 'pending');

      return payment.id;
    } catch (error) {
      console.error('Error processing payment:', error);
      return null;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentId: string,
    amount: number,
    reason?: string
  ): Promise<boolean> {
    try {
      // Get payment details
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('order_id, amount, status')
        .eq('id', paymentId)
        .eq('company_id', this.companyId)
        .single();

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      // Create refund payment record (negative amount)
      const { error: refundError } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: payment.order_id,
          amount: -amount,
          status: 'refunded',
          payment_method: 'refund',
          transaction_references: {
            original_payment_id: paymentId,
            reason: reason || 'Refund',
          },
          company_id: this.companyId,
        });

      if (refundError) {
        console.error('Error creating refund:', refundError);
        return false;
      }

      // Update original payment status if fully refunded
      if (amount >= parseFloat(payment.amount.toString())) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'refunded' })
          .eq('id', paymentId);
      }

      return true;
    } catch (error) {
      console.error('Error refunding payment:', error);
      return false;
    }
  }

  /**
   * Update order payment status
   */
  private async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId)
        .eq('company_id', this.companyId);
    } catch (error) {
      console.error('Error updating order payment status:', error);
    }
  }

  /**
   * Get payment history for an order
   */
  async getOrderPayments(orderId: string): Promise<Array<{
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, amount, status, payment_method, created_at')
        .eq('order_id', orderId)
        .eq('company_id', this.companyId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount.toString()),
        status: payment.status,
        paymentMethod: payment.payment_method,
        createdAt: payment.created_at,
      }));
    } catch (error) {
      console.error('Error getting order payments:', error);
      return [];
    }
  }
}

