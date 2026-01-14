import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
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
  user_id: string;
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
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Build query - filter by sales_executive_id if user is a sales executive
    let query = supabase
      .from('customers')
      .select('*');

    // If user is a sales executive, only show their customers
    if (userRole === 'sales' && userId) {
      query = query.eq('sales_executive_id', userId);
    }
    // Admins can see all customers (no filter)

    const { data: customers, error } = await query;

    if (error) throw error;

    // Get all orders to calculate statistics
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, created_at, status');
    
    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw new AppError('Failed to fetch orders data', 500);
    }

    // Transform the data to include customer information with order statistics
    const transformedCustomers = (customers as Customer[]).map(customer => {
      // Filter orders for this customer, EXCLUDING cancelled orders
      const customerOrders = allOrders ? allOrders.filter(order => 
        order.user_id === customer.user_id && order.status !== 'cancelled'
      ) : [];
      
      // Calculate order metrics
      const totalOrders = customerOrders.length;
      const totalSpent = customerOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
      
      // Find the last order date
      let lastOrder = null;
      if (customerOrders.length > 0) {
        const orderDates = customerOrders.map(order => new Date(order.created_at).getTime());
        const lastOrderDate = new Date(Math.max(...orderDates));
        lastOrder = lastOrderDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        trn_number: customer.trn_number,
        credit_period_days: customer.credit_period_days,
        credit_limit: customer.credit_limit,
        current_credit: customer.current_credit,
        totalOrders,
        totalSpent,
        lastOrder: lastOrder || customer.last_order_date || null,
      };
    });

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
      .select('id, total_amount, status')
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
    const filteredOrders = orders?.filter(order => order.status !== 'cancelled') || [];
    const totalOrders = filteredOrders.length;
    const totalSpent = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

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

