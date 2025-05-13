import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../utils/appError';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trn_number: string | null;
  credit_period_days: number | null;
  credit_limit: number | null;
  current_credit: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_order_date: string | null;
  orders: {
    count: number;
    total_amount: number;
  }[];
}

// Get all customers
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*');

    if (error) throw error;

    // Transform the data to include basic customer information
    const transformedCustomers = (customers as Customer[]).map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      trn_number: customer.trn_number,
      credit_period_days: customer.credit_period_days,
      credit_limit: customer.credit_limit,
      current_credit: customer.current_credit,
      lastOrder: customer.last_order_date || null,
    }));

    res.json(transformedCustomers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw new AppError('Failed to fetch customers', 500);
  }
};

// Get customer by ID
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First, get the customer details
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!customer) throw new AppError('Customer not found', 404);

    // Then separately get the order information
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount')
      .eq('user_id', customer.user_id);
    
    if (ordersError) {
      console.error('Error fetching customer orders:', ordersError);
    }

    // Get credit periods information
    const { data: creditPeriods, error: creditError } = await supabase
      .from('credit_periods')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (creditError) {
      console.error('Error fetching credit periods:', creditError);
    }

    // Calculate order metrics
    const totalOrders = orders?.length || 0;
    const totalSpent = orders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

    // Get active credit information (most recent credit period)
    const activeCredit = creditPeriods && creditPeriods.length > 0 ? 
      creditPeriods.find(period => period.type === 'credit' && new Date(period.end_date) > new Date()) : null;

    const transformedCustomer = {
      id: customer.id,
      user_id: customer.user_id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      trn_number: customer.trn_number,
      totalOrders,
      totalSpent,
      lastOrder: customer.last_order_date || null,
      credit_limit: customer.credit_limit,
      current_credit: customer.current_credit,
      credit_period_days: customer.credit_period_days,
      credit_periods: creditPeriods || [],
      active_credit: activeCredit
    };

    res.json(transformedCustomer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    throw new AppError('Failed to fetch customer', 500);
  }
};

// Create new customer
export const createCustomer = async (req: Request, res: Response) => {
  try {
    console.log('Customer creation request received. Body:', req.body);
    console.log('Authenticated user:', req.user);
    
    const { 
      name, 
      email, 
      phone, 
      trn_number, 
      credit_period_days, 
      credit_limit, 
      current_credit,
      user_id // New parameter passed from frontend
    } = req.body;

    // Validate required fields
    if (!name) {
      console.error('Name is required but was not provided');
      throw new AppError('Name is required', 400);
    }

    // Get the sales executive ID from the authenticated user
    const sales_executive_id = req.user?.id;
    if (!sales_executive_id) {
      console.error('User not authenticated - no user ID found in request');
      throw new AppError('User not authenticated', 401);
    }

    console.log('Authenticated user ID:', sales_executive_id);
    
    // Check if user_id was provided (means a user was created with Supabase Auth API)
    if (user_id) {
      console.log('Creating customer with existing user_id:', user_id);
      
      // Debug: Check if the user exists in auth.users
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(user_id);
      if (authUserError) {
        console.error('Error verifying auth user:', authUserError);
      } else {
        console.log('Auth user exists:', authUser);
      }
      
      // Debug: Check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user_id)
        .single();
      
      if (profileError) {
        console.error('Error checking profile:', profileError);
        
        // Create profile if it doesn't exist
        console.log('Profile not found. Creating new profile for user.');
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user_id,
            email: email,
            role: 'user' // Set role to 'user' for customers
          })
          .select()
          .single();
        
        if (createProfileError) {
          console.error('Error creating profile:', createProfileError);
        } else {
          console.log('Profile created successfully:', newProfile);
        }
      } else {
        console.log('Profile exists:', profileData);
      }
      
      // Create customer payload
      const customerPayload = {
        name,
        email,
        phone,
        trn_number,
        credit_period_days: credit_period_days || 0,
        credit_limit: credit_limit || 0,
        current_credit: current_credit || 0,
        sales_executive_id,
        user_id, // Use the provided user_id
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Customer payload:', customerPayload);
      
      // Create customer directly with the provided user_id
      const { data: customer, error } = await supabase
        .from('customers')
        .insert(customerPayload)
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        throw new AppError(`Failed to create customer: ${error.message}`, 500);
      }

      console.log('Customer created successfully:', customer);
      res.status(201).json(customer);
    } else {
      // Fallback to the original method using the RPC function
      // Check if the user has the correct profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sales_executive_id)
        .single();
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        
        // Create a profile with 'sales' role if it doesn't exist
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: sales_executive_id,
            email: req.user?.email,
            role: 'sales'
          })
          .select()
          .single();
        
        if (createProfileError) {
          console.error('Error creating profile:', createProfileError);
        } else {
          console.log('Created new profile:', newProfile);
        }
      } else {
        console.log('User profile:', userProfile);
      }

      // Use the SECURITY DEFINER function to create customer with user
      const { data: customer, error } = await supabase.rpc('create_customer_with_user', {
        p_name: name,
        p_email: email,
        p_phone: phone,
        p_trn_number: trn_number,
        p_credit_period_days: credit_period_days || 0,
        p_credit_limit: credit_limit || 0,
        p_current_credit: current_credit || 0,
        p_sales_executive_id: sales_executive_id
      });

      if (error) {
        console.error('RPC error:', error);
        throw new AppError('Failed to create customer', 500);
      }

      res.status(201).json(customer);
    }
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to create customer', 500);
  }
};

