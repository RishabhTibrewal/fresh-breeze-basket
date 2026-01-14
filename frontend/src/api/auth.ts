import apiClient from '@/lib/apiClient';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface UpdateRoleData {
  role: 'user' | 'admin' | 'sales';
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('token', data.token);
    return data;
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', userData);
    localStorage.setItem('token', data.token);
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('token');
  },

  async getCurrentUser(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>('/auth/me');
    return data;
  },

  async updateProfile(profileData: UpdateProfileData): Promise<UserProfile> {
    console.log('[authService.updateProfile] Called with data:', profileData);
    console.log('[authService.updateProfile] Making PUT request to /auth/profile');
    try {
      const response = await apiClient.put<{ success: boolean; data: UserProfile }>('/auth/profile', profileData);
      console.log('[authService.updateProfile] API response:', response);
      console.log('[authService.updateProfile] Response data:', response.data);
      // Backend returns { success: true, data: ... }
      const result = response.data.success ? response.data.data : response.data as any;
      console.log('[authService.updateProfile] Returning result:', result);
      return result;
    } catch (error) {
      console.error('[authService.updateProfile] API call failed:', error);
      throw error;
    }
  },

  async checkAdminStatus(): Promise<any> {
    const { data } = await apiClient.get('/auth/check-admin');
    return data;
  },

  async updateRole(roleData: UpdateRoleData): Promise<UserProfile> {
    const { data } = await apiClient.put<UserProfile>('/auth/role', roleData);
    return data;
  },
}; 