// Get customer by user_id (for admin to view customer details from user profile)
export const getCustomerByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // First, get the profile information (this should always exist)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Then, try to get the customer details by user_id (may not exist)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If customer doesn't exist, this is a retail customer (profile only, no customer record)
    // Retail customers can still have orders, so fetch them
    if (customerError || !customer) {
      // PGRST116 is the "not found" error code - this is expected for retail customers
      if (customerError && customerError.code !== 'PGRST116') {
        console.error('Error fetching customer (unexpected):', customerError);
      } else {
        console.log(`Retail customer (profile only) - user ${userId}, fetching orders...`);
      }
      
      // For retail customers, fetch their orders using user_id
      const { data: retailOrders, error: retailOrdersError } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, payment_status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (retailOrdersError) {
        console.error('Error fetching retail customer orders:', retailOrdersError);
      }
      
      // Calculate order metrics for retail customer
      const filteredRetailOrders = retailOrders?.filter(order => order.status !== 'cancelled') || [];
      const retailTotalOrders = filteredRetailOrders.length;
      const retailTotalSpent = filteredRetailOrders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0) || 0;
      
      // Get last order date
      let lastRetailOrder = null;
      if (filteredRetailOrders.length > 0) {
        const orderDates = filteredRetailOrders.map(order => new Date(order.created_at).getTime());
        const lastOrderDate = new Date(Math.max(...orderDates));
        lastRetailOrder = lastOrderDate.toISOString().split('T')[0];
      }
      
      // Return profile data with order information for retail customers
      return res.json({
        id: null,
        user_id: userId,
        name: profile.first_name || profile.last_name 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
          : profile.email || 'Unknown',
        email: profile.email,
        phone: profile.phone || null,
        trn_number: null,
        totalOrders: retailTotalOrders,
        totalSpent: retailTotalSpent,
        lastOrder: lastRetailOrder,
        credit_limit: 0,
        current_credit: 0,
        credit_period_days: 0,
        credit_periods: [],
        orders: filteredRetailOrders || [], // Include orders for retail customers
        profile: profile,
        sales_executive_id: null,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        isCustomerRecord: false // Flag to indicate retail customer (no customer record)
      });
    }

    // Get order information (using user_id from customer)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount, status, created_at, payment_status')
      .eq('user_id', customer.user_id);
    
    if (ordersError) {
      console.error('Error fetching customer orders:', ordersError);
    }

    // Get credit periods information (complete ledger)
    const { data: creditPeriods, error: creditError } = await supabase
      .from('credit_periods')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (creditError) {
      console.error('Error fetching credit periods:', creditError);
    }

    // Calculate order metrics
    const filteredOrders = orders?.filter(order => order.status !== 'cancelled') || [];
    const totalOrders = filteredOrders.length;
    const totalSpent = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0) || 0;
    
    // Get last order date from orders if available
    let lastOrderDate = customer.last_order_date || null;
    if (filteredOrders.length > 0 && !lastOrderDate) {
      const orderDates = filteredOrders.map(order => new Date(order.created_at).getTime());
      const lastOrder = new Date(Math.max(...orderDates));
      lastOrderDate = lastOrder.toISOString().split('T')[0];
    }

    const transformedCustomer = {
      id: customer.id,
      user_id: customer.user_id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      trn_number: customer.trn_number,
      totalOrders,
      totalSpent,
      lastOrder: lastOrderDate,
      credit_limit: customer.credit_limit,
      current_credit: customer.current_credit,
      credit_period_days: customer.credit_period_days,
      credit_periods: creditPeriods || [],
      orders: filteredOrders || [], // Include orders for wholesale customers too
      profile: profile || null,
      sales_executive_id: customer.sales_executive_id,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
      isCustomerRecord: true // Flag to indicate wholesale customer (has customer record)
    };

    res.json(transformedCustomer);
  } catch (error) {
    console.error('Error fetching customer by user_id:', error);
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

    // Verify the customer belongs to this sales executive and load credit info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, credit_limit, current_credit')
      .eq('id', customer_id)
      .eq('sales_executive_id', sales_executive_id)
      .single();

    if (customerError || !customer) {
      throw customerError || new Error('Customer not found');
    }

    const creditLimit = parseFloat(customer.credit_limit?.toString() || '0');
    const currentCredit = parseFloat(customer.current_credit?.toString() || '0');
    const creditToAdd = parseFloat(amount?.toString() || '0');
    const projectedCredit = currentCredit + creditToAdd;

    // Enforce credit limit before creating credit period
    if (creditLimit > 0 && projectedCredit > creditLimit) {
      return res.status(400).json({
        error: 'Credit limit exceeded for this customer',
        details: {
          creditLimit,
          currentCredit,
          creditToAdd,
          projectedCredit,
        },
      });
    }

    // Add credit period
    const { data: creditPeriod, error: creditError } = await supabase
      .from('credit_periods')
      .insert({
        customer_id,
        amount: creditToAdd,
        period,
        start_date,
        end_date,
        type: 'credit',
        description,
      })
      .select()
      .single();

    if (creditError) throw creditError;

    // Update customer's current credit (increment, don't reset)
    const newCurrentCredit = projectedCredit;
    const { error: updateError } = await supabase
      .from('customers')
      .update({ current_credit: newCurrentCredit })
      .eq('id', customer_id);

    if (updateError) throw updateError;

    res.status(201).json(creditPeriod);
  } catch (error: any) {
    console.error('Error adding credit period:', error);
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
    
    // Use Supabase Auth Admin API to create user (proper way instead of RPC)
    if (!supabaseAdmin) {
      throw new AppError('Service role key not configured. Cannot create users.', 500);
    }

    console.log('Creating user with Supabase Auth Admin API...');
    
    let userId: string;
    
    // Try to create new user with Supabase Auth Admin API
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so user can login immediately
      user_metadata: {
        name,
        phone
      }
    });

    if (createUserError) {
      // If user already exists, get the existing user
      if (createUserError.message?.includes('already exists') || createUserError.message?.includes('User already registered')) {
        console.log('User already exists, fetching existing user...');
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(u => u.email === email);
        
        if (!existingUser) {
          throw new AppError('User exists but could not be retrieved', 500);
        }
        
        userId = existingUser.id;
        console.log('Using existing user with ID:', userId);
      } else {
        console.error('Error creating user:', createUserError);
        throw new AppError(`Failed to create user: ${createUserError.message}`, 500);
      }
    } else {
      if (!newUser.user) {
        throw new AppError('Failed to create user: No user data returned', 500);
      }

      userId = newUser.user.id;
      console.log('User created successfully with ID:', userId);
    }

    // Create or update profile
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileCheckError);
    }

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          role: 'user'
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Continue anyway as profile might have been created by trigger
      }
    }

    // Create or update customer
    const { data: existingCustomer, error: customerCheckError } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    let customer;
    
    if (existingCustomer) {
      // Update existing customer
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          name,
          email,
          phone,
          trn_number,
          credit_period_days: credit_period_days || 0,
          credit_limit: credit_limit || 0,
          current_credit: current_credit || 0,
          sales_executive_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating customer:', updateError);
        throw new AppError(`Failed to update customer: ${updateError.message}`, 500);
      }

      customer = updatedCustomer;
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name,
          email,
          phone,
          trn_number,
          credit_period_days: credit_period_days || 0,
          credit_limit: credit_limit || 0,
          current_credit: current_credit || 0,
          sales_executive_id,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        throw new AppError(`Failed to create customer: ${customerError.message}`, 500);
      }

      customer = newCustomer;
    }

    console.log('Customer with user created successfully:', customer);
    
    // Return structured response with user and customer data
    res.status(201).json({
      user: {
        id: userId,
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

// Get all customers with credit information
export const getCustomersWithCredit = async (req: Request, res: Response) => {
  try {
    const sales_executive_id = req.user?.id;

    // Get all customers with their credit information
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        email,
        phone,
        credit_limit,
        current_credit,
        credit_period_days
      `)
      .eq('sales_executive_id', sales_executive_id)
      .order('name');

    if (error) {
      throw new AppError(`Error fetching customers: ${error.message}`, 500);
    }

    // For each customer, calculate overdue credit
    const transformedCustomers = await Promise.all(
      customers.map(async (customer) => {
        // Get all credit periods for this customer
        const { data: creditPeriods, error: creditError } = await supabase
          .from('credit_periods')
          .select('amount, end_date, start_date, period')
          .eq('customer_id', customer.id)
          .order('end_date', { ascending: false });

        if (creditError) {
          console.error(`Error fetching credit periods for customer ${customer.id}:`, creditError);
        }

        // Calculate overdue credit: credit periods where end_date has passed AND amount > 0
        const now = new Date();
        let overdueAmount = 0;
        let latestOverduePeriod = null;

        if (creditPeriods && creditPeriods.length > 0) {
          for (const period of creditPeriods) {
            const endDate = new Date(period.end_date);
            const amount = parseFloat(period.amount.toString());
            
            // Check if this period is overdue (end_date passed and amount > 0)
            if (endDate < now && amount > 0) {
              overdueAmount += amount;
              // Keep track of the most recent overdue period for display
              if (!latestOverduePeriod || endDate > new Date(latestOverduePeriod.end_date)) {
                latestOverduePeriod = {
                  amount: amount,
                  period: period.period,
                  start_date: period.start_date,
                  end_date: period.end_date
                };
              }
            }
          }
        }

        return {
      ...customer,
          overdue_credit: overdueAmount > 0 ? {
            amount: overdueAmount,
            period: latestOverduePeriod?.period || 0,
            start_date: latestOverduePeriod?.start_date || null,
            end_date: latestOverduePeriod?.end_date || null
          } : null
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: transformedCustomers
    });
  } catch (error) {
    console.error('Error in getCustomersWithCredit:', error);
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