import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { hasAnyRole } from '../utils/roles';
import { ApiError } from '../middleware/error';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role?: string;
    roles?: string[];
    company_id?: string;
  };
  companyId?: string;
}

export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const { id } = req.params;
    const { status, tracking_number, estimated_delivery, notes } = req.body;
    const userId = req.user.id;

    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }
    
    // Check roles using new role system
    const isAdmin = await hasAnyRole(req.user.id, req.companyId, ['admin']);
    const isSales = await hasAnyRole(req.user.id, req.companyId, ['sales']);
    
    // Get the order to check permissions
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, user_id')
      .eq('id', id)
      .eq('company_id', req.companyId)
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
        .eq('company_id', req.companyId)
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
      .eq('company_id', req.companyId)
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