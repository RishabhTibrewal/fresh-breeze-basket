import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all users (admin only)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { page = '1', limit = '10', search } = req.query;
    
    // Parse page and limit to numbers
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId);
    
    // Add search filter if provided
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(`email.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);
    
    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false });
    
    const { data: users, error, count } = await query;
    
    if (error) {
      throw new ApiError(500, `Error fetching users: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          pages: count ? Math.ceil(count / limitNum) : 0
        }
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get dashboard statistics (admin only)
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Get total number of users (filtered by company_id)
    const { count: userCount, error: userError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId);
    
    if (userError) {
      throw new ApiError(500, `Error fetching user count: ${userError.message}`);
    }
    
    // Get total number of products (filtered by company_id)
    const { count: productCount, error: productError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId);
    
    if (productError) {
      throw new ApiError(500, `Error fetching product count: ${productError.message}`);
    }
    
    // Get number of products added in last week (filtered by company_id)
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    
    const { count: newProductsCount, error: newProductsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId)
      .gte('created_at', lastWeekDate.toISOString());
    
    if (newProductsError) {
      throw new ApiError(500, `Error fetching new products count: ${newProductsError.message}`);
    }
    
    // Get total number of orders (filtered by company_id)
    const { count: orderCount, error: orderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId);
    
    if (orderError) {
      throw new ApiError(500, `Error fetching order count: ${orderError.message}`);
    }
    
    // Get number of active orders (pending or processing) (filtered by company_id)
    const { count: activeOrderCount, error: activeOrderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId)
      .in('status', ['pending', 'processing']);
    
    if (activeOrderError) {
      throw new ApiError(500, `Error fetching active orders count: ${activeOrderError.message}`);
    }
    
    // Get total sales amount (filtered by company_id)
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('company_id', req.companyId);
    
    if (salesError) {
      throw new ApiError(500, `Error fetching sales data: ${salesError.message}`);
    }
    
    const totalSales = salesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Get sales from last month (filtered by company_id)
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    
    const { data: lastMonthSalesData, error: lastMonthSalesError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('company_id', req.companyId)
      .gte('created_at', lastMonthDate.toISOString());
    
    if (lastMonthSalesError) {
      throw new ApiError(500, `Error fetching last month sales data: ${lastMonthSalesError.message}`);
    }
    
    const lastMonthSales = lastMonthSalesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Get sales from two months ago for percentage calculation (filtered by company_id)
    const twoMonthsAgoDate = new Date();
    twoMonthsAgoDate.setMonth(twoMonthsAgoDate.getMonth() - 2);
    
    const { data: twoMonthsAgoSalesData, error: twoMonthsAgoSalesError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('company_id', req.companyId)
      .gte('created_at', twoMonthsAgoDate.toISOString())
      .lt('created_at', lastMonthDate.toISOString());
    
    if (twoMonthsAgoSalesError) {
      throw new ApiError(500, `Error fetching two months ago sales data: ${twoMonthsAgoSalesError.message}`);
    }
    
    const twoMonthsAgoSales = twoMonthsAgoSalesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Calculate percentage change
    let salesPercentChange = 0;
    if (twoMonthsAgoSales > 0) {
      salesPercentChange = ((lastMonthSales - twoMonthsAgoSales) / twoMonthsAgoSales) * 100;
    }
    
    // Get products with low inventory (stock <= 5) (filtered by company_id)
    const { data: lowInventoryProducts, error: lowInventoryError } = await supabase
      .from('products')
      .select('id, name, category_id, stock_count, categories(name)')
      .eq('company_id', req.companyId)
      .lte('stock_count', 5)
      .order('stock_count', { ascending: true })
      .limit(5);
    
    if (lowInventoryError) {
      throw new ApiError(500, `Error fetching low inventory products: ${lowInventoryError.message}`);
    }
    
    // Get recent orders (filtered by company_id)
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        status,
        total_amount,
        created_at
      `)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentOrdersError) {
      throw new ApiError(500, `Error fetching recent orders: ${recentOrdersError.message}`);
    }
    
    // Fetch profile data separately for each order (filtered by company_id)
    const enhancedOrders = [];
    for (const order of recentOrders || []) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', order.user_id)
        .eq('company_id', req.companyId)
        .single();
      
      enhancedOrders.push({
        ...order,
        profiles: profileData || null
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        user_stats: {
          total: userCount || 0
        },
        product_stats: {
          total: productCount || 0,
          new_this_week: newProductsCount || 0
        },
        order_stats: {
          total: orderCount || 0,
          active: activeOrderCount || 0
        },
        sales_stats: {
          total: totalSales,
          last_month: lastMonthSales,
          percent_change: salesPercentChange.toFixed(1)
        },
        low_inventory: lowInventoryProducts,
        recent_orders: enhancedOrders
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching dashboard statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 

// Update user role (admin only)
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !['user', 'admin', 'sales'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified. Must be one of: user, admin, sales'
      });
    }

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Prevent admin from removing their own admin role
    if (req.user.id === userId && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own admin role'
      });
    }

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }

    // Update profile role (filtered by company_id)
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ 
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({
        success: false,
        message: `Failed to update user role: ${error.message}`
      });
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Invalidate role cache so the new role is reflected immediately
    const { invalidateRoleCache } = await import('../middleware/auth');
    invalidateRoleCache(userId);

    return res.status(200).json({
      success: true,
      data: profile,
      message: `User role updated to ${role} successfully`
    });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while updating user role'
    });
  }
};

// Sales Targets Management

// Get all sales executives (admin only)
export const getSalesExecutives = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { data: salesExecutives, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role')
      .eq('role', 'sales')
      .eq('company_id', req.companyId)
      .order('first_name', { ascending: true });

    if (error) {
      throw new ApiError(500, `Error fetching sales executives: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      data: salesExecutives || []
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching sales executives: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get all sales targets (admin only)
export const getSalesTargets = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { sales_executive_id, period_type, is_active } = req.query;

    let query = supabase
      .from('sales_targets')
      .select('*')
      .eq('company_id', req.companyId)
      .order('period_start', { ascending: false });

    if (sales_executive_id) {
      query = query.eq('sales_executive_id', sales_executive_id as string);
    }

    if (period_type) {
      query = query.eq('period_type', period_type as string);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: targets, error } = await query;

    if (error) {
      throw new ApiError(500, `Error fetching sales targets: ${error.message}`);
    }

    // Fetch profile data and calculate progress for each sales executive
    const targetsWithProfiles = await Promise.all(
      (targets || []).map(async (target) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', target.sales_executive_id)
          .single();

        // Calculate achieved amount for this target period
        // Get all customers for this sales executive (filtered by company_id)
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('user_id')
          .eq('sales_executive_id', target.sales_executive_id)
          .eq('company_id', req.companyId);

        let achievedAmount = 0;
        let progressPercentage = 0;

        if (customersError) {
          console.error(`Error fetching customers for sales executive ${target.sales_executive_id}:`, customersError);
        }

        if (customers && customers.length > 0) {
          const customerUserIds = customers.map(c => c.user_id);
          
          // Get orders within the target period for these customers
          // period_start and period_end are DATE fields, so we need to ensure proper comparison
          const periodStart = `${target.period_start}T00:00:00.000Z`;
          const periodEnd = `${target.period_end}T23:59:59.999Z`;
          
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('total_amount, created_at, status')
            .in('user_id', customerUserIds)
            .eq('company_id', req.companyId)
            .gte('created_at', periodStart)
            .lte('created_at', periodEnd);

          if (ordersError) {
            console.error(`Error fetching orders for sales executive ${target.sales_executive_id}:`, ordersError);
          }

          // Filter out cancelled orders to match getSalesAnalytics behavior
          const filteredOrders = orders?.filter(order => order.status !== 'cancelled') || [];

          if (filteredOrders && filteredOrders.length > 0) {
            achievedAmount = filteredOrders.reduce((sum, order) => {
              const amount = parseFloat(order.total_amount?.toString() || '0') || 0;
              return sum + amount;
            }, 0);
          }
        }

        const targetAmount = parseFloat(target.target_amount?.toString() || '0');
        progressPercentage = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;

        return {
          ...target,
          sales_executive: profile || null,
          achieved_amount: achievedAmount,
          progress_percentage: Math.round(progressPercentage * 100) / 100,
          remaining_amount: Math.max(0, targetAmount - achievedAmount)
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: targetsWithProfiles
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching sales targets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get sales target by ID
export const getSalesTargetById = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { id } = req.params;

    const { data: target, error } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      throw new ApiError(404, `Sales target not found: ${error.message}`);
    }

    // Fetch profile data for the sales executive (filtered by company_id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', target.sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    const targetWithProfile = {
      ...target,
      sales_executive: profile || null
    };

    return res.status(200).json({
      success: true,
      data: targetWithProfile
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching sales target: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Create sales target (admin only)
export const createSalesTarget = async (req: Request, res: Response) => {
  try {
    const {
      sales_executive_id,
      target_amount,
      period_type,
      period_start,
      period_end,
      description
    } = req.body;

    // Validation
    if (!sales_executive_id || !target_amount || !period_type || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sales_executive_id, target_amount, period_type, period_start, period_end'
      });
    }

    if (parseFloat(target_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target amount must be greater than 0'
      });
    }

    if (!['monthly', 'quarterly', 'yearly'].includes(period_type)) {
      return res.status(400).json({
        success: false,
        message: 'Period type must be one of: monthly, quarterly, yearly'
      });
    }

    if (new Date(period_end) <= new Date(period_start)) {
      return res.status(400).json({
        success: false,
        message: 'Period end date must be after period start date'
      });
    }

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Verify sales executive exists and has sales role (filtered by company_id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: 'Sales executive not found'
      });
    }

    if (profile.role !== 'sales') {
      return res.status(400).json({
        success: false,
        message: 'User is not a sales executive'
      });
    }

    // Create target (with company_id)
    const { data: target, error } = await supabase
      .from('sales_targets')
      .insert({
        sales_executive_id,
        company_id: req.companyId,
        target_amount: parseFloat(target_amount),
        period_type,
        period_start,
        period_end,
        description: description || null,
        created_by: req.user?.id,
        is_active: true
      })
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Error creating sales target: ${error.message}`);
    }

    // Fetch profile data for the sales executive (filtered by company_id)
    const { data: salesExecutiveProfile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    const targetWithProfile = {
      ...target,
      sales_executive: salesExecutiveProfile || null
    };

    return res.status(201).json({
      success: true,
      data: targetWithProfile,
      message: 'Sales target created successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while creating sales target'
    });
  }
};

// Update sales target (admin only)
export const updateSalesTarget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      target_amount,
      period_type,
      period_start,
      period_end,
      description,
      is_active
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Check if target exists (filtered by company_id)
    const { data: existingTarget, error: fetchError } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError || !existingTarget) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (target_amount !== undefined) {
      if (parseFloat(target_amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Target amount must be greater than 0'
        });
      }
      updateData.target_amount = parseFloat(target_amount);
    }

    if (period_type !== undefined) {
      if (!['monthly', 'quarterly', 'yearly'].includes(period_type)) {
        return res.status(400).json({
          success: false,
          message: 'Period type must be one of: monthly, quarterly, yearly'
        });
      }
      updateData.period_type = period_type;
    }

    if (period_start !== undefined) {
      updateData.period_start = period_start;
    }

    if (period_end !== undefined) {
      updateData.period_end = period_end;
    }

    if (period_start !== undefined && period_end !== undefined) {
      if (new Date(period_end) <= new Date(period_start)) {
        return res.status(400).json({
          success: false,
          message: 'Period end date must be after period start date'
        });
      }
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    // Update target (filtered by company_id)
    const { data: target, error } = await supabase
      .from('sales_targets')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Error updating sales target: ${error.message}`);
    }

    // Fetch profile data for the sales executive (filtered by company_id)
    const { data: salesExecutiveProfile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', target.sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    const targetWithProfile = {
      ...target,
      sales_executive: salesExecutiveProfile || null
    };

    return res.status(200).json({
      success: true,
      data: targetWithProfile,
      message: 'Sales target updated successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while updating sales target'
    });
  }
};

