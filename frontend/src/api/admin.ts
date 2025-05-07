import apiClient from '@/lib/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
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
};

export default adminService; 