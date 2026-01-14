import apiClient from '@/lib/apiClient';

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadSource = 'website' | 'referral' | 'cold_call' | 'email' | 'social_media' | 'trade_show' | 'other';

export interface Lead {
  id: string;
  sales_executive_id: string;
  company_name?: string | null;
  contact_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_position?: string | null;
  title: string;
  description?: string | null;
  source: LeadSource;
  estimated_value: number;
  currency: string;
  stage: LeadStage;
  priority: LeadPriority;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  website?: string | null;
  notes?: string | null;
  expected_close_date?: string | null;
  last_follow_up?: string | null;
  next_follow_up?: string | null;
  converted_at?: string | null;
  lost_at?: string | null;
  lost_reason?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateLeadInput {
  company_name?: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_position?: string;
  title: string;
  description?: string;
  source?: LeadSource;
  estimated_value?: number;
  currency?: string;
  stage?: LeadStage;
  priority?: LeadPriority;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  notes?: string;
  expected_close_date?: string;
  last_follow_up?: string;
  next_follow_up?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {
  lost_reason?: string;
  append_note?: string; // For appending notes instead of overwriting
}

export interface LeadStats {
  total: number;
  byStage: Record<LeadStage, number>;
  byPriority: Record<LeadPriority, number>;
  totalValue: number;
  wonValue: number;
  lostValue: number;
}

export interface GetLeadsParams {
  stage?: LeadStage;
  priority?: LeadPriority;
  source?: LeadSource;
  search?: string;
}

export const leadsService = {
  // Get all leads with optional filters
  async getLeads(params?: GetLeadsParams): Promise<Lead[]> {
    const response = await apiClient.get('/leads', { params });
    return response.data.data;
  },

  // Get a single lead by ID
  async getLeadById(id: string): Promise<Lead> {
    const response = await apiClient.get(`/leads/${id}`);
    return response.data.data;
  },

  // Create a new lead
  async createLead(data: CreateLeadInput): Promise<Lead> {
    const response = await apiClient.post('/leads', data);
    return response.data.data;
  },

  // Update a lead
  async updateLead(id: string, data: UpdateLeadInput): Promise<Lead> {
    const response = await apiClient.put(`/leads/${id}`, data);
    return response.data.data;
  },

  // Delete a lead
  async deleteLead(id: string): Promise<void> {
    await apiClient.delete(`/leads/${id}`);
  },

  // Get lead statistics
  async getLeadStats(): Promise<LeadStats> {
    const response = await apiClient.get('/leads/stats');
    return response.data.data;
  },

  // Quick actions
  async logCall(id: string, note?: string): Promise<Lead> {
    const response = await apiClient.post(`/leads/${id}/log-call`, { note });
    return response.data.data;
  },

  async rescheduleFollowUp(id: string, next_follow_up: string): Promise<Lead> {
    const response = await apiClient.post(`/leads/${id}/reschedule`, { next_follow_up });
    return response.data.data;
  },

  async markAsWon(id: string): Promise<Lead> {
    const response = await apiClient.post(`/leads/${id}/mark-won`);
    return response.data.data;
  },

  // Alerts and reminders
  async getFollowUpReminders(): Promise<Lead[]> {
    const response = await apiClient.get('/leads/reminders/follow-up');
    return response.data.data;
  },

  async getAgingLeads(days?: number): Promise<Array<Lead & { days_in_stage: number }>> {
    const params = days ? { days } : {};
    const response = await apiClient.get('/leads/reminders/aging', { params });
    return response.data.data;
  },
};