// Delete sales target (admin only)
export const deleteSalesTarget = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { id } = req.params;

    const { error } = await supabase
      .from('sales_targets')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) {
      throw new ApiError(500, `Error deleting sales target: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Sales target deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while deleting sales target'
    });
  }
};

// Get current active target for a sales executive
export const getCurrentSalesTarget = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const sales_executive_id = req.user?.id;
    const today = new Date().toISOString().split('T')[0];

    const { data: target, error } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .lte('period_start', today)
      .gte('period_end', today)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new ApiError(500, `Error fetching current target: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      data: target || null
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while fetching current target'
    });
  }
};

// Get all leads (admin only) - not filtered by sales executive
export const getAllLeads = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { stage, priority, source, search, sales_executive_id } = req.query;

    // First get all leads (filtered by company_id)
    let query = supabase
      .from('leads')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (stage && typeof stage === 'string') {
      query = query.eq('stage', stage);
    }

    if (priority && typeof priority === 'string') {
      query = query.eq('priority', priority);
    }

    if (source && typeof source === 'string') {
      query = query.eq('source', source);
    }

    if (sales_executive_id && typeof sales_executive_id === 'string') {
      query = query.eq('sales_executive_id', sales_executive_id);
    }

    // Search functionality
    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      query = query.or(`company_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},contact_email.ilike.${searchTerm},title.ilike.${searchTerm}`);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw new ApiError(500, `Error fetching leads: ${error.message}`);
    }

    // Fetch sales executive profiles for each lead
    const leadsWithProfiles = await Promise.all(
      (leads || []).map(async (lead) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', lead.sales_executive_id)
          .eq('company_id', req.companyId)
          .single();

        return {
          ...lead,
          sales_executive: profile || null
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: leadsWithProfiles
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get lead by ID (admin only)
export const getLeadByIdAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { id } = req.params;

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Lead not found');
      }
      throw new ApiError(500, `Error fetching lead: ${error.message}`);
    }

    // Fetch sales executive profile (filtered by company_id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', lead.sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    const leadWithProfile = {
      ...lead,
      sales_executive: profile || null
    };

    return res.status(200).json({
      success: true,
      data: leadWithProfile
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error fetching lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Update lead (admin only)
export const updateLeadAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Get existing lead to preserve notes if appending (filtered by company_id)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('notes, stage, converted_at, lost_at')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (!existingLead) {
      throw new ApiError(404, 'Lead not found');
    }

    // Handle note appending
    if (updateData.append_note && existingLead.notes) {
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      updateData.notes = `${existingLead.notes}\n[${timestamp}] ${updateData.append_note}`;
      delete updateData.append_note;
    } else if (updateData.append_note) {
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      updateData.notes = `[${timestamp}] ${updateData.append_note}`;
      delete updateData.append_note;
    }

    // Handle stage changes
    if (updateData.stage === 'won' && !existingLead.converted_at) {
      updateData.converted_at = new Date().toISOString();
    }
    if (updateData.stage === 'lost' && !existingLead.lost_at) {
      updateData.lost_at = new Date().toISOString();
    }

    const { data: updatedLead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Error updating lead: ${error.message}`);
    }

    // Fetch sales executive profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', updatedLead.sales_executive_id)
      .single();

    const leadWithProfile = {
      ...updatedLead,
      sales_executive: profile || null
    };

    return res.status(200).json({
      success: true,
      data: leadWithProfile
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error updating lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Create lead (admin only) - allows assigning to any sales executive
export const createLeadAdmin = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    const {
      sales_executive_id,
      company_name,
      contact_name,
      contact_email,
      contact_phone,
      contact_position,
      title,
      description,
      source,
      estimated_value,
      currency,
      stage,
      priority,
      address,
      city,
      state,
      country,
      postal_code,
      website,
      notes,
      expected_close_date,
      last_follow_up,
      next_follow_up
    } = req.body;

    // Validate required fields
    if (!contact_name || !title) {
      throw new ApiError(400, 'Contact name and title are required');
    }

    if (!sales_executive_id) {
      throw new ApiError(400, 'Sales executive ID is required');
    }

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Validate that sales_executive_id exists and is a sales role (filtered by company_id)
    const { data: salesExecutive, error: salesError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (salesError || !salesExecutive) {
      throw new ApiError(404, 'Sales executive not found');
    }

    if (salesExecutive.role !== 'sales') {
      throw new ApiError(400, 'Assigned user must have sales role');
    }

    // Validate stage, priority, source (using same constants as leadsController)
    const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const LEAD_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const LEAD_SOURCES = ['website', 'referral', 'cold_call', 'email', 'social_media', 'trade_show', 'other'];

    if (stage && !LEAD_STAGES.includes(stage)) {
      throw new ApiError(400, `Invalid stage. Must be one of: ${LEAD_STAGES.join(', ')}`);
    }

    if (priority && !LEAD_PRIORITIES.includes(priority)) {
      throw new ApiError(400, `Invalid priority. Must be one of: ${LEAD_PRIORITIES.join(', ')}`);
    }

    if (source && !LEAD_SOURCES.includes(source)) {
      throw new ApiError(400, `Invalid source. Must be one of: ${LEAD_SOURCES.join(', ')}`);
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        sales_executive_id,
        company_id: req.companyId,
        company_name: company_name || null,
        contact_name,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        contact_position: contact_position || null,
        title,
        description: description || null,
        source: source || 'other',
        estimated_value: estimated_value ? parseFloat(estimated_value) : 0,
        currency: currency || 'USD',
        stage: stage || 'new',
        priority: priority || 'medium',
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        postal_code: postal_code || null,
        website: website || null,
        notes: notes || null,
        expected_close_date: expected_close_date || null,
        last_follow_up: last_follow_up || null,
        next_follow_up: next_follow_up || null,
        created_by: adminId
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Error creating lead: ${error.message}`);
    }

    // Fetch sales executive profile for response (filtered by company_id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    return res.status(201).json({
      success: true,
      data: {
        ...lead,
        sales_executive: profile || null
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error creating lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Delete lead (admin only)
export const deleteLeadAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { id } = req.params;

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (error) {
      throw new ApiError(500, `Error deleting lead: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error deleting lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 