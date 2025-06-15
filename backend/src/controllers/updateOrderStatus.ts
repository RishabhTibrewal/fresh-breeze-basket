import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, tracking_number, estimated_delivery, notes } = req.body;
    const userId = req.user.id;
    
    // Check if user is admin or sales
    let isAdmin = false;
    let isSales = false;
    
    try {
      // Get user's role from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile) {
        isAdmin = profile.role === 'admin';
        isSales = profile.role === 'sales';
      }
    } catch (error) {
      console.error('Error during role check:', error);
    }
    
    // Fall back to middleware role check
    if (!isAdmin && !isSales) {
      isAdmin = req.user.role === 'admin';
      isSales = req.user.role === 'sales';
    }
    
    // Get the order to check permissions
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, user_id')
      .eq('id', id)
      .single();
      
    if (orderError) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check permissions - admins can update any order
    let hasAccess = isAdmin;
    
    // For sales, check if this is their customer's order
    if (!hasAccess && isSales) {
      const { data: customer } = await supabase
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', order.user_id)
        .single();
        
      if (customer && customer.sales_executive_id === userId) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to update this order' });
    }
    
    // Validate the order status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }
    
    // Update the order
    const updateData: any = { status };
    
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (estimated_delivery) updateData.estimated_delivery = estimated_delivery;
    if (notes) updateData.notes = notes;
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({ error: 'Failed to update order status' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      error: 'Failed to update order status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 