// Update customer
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      phone, 
      trn_number, 
      credit_period_days, 
      credit_limit, 
      current_credit 
    } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        name,
        email,
        phone,
        trn_number,
        credit_period_days,
        credit_limit,
        current_credit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!customer) throw new AppError('Customer not found', 404);

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    throw new AppError('Failed to update customer', 500);
  }
};

// Delete customer
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw new AppError('Failed to delete customer', 500);
  }
};

// Add credit period for a customer
async function addCreditPeriod(req: Request, res: Response) {
  try {
    const { customer_id, amount, period, start_date, end_date, description } = req.body;
    const sales_executive_id = req.user?.id;

    // Verify the customer belongs to this sales executive
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('sales_executive_id', sales_executive_id)
      .single();

    if (customerError) throw customerError;

    // Add credit period
    const { data: creditPeriod, error: creditError } = await supabase
      .from('credit_periods')
      .insert({
        customer_id,
        amount,
        period,
        start_date,
        end_date,
        type: 'credit',
        description
      })
      .select()
      .single();

    if (creditError) throw creditError;

    // Update customer's current credit
    const { error: updateError } = await supabase
      .from('customers')
      .update({ current_credit: amount })
      .eq('id', customer_id);

    if (updateError) throw updateError;

    res.status(201).json(creditPeriod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Get customer's credit status
async function getCustomerCreditStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const sales_executive_id = req.user?.id;

    const { data: creditStatus, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        current_credit,
        credit_limit,
        credit_period_days,
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
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .single();

    if (error) throw error;

    res.json(creditStatus);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Add address for a customer
async function addCustomerAddress(req: Request, res: Response) {
  try {
    const { customer_id } = req.params;
    const { address_type, address_line1, address_line2, city, state, postal_code, country } = req.body;
    const sales_executive_id = req.user?.id;

    // Verify the customer belongs to this sales executive
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('sales_executive_id', sales_executive_id)
      .single();

    if (customerError) throw customerError;

    const { data: address, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: customer_id,
        address_type,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country
      })
      .select()
      .single();

    if (addressError) throw addressError;

    res.status(201).json(address);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Create new customer with user account - avoids login issues
export const createCustomerWithUser = async (req: Request, res: Response) => {
  try {
    console.log('Customer with user creation request received. Body:', req.body);
    console.log('Authenticated user:', req.user);
    
    const { 
      name, 
      email, 
      phone, 
      password = '123456',
      trn_number, 
      credit_period_days, 
      credit_limit, 
      current_credit
    } = req.body;

    // Validate required fields
    if (!name) {
      console.error('Name is required but was not provided');
      throw new AppError('Name is required', 400);
    }
    
    if (!email) {
      console.error('Email is required but was not provided');
      throw new AppError('Email is required', 400);
    }

    // Get the sales executive ID from the authenticated user
    const sales_executive_id = req.user?.id;
    if (!sales_executive_id) {
      console.error('User not authenticated - no user ID found in request');
      throw new AppError('User not authenticated', 401);
    }

    console.log('Authenticated user ID:', sales_executive_id);
    
    // Use the SECURITY DEFINER function to create customer with user
    console.log('Using create_customer_with_user RPC function');
    const { data: customer, error } = await supabase.rpc('create_customer_with_user', {
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_trn_number: trn_number,
      p_credit_period_days: credit_period_days || 0,
      p_credit_limit: credit_limit || 0,
      p_current_credit: current_credit || 0,
      p_sales_executive_id: sales_executive_id,
      p_password: password
    });

    if (error) {
      console.error('RPC error:', error);
      throw new AppError(`Failed to create customer: ${error.message}`, 500);
    }

    console.log('Customer with user created successfully:', customer);
    
    // Return structured response with user and customer data
    res.status(201).json({
      user: {
        id: customer.user_id,
        email: email
      },
      customer: customer
    });
  } catch (error) {
    console.error('Error creating customer with user:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to create customer with user', 500);
  }
};

// Add address for a specific customer
export const addAddressForCustomer = async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const addressData = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }
    
    // First, get the customer details to get the user_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .single();
    
    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return res.status(404).json({
        success: false, 
        message: 'Customer not found'
      });
    }
    
    if (!customer.user_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer has no associated user ID'
      });
    }
    
    // Prepare address data with the customer's user_id
    const newAddress = {
      ...addressData,
      user_id: customer.user_id
    };
    
    // Create the address record
    const { data: address, error: addressError } = await supabase
      .from('addresses')
      .insert([newAddress])
      .select('*')
      .single();
    
    if (addressError) {
      console.error('Error creating customer address:', addressError);
      return res.status(500).json({
        success: false,
        message: 'Failed to add address'
      });
    }
    
    // If this address is marked as default, update other addresses of the same type
    if (address.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', customer.user_id)
        .eq('address_type', address.address_type)
        .neq('id', address.id);
    }
    
    return res.status(201).json({
      success: true,
      data: address
    });
  } catch (error: any) {
    console.error('Error in addAddressForCustomer:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}; 