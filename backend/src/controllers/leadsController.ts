import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { AppError } from '../utils/appError';

// Lead stages enum
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type LeadStage = typeof LEAD_STAGES[number];

// Lead priority enum
export const LEAD_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type LeadPriority = typeof LEAD_PRIORITIES[number];

// Lead source enum
export const LEAD_SOURCES = ['website', 'referral', 'cold_call', 'email', 'social_media', 'trade_show', 'other'] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

// Get all leads for the sales executive
export const getLeads = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const sales_executive_id = req.user?.id;
    const { stage, priority, source, search } = req.query;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    let query = supabase
      .from('leads')
      .select('*')
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (stage && typeof stage === 'string' && LEAD_STAGES.includes(stage as LeadStage)) {
      query = query.eq('stage', stage);
    }

    if (priority && typeof priority === 'string' && LEAD_PRIORITIES.includes(priority as LeadPriority)) {
      query = query.eq('priority', priority);
    }

    if (source && typeof source === 'string' && LEAD_SOURCES.includes(source as LeadSource)) {
      query = query.eq('source', source);
    }

    // Search functionality
    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      query = query.or(`company_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},contact_email.ilike.${searchTerm},title.ilike.${searchTerm}`);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw new AppError(`Error fetching leads: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: leads || []
    });
  } catch (error) {
    console.error('Error in getLeads:', error);
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

// Get a single lead by ID
export const getLeadById = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Lead not found', 404);
      }
      throw new AppError(`Error fetching lead: ${error.message}`, 500);
    }

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error in getLeadById:', error);
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

// Create a new lead
export const createLead = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    const {
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
      throw new AppError('Contact name and title are required', 400);
    }

    // Validate stage
    if (stage && !LEAD_STAGES.includes(stage)) {
      throw new AppError(`Invalid stage. Must be one of: ${LEAD_STAGES.join(', ')}`, 400);
    }

    // Validate priority
    if (priority && !LEAD_PRIORITIES.includes(priority)) {
      throw new AppError(`Invalid priority. Must be one of: ${LEAD_PRIORITIES.join(', ')}`, 400);
    }

    // Validate source
    if (source && !LEAD_SOURCES.includes(source)) {
      throw new AppError(`Invalid source. Must be one of: ${LEAD_SOURCES.join(', ')}`, 400);
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
        created_by: sales_executive_id
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error creating lead: ${error.message}`, 500);
    }

    return res.status(201).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error in createLead:', error);
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

// Update a lead
export const updateLead = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    const {
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
      next_follow_up,
      lost_reason,
      append_note
    } = req.body;

    // Check if lead exists and belongs to the sales executive (filtered by company_id)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, sales_executive_id, converted_at, lost_at')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (checkError || !existingLead) {
      throw new AppError('Lead not found or access denied', 404);
    }

    // Validate stage if provided
    if (stage && !LEAD_STAGES.includes(stage)) {
      throw new AppError(`Invalid stage. Must be one of: ${LEAD_STAGES.join(', ')}`, 400);
    }

    // Validate priority if provided
    if (priority && !LEAD_PRIORITIES.includes(priority)) {
      throw new AppError(`Invalid priority. Must be one of: ${LEAD_PRIORITIES.join(', ')}`, 400);
    }

    // Validate source if provided
    if (source && !LEAD_SOURCES.includes(source)) {
      throw new AppError(`Invalid source. Must be one of: ${LEAD_SOURCES.join(', ')}`, 400);
    }

    // Prepare update data
    const updateData: any = {};

    if (company_name !== undefined) updateData.company_name = company_name;
    if (contact_name !== undefined) updateData.contact_name = contact_name;
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (contact_position !== undefined) updateData.contact_position = contact_position;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (source !== undefined) updateData.source = source;
    if (estimated_value !== undefined) updateData.estimated_value = parseFloat(estimated_value);
    if (currency !== undefined) updateData.currency = currency;
    if (stage !== undefined) {
      updateData.stage = stage;
      // Set converted_at if won
      if (stage === 'won' && !existingLead.converted_at) {
        updateData.converted_at = new Date().toISOString();
      }
      // Set lost_at if lost
      if (stage === 'lost' && !existingLead.lost_at) {
        updateData.lost_at = new Date().toISOString();
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (website !== undefined) updateData.website = website;
    if (notes !== undefined) updateData.notes = notes;
    if (expected_close_date !== undefined) updateData.expected_close_date = expected_close_date;
    if (last_follow_up !== undefined) updateData.last_follow_up = last_follow_up;
    if (next_follow_up !== undefined) updateData.next_follow_up = next_follow_up;
    if (lost_reason !== undefined) updateData.lost_reason = lost_reason;
    
    // Handle note appending (not overwriting)
    if (append_note && typeof append_note === 'string' && append_note.trim()) {
      // Get current notes
      const { data: currentLead, error: currentError } = await supabase
        .from('leads')
        .select('notes')
        .eq('id', id)
        .eq('company_id', req.companyId)
        .single();
      
      if (!currentError && currentLead) {
        const timestamp = new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const newNote = `[${timestamp}] ${append_note.trim()}`;
        const existingNotes = currentLead.notes || '';
        updateData.notes = existingNotes 
          ? `${existingNotes}\n${newNote}`
          : newNote;
      }
    } else if (notes !== undefined) {
      // Regular notes update (overwrite)
      updateData.notes = notes;
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .select()
      .single();

    if (error) {
      throw new AppError(`Error updating lead: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error in updateLead:', error);
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

// Delete a lead
export const deleteLead = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    // Check if lead exists and belongs to the sales executive (filtered by company_id)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, sales_executive_id')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (checkError || !existingLead) {
      throw new AppError('Lead not found or access denied', 404);
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId);

    if (error) {
      throw new AppError(`Error deleting lead: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteLead:', error);
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

// Quick action: Log call (updates last_follow_up and appends note)
export const logCall = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;
    const { note } = req.body;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    // Check if lead exists and belongs to the sales executive (filtered by company_id)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, sales_executive_id, notes')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (checkError || !existingLead) {
      throw new AppError('Lead not found or access denied', 404);
    }

    // Prepare update data
    const updateData: any = {
      last_follow_up: new Date().toISOString()
    };

    // Append note if provided
    if (note && typeof note === 'string' && note.trim()) {
      const timestamp = new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const newNote = `[${timestamp}] ${note.trim()}`;
      const existingNotes = existingLead.notes || '';
      updateData.notes = existingNotes 
        ? `${existingNotes}\n${newNote}`
        : newNote;
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Error logging call: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error in logCall:', error);
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

// Quick action: Reschedule (updates next_follow_up)
export const rescheduleFollowUp = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;
    const { next_follow_up } = req.body;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    if (!next_follow_up) {
      throw new AppError('next_follow_up is required', 400);
    }

    // Check if lead exists and belongs to the sales executive (filtered by company_id)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, sales_executive_id')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (checkError || !existingLead) {
      throw new AppError('Lead not found or access denied', 404);
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update({ next_follow_up })
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Error rescheduling follow-up: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error in rescheduleFollowUp:', error);
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

// Quick action: Mark as Won (converts lead to won stage)
export const markAsWon = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    // Check if lead exists and belongs to the sales executive (filtered by company_id)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, sales_executive_id, converted_at')
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .single();

    if (checkError || !existingLead) {
      throw new AppError('Lead not found or access denied', 404);
    }

    const updateData: any = {
      stage: 'won'
    };

    // Set converted_at if not already set
    if (!existingLead.converted_at) {
      updateData.converted_at = new Date().toISOString();
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Error marking lead as won: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: lead,
      message: 'Lead marked as won successfully'
    });
  } catch (error) {
    console.error('Error in markAsWon:', error);
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

// Get lead statistics for dashboard
export const getLeadStats = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('stage, priority, estimated_value')
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId);

    if (error) {
      throw new AppError(`Error fetching lead stats: ${error.message}`, 500);
    }

    // Calculate statistics
    const stats = {
      total: leads?.length || 0,
      byStage: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      totalValue: 0,
      wonValue: 0,
      lostValue: 0
    };

    leads?.forEach(lead => {
      // Count by stage
      stats.byStage[lead.stage] = (stats.byStage[lead.stage] || 0) + 1;

      // Count by priority
      stats.byPriority[lead.priority] = (stats.byPriority[lead.priority] || 0) + 1;

      // Calculate values
      const value = parseFloat(lead.estimated_value?.toString() || '0');
      stats.totalValue += value;

      if (lead.stage === 'won') {
        stats.wonValue += value;
      } else if (lead.stage === 'lost') {
        stats.lostValue += value;
      }
    });

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in getLeadStats:', error);
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

// Get Smart Follow-Up Reminder: leads where next_follow_up is today or overdue
export const getFollowUpReminders = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const sales_executive_id = req.user?.id;

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    // Get current date at start of day (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .not('stage', 'eq', 'won')
      .not('stage', 'eq', 'lost')
      .not('next_follow_up', 'is', null)
      .lte('next_follow_up', todayISO)
      .order('next_follow_up', { ascending: true });

    if (error) {
      throw new AppError(`Error fetching follow-up reminders: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: leads || []
    });
  } catch (error) {
    console.error('Error in getFollowUpReminders:', error);
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

// Get Lead Aging Alert: leads that have been in the same stage for too long
export const getAgingLeads = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const sales_executive_id = req.user?.id;
    const { days = 7 } = req.query; // Default to 7 days

    if (!sales_executive_id) {
      throw new AppError('Sales executive ID is required', 400);
    }

    const daysThreshold = parseInt(days as string, 10);
    if (isNaN(daysThreshold) || daysThreshold < 1) {
      throw new AppError('Invalid days parameter', 400);
    }

    // Calculate the threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    thresholdDate.setHours(0, 0, 0, 0);
    const thresholdISO = thresholdDate.toISOString();

    // Get all leads that haven't been updated in the last X days and are not won/lost
    // Note: This uses updated_at as a proxy for when the stage was last changed.
    // For more accuracy, consider adding a stage_updated_at field.
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('sales_executive_id', sales_executive_id)
      .eq('company_id', req.companyId)
      .not('stage', 'eq', 'won')
      .not('stage', 'eq', 'lost')
      .lte('updated_at', thresholdISO)
      .order('updated_at', { ascending: true });

    if (error) {
      throw new AppError(`Error fetching aging leads: ${error.message}`, 500);
    }

    // Calculate days since last update for each lead
    const now = new Date();
    const agingLeads = leads?.map(lead => {
      const lastUpdate = new Date(lead.updated_at);
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...lead,
        days_in_stage: daysSinceUpdate
      };
    }) || [];

    return res.status(200).json({
      success: true,
      data: agingLeads
    });
  } catch (error) {
    console.error('Error in getAgingLeads:', error);
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
