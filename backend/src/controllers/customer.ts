import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get customer details for the logged-in user
export const getCustomerDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Get customer details
    const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
      .from('customers')
      .select(`
        *,
        credit_periods (
          id,
          amount,
          period,
          start_date,
          end_date,
          type,
          description,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
      .single();

    if (customerError) {
      if (customerError.code === 'PGRST116') {
        // Customer not found
        return res.status(404).json({
          success: false,
          message: 'Customer profile not found'
        });
      }
      throw new ApiError(500, 'Error fetching customer details');
    }

    return res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    if (error instanceof ApiError) {
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