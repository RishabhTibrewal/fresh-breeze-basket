import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../utils/appError';

// Get credit period by order ID
export const getCreditPeriodByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    console.log('Fetching credit period for order ID:', orderId);

    if (!req.companyId) {
      return res.status(400).json({ success: false, message: 'Company context is required' });
    }

    // Query credit_periods table to find credit period associated with this order
    const { data: creditPeriod, error } = await supabase
      .from('credit_periods')
      .select('*')
      .eq('order_id', orderId)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credit period found for this order
        console.log('No credit period found for order ID:', orderId);
        return res.status(404).json({
          success: false,
          message: 'No credit period found for this order'
        });
      }
      throw new AppError(`Error fetching credit period: ${error.message}`, 500);
    }

    console.log('Credit period found:', creditPeriod);
    return res.status(200).json({
      success: true,
      data: creditPeriod
    });
  } catch (error) {
    console.error('Error in getCreditPeriodByOrderId:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all credit periods for a customer
export const getCustomerCreditPeriods = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    console.log('Fetching credit periods for customer ID:', customerId);

    if (!req.companyId) {
      return res.status(400).json({ success: false, message: 'Company context is required' });
    }

    // Query credit_periods table to find all credit periods for this customer
    const { data: creditPeriods, error } = await supabase
      .from('credit_periods')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(`Error fetching credit periods: ${error.message}`, 500);
    }

    console.log(`Found ${creditPeriods.length} credit periods for customer ID:`, customerId);
    return res.status(200).json({
      success: true,
      data: creditPeriods
    });
  } catch (error) {
    console.error('Error in getCustomerCreditPeriods:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update credit period status
export const updateCreditPeriodStatus = async (req: Request, res: Response) => {
  try {
    const { creditPeriodId } = req.params;
    const { status, payment_method, payment_amount } = req.body;
    console.log('=== CREDIT PERIOD UPDATE REQUEST ===');
    console.log('Credit Period ID:', creditPeriodId);
    console.log('Request body:', req.body);

    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    if (!status) {
      throw new AppError('Status is required', 400);
    }

    // Validate status
    const validStatuses = ['paid', 'partial', 'unpaid'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status value', 400);
    }

    // Validate payment_amount is provided when status is partial
    if (status === 'partial' && !payment_amount) {
      throw new AppError('Payment amount is required for partial payments', 400);
    }

    // Get current credit period data
    const { data: currentCreditPeriod, error: fetchError } = await supabase
      .from('credit_periods')
      .select('*, orders!credit_periods_order_id_fkey(user_id)')
      .eq('id', creditPeriodId)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError) {
      console.error('Error fetching credit period:', fetchError);
      throw new AppError(`Credit period not found: ${fetchError.message}`, 404);
    }

    console.log('Original credit period data:', JSON.stringify(currentCreditPeriod, null, 2));

    // Get the user_id from the related order
    const userId = currentCreditPeriod.orders?.user_id;
    if (!userId) {
      console.error('Could not find user_id for the credit period', currentCreditPeriod);
      throw new AppError('Could not determine customer for this credit period', 500);
    }

    // Find the customer record for this user
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, current_credit, credit_limit')
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
      .single();

    if (customerError) {
      console.error('Error finding customer:', customerError);
      throw new AppError(`Could not find customer: ${customerError.message}`, 404);
    }

    console.log('Found customer for credit period:', customer);

    // Prepare update data for credit period
    const updateData: any = {};

    let paymentAmountToProcess = 0;
    
    // Handle different payment scenarios
    if (status === 'paid') {
      // Full payment - set amount to 0
      paymentAmountToProcess = parseFloat(currentCreditPeriod.amount.toString());
      updateData.amount = 0;
      updateData.description = `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`;
    } else if (status === 'partial' && payment_amount) {
      const currentAmount = parseFloat(currentCreditPeriod.amount.toString());
      // Ensure payment amount is a number
      const parsedPaymentAmount = parseFloat(payment_amount.toString());
      
      // Partial payment - reduce the amount
      if (parsedPaymentAmount >= currentAmount) {
        // If payment is greater than or equal to the balance, treat as full payment
        paymentAmountToProcess = currentAmount;
        updateData.amount = 0;
        updateData.description = `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`;
      } else {
        // Regular partial payment
        paymentAmountToProcess = parsedPaymentAmount;
        const remainingAmount = currentAmount - parsedPaymentAmount;
        updateData.amount = remainingAmount;
        updateData.description = `Partial payment of $${parsedPaymentAmount.toFixed(2)} received on ${new Date().toISOString().split('T')[0]} via ${payment_method}. Remaining: $${remainingAmount.toFixed(2)}`;
      }
    } else {
      // If status is 'unpaid', just update the description
      updateData.description = `Credit marked as unpaid on ${new Date().toISOString().split('T')[0]}`;
    }

    console.log('Credit period update data:', JSON.stringify(updateData, null, 2));
    console.log('Payment amount to process:', paymentAmountToProcess);
    console.log('Customer current credit before update:', customer.current_credit);

    // 1. Update credit period
    const { data: updatedCreditPeriod, error: updateError } = await supabase
      .from('credit_periods')
      .update(updateData)
      .eq('id', creditPeriodId)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating credit period:', updateError);
      throw new AppError(`Failed to update credit period: ${updateError.message}`, 500);
    }

    console.log('Credit period updated successfully:', JSON.stringify(updatedCreditPeriod, null, 2));

    // 2. Update customer's current_credit if there's a payment amount
    if (paymentAmountToProcess > 0) {
      // Calculate new current_credit value - ensure it doesn't go below 0
      const currentCredit = parseFloat(customer.current_credit.toString());
      const newCreditAmount = Math.max(0, currentCredit - paymentAmountToProcess);
      
      console.log('Updating customer credit:', {
        customerId: customer.id,
        currentCredit: currentCredit,
        payment: paymentAmountToProcess,
        newCredit: newCreditAmount
      });

      // Explicitly convert types to avoid any type conversion issues
      const { data: updatedCustomer, error: customerUpdateError } = await supabase
        .from('customers')
        .update({ current_credit: newCreditAmount })
        .eq('id', customer.id)
        .eq('company_id', req.companyId)
        .select()
        .single();

      if (customerUpdateError) {
        console.error('Error updating customer credit:', customerUpdateError);
        console.log('WARNING: Credit period was updated but customer credit was not updated');
      } else {
        console.log('Customer current credit updated successfully:', updatedCustomer.current_credit);
      }
    }

    // 3. Record payment in payments table if available
    if (paymentAmountToProcess > 0) {
      try {
        const paymentRecord = {
          credit_period_id: creditPeriodId,
          amount: paymentAmountToProcess,
          payment_date: new Date(),
          status: 'completed',
          customer_id: customer.id,
          company_id: req.companyId
        };
        
        console.log('Recording payment:', paymentRecord);
        
        // Check if payments table exists
        const { count, error: tableCheckError } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true });
        
        if (tableCheckError) {
          console.error('Error checking payments table:', tableCheckError);
          // If table doesn't exist, log the error but don't fail the transaction
          console.log('Payments table may not exist, skipping payment record');
        } else {
          // Table exists, insert the payment
          const { error: paymentError } = await supabase
            .from('payments')
            .insert(paymentRecord);
            
          if (paymentError) {
            console.error('Error recording payment:', paymentError);
          } else {
            console.log('Payment recorded successfully');
          }
        }
      } catch (paymentError) {
        console.error('Failed to record payment:', paymentError);
        // Continue with operation even if payment record fails
      }
    }

    // Return the updated credit period with summary of changes
    return res.status(200).json({
      success: true,
      data: updatedCreditPeriod,
      summary: {
        previous_amount: currentCreditPeriod.amount,
        payment_processed: paymentAmountToProcess,
        new_amount: updatedCreditPeriod.amount,
        customer_id: customer.id,
        customer_credit_updated: paymentAmountToProcess > 0,
      }
    });
  } catch (error) {
    console.error('Error in updateCreditPeriodStatus:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

export const creditPeriodController = {
  getCreditPeriodByOrderId,
  getCustomerCreditPeriods,
  updateCreditPeriodStatus
}; 