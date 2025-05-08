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
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
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
    const { data } = await apiClient.put<UserProfile>('/auth/profile', profileData);
    return data;
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