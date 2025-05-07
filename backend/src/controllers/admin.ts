import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Get all users (admin only)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '10', search } = req.query;
    
    // Parse page and limit to numbers
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });
    
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
    // Get total number of users
    const { count: userCount, error: userError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (userError) {
      throw new ApiError(500, `Error fetching user count: ${userError.message}`);
    }
    
    // Get total number of products
    const { count: productCount, error: productError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    if (productError) {
      throw new ApiError(500, `Error fetching product count: ${productError.message}`);
    }
    
    // Get number of products added in last week
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    
    const { count: newProductsCount, error: newProductsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastWeekDate.toISOString());
    
    if (newProductsError) {
      throw new ApiError(500, `Error fetching new products count: ${newProductsError.message}`);
    }
    
    // Get total number of orders
    const { count: orderCount, error: orderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (orderError) {
      throw new ApiError(500, `Error fetching order count: ${orderError.message}`);
    }
    
    // Get number of active orders (pending or processing)
    const { count: activeOrderCount, error: activeOrderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);
    
    if (activeOrderError) {
      throw new ApiError(500, `Error fetching active orders count: ${activeOrderError.message}`);
    }
    
    // Get total sales amount
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total_amount');
    
    if (salesError) {
      throw new ApiError(500, `Error fetching sales data: ${salesError.message}`);
    }
    
    const totalSales = salesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Get sales from last month
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    
    const { data: lastMonthSalesData, error: lastMonthSalesError } = await supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', lastMonthDate.toISOString());
    
    if (lastMonthSalesError) {
      throw new ApiError(500, `Error fetching last month sales data: ${lastMonthSalesError.message}`);
    }
    
    const lastMonthSales = lastMonthSalesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    // Get sales from two months ago for percentage calculation
    const twoMonthsAgoDate = new Date();
    twoMonthsAgoDate.setMonth(twoMonthsAgoDate.getMonth() - 2);
    
    const { data: twoMonthsAgoSalesData, error: twoMonthsAgoSalesError } = await supabase
      .from('orders')
      .select('total_amount')
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
    
    // Get products with low inventory (stock <= 5)
    const { data: lowInventoryProducts, error: lowInventoryError } = await supabase
      .from('products')
      .select('id, name, category_id, stock_count, categories(name)')
      .lte('stock_count', 5)
      .order('stock_count', { ascending: true })
      .limit(5);
    
    if (lowInventoryError) {
      throw new ApiError(500, `Error fetching low inventory products: ${lowInventoryError.message}`);
    }
    
    // Get recent orders
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        status,
        total_amount,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentOrdersError) {
      throw new ApiError(500, `Error fetching recent orders: ${recentOrdersError.message}`);
    }
    
    // Fetch profile data separately for each order
    const enhancedOrders = [];
    for (const order of recentOrders || []) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', order.user_id)
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