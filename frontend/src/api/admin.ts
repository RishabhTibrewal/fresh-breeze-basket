import apiClient from '@/lib/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'sales' | 'accounts'; // Backward compatibility - primary role
  roles?: string[]; // New: array of roles
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  }
}

export interface UsersResponse {
  success: boolean;
  data: {
    users: UserProfile[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }
}

export interface DashboardStats {
  user_stats: {
    total: number;
  };
  product_stats: {
    total: number;
    new_this_week: number;
  };
  order_stats: {
    total: number;
    active: number;
  };
  sales_stats: {
    total: number;
    last_month: number;
    percent_change: string;
  };
  low_inventory: Array<{
    id: string;
    name: string;
    stock_count: number;
    category_id: string;
    categories: {
      name: string;
    } | null;
  }>;
  recent_orders: Array<{
    id: string;
    user_id: string;
    status: string;
    total_amount: number;
    created_at: string;
    profiles: {
      email: string;
      first_name: string | null;
      last_name: string | null;
    } | null;
  }>;
}

export interface DashboardStatsResponse {
  success: boolean;
  data: DashboardStats;
}

// Lead interfaces for admin leads management
export interface AdminLead {
  id: string;
  sales_executive_id: string;
  company_name?: string | null;
  contact_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_position?: string | null;
  title: string;
  description?: string | null;
  source: string;
  estimated_value: number;
  currency: string;
  stage: string;
  priority: string;
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
  sales_executive?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface GetLeadsParams {
  stage?: string;
  priority?: string;
  source?: string;
  search?: string;
  sales_executive_id?: string;
}

export interface CreateLeadData {
  sales_executive_id: string;
  company_name?: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_position?: string;
  title: string;
  description?: string;
  source?: string;
  estimated_value?: number;
  currency?: string;
  stage?: string;
  priority?: string;
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

export interface UpdateLeadData {
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_position?: string;
  title?: string;
  description?: string;
  source?: string;
  estimated_value?: number;
  currency?: string;
  stage?: string;
  priority?: string;
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
  lost_reason?: string;
  append_note?: string;
}

export const adminService = {
  // Get all users with pagination and optional search
  async getUsers(page = 1, limit = 10, search?: string): Promise<UsersResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    if (search) {
      params.append('search', search);
    }
    
    const { data } = await apiClient.get<UsersResponse>(`/admin/users?${params.toString()}`);
    return data;
  },
  
  // Get dashboard statistics
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const { data } = await apiClient.get<DashboardStatsResponse>('/admin/dashboard-stats');
    return data;
  },

  // Get all available roles
  async getAllRoles(): Promise<{ success: boolean; data: Array<{ id: string; name: string; description: string | null }> }> {
    const { data } = await apiClient.get<{ success: boolean; data: Array<{ id: string; name: string; description: string | null }> }>('/admin/roles');
    return data;
  },

  // Get user roles
  async getUserRoles(userId: string): Promise<{ success: boolean; data: { userId: string; companyId: string; roles: string[] } }> {
    const { data } = await apiClient.get<{ success: boolean; data: { userId: string; companyId: string; roles: string[] } }>(`/admin/users/${userId}/roles`);
    return data;
  },

  // Update user roles (new: accepts roles array)
  async updateUserRoles(userId: string, roles: string[]): Promise<{ success: boolean; data: { userId: string; companyId: string; roles: string[] }; message: string }> {
    const { data } = await apiClient.put<{ success: boolean; data: { userId: string; companyId: string; roles: string[] }; message: string }>(
      `/admin/users/${userId}/roles`,
      { roles }
    );
    return data;
  },

  // Update user role (legacy: single role - kept for backward compatibility)
  async updateUserRole(userId: string, role: 'user' | 'admin' | 'sales' | 'accounts'): Promise<{ success: boolean; data: UserProfile; message: string }> {
    const { data } = await apiClient.put<{ success: boolean; data: UserProfile; message: string }>(
      `/admin/users/${userId}/role`,
      { role }
    );
    return data;
  },

  // Get sales executives
  async getSalesExecutives(): Promise<{ success: boolean; data: UserProfile[] }> {
    const { data } = await apiClient.get<{ success: boolean; data: UserProfile[] }>('/admin/sales-executives');
    return data;
  },

  // Sales Targets Management
  async getSalesTargets(params?: { sales_executive_id?: string; period_type?: string; is_active?: boolean }): Promise<{ success: boolean; data: SalesTarget[] }> {
    const queryParams = new URLSearchParams();
    if (params?.sales_executive_id) queryParams.append('sales_executive_id', params.sales_executive_id);
    if (params?.period_type) queryParams.append('period_type', params.period_type);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    
    const { data } = await apiClient.get<{ success: boolean; data: SalesTarget[] }>(
      `/admin/sales-targets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getSalesTargetById(id: string): Promise<{ success: boolean; data: SalesTarget }> {
    const { data } = await apiClient.get<{ success: boolean; data: SalesTarget }>(`/admin/sales-targets/${id}`);
    return data;
  },

  async createSalesTarget(targetData: CreateSalesTargetData): Promise<{ success: boolean; data: SalesTarget; message: string }> {
    const { data } = await apiClient.post<{ success: boolean; data: SalesTarget; message: string }>(
      '/admin/sales-targets',
      targetData
    );
    return data;
  },

  async updateSalesTarget(id: string, targetData: UpdateSalesTargetData): Promise<{ success: boolean; data: SalesTarget; message: string }> {
    const { data } = await apiClient.put<{ success: boolean; data: SalesTarget; message: string }>(
      `/admin/sales-targets/${id}`,
      targetData
    );
    return data;
  },

  async deleteSalesTarget(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete<{ success: boolean; message: string }>(`/admin/sales-targets/${id}`);
    return data;
  },

  // Leads Management
  async getLeads(params?: GetLeadsParams): Promise<{ success: boolean; data: AdminLead[] }> {
    const queryParams = new URLSearchParams();
    if (params?.stage) queryParams.append('stage', params.stage);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.source) queryParams.append('source', params.source);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sales_executive_id) queryParams.append('sales_executive_id', params.sales_executive_id);
    
    const { data } = await apiClient.get<{ success: boolean; data: AdminLead[] }>(
      `/admin/leads${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getLeadById(id: string): Promise<{ success: boolean; data: AdminLead }> {
    const { data } = await apiClient.get<{ success: boolean; data: AdminLead }>(`/admin/leads/${id}`);
    return data;
  },

  async createLead(data: CreateLeadData): Promise<{ success: boolean; data: AdminLead }> {
    const { data: response } = await apiClient.post<{ success: boolean; data: AdminLead }>('/admin/leads', data);
    return response;
  },

  async updateLead(id: string, updateData: UpdateLeadData): Promise<{ success: boolean; data: AdminLead }> {
    const { data } = await apiClient.put<{ success: boolean; data: AdminLead }>(`/admin/leads/${id}`, updateData);
    return data;
  },

  async deleteLead(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete<{ success: boolean; message: string }>(`/admin/leads/${id}`);
    return data;
  },
};

// Sales Target interfaces
export interface SalesTarget {
  id: string;
  sales_executive_id: string;
  target_amount: number;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  sales_executive?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  achieved_amount?: number;
  progress_percentage?: number;
  remaining_amount?: number;
}

export interface CreateSalesTargetData {
  sales_executive_id: string;
  target_amount: number;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  description?: string;
}

export interface UpdateSalesTargetData {
  target_amount?: number;
  period_type?: 'monthly' | 'quarterly' | 'yearly';
  period_start?: string;
  period_end?: string;
  description?: string;
  is_active?: boolean;
}

export default adminService; 