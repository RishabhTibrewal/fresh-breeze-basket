import apiClient from '@/lib/apiClient';
import { Address } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';

export const addressApi = {
  getAddresses: async () => {
    try {
      console.log('Making request to /auth/addresses endpoint');
      
      // Get a fresh token for this specific request
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        console.error('No authentication token available');
        throw new Error('Authentication required');
      }
      
      // Make request with explicit authorization header
      const response = await apiClient.get('/auth/addresses', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Addresses API response status:', response.status);
      console.log('Response data structure:', response.data);
      
      // Fix the data extraction logic
      if (response.data?.success && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('Unexpected response structure:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  },

  addAddress: async (address: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('Adding address with data:', address);
      
      // Get a fresh token for this specific request
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        console.error('No authentication token available');
        throw new Error('Authentication required');
      }
      
      // Make request with explicit authorization header
      const response = await apiClient.post('/auth/addresses', address, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Address add response:', response.status, response.data);
      
      // Handle various response structures
      if (response.data?.success && response.data.data) {
        return response.data.data;
      } else if (response.data?.data) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('Error adding address:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.data && error.response.data.message) {
          throw new Error(error.response.data.message);
        }
      }
      throw error;
    }
  },

  updateAddress: async (id: string, address: Partial<Address>) => {
    try {
      const response = await apiClient.put(`/auth/addresses/${id}`, address);
      
      // Handle various response structures
      if (response.data?.success && response.data.data) {
        return response.data.data;
      } else if (response.data?.data) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  },

  deleteAddress: async (id: string) => {
    try {
      await apiClient.delete(`/auth/addresses/${id}`);
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  },

  setDefaultAddress: async (id: string, addressType: 'shipping' | 'billing' | 'both') => {
    try {
      const response = await apiClient.put(`/auth/addresses/${id}`, {
        is_default: true,
        address_type: addressType
      });
      
      // Handle various response structures
      if (response.data?.success && response.data.data) {
        return response.data.data;
      } else if (response.data?.data) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  },

  getAddressById: async (id: string) => {
    try {
      console.log(`Fetching address with ID: ${id}`);
      
      // First try to get from the backend API
      try {
        const response = await apiClient.get(`/auth/addresses/${id}`);
        
        if (response.data?.success && response.data.data) {
          return response.data.data;
        } else if (response.data?.data) {
          return response.data.data;
        } else if (response.data) {
          return response.data;
        }
      } catch (error) {
        console.log('Backend API address fetch failed, falling back to Supabase:', error);
      }
      
      // If backend fails, try directly from Supabase
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching address from Supabase:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching address with ID ${id}:`, error);
      throw error;
    }
  }
}; 