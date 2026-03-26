import apiClient from '@/lib/apiClient';

export interface BankAccount {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string;
}

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  gstin?: string;
  logo_url?: string;
  bank_details?: BankAccount[];
}

export const companyService = {
  /**
   * Get current company profile
   */
  async getMyCompany(): Promise<Company> {
    const response = await apiClient.get('/companies/me');
    return response.data.data;
  },

  /**
   * Update company profile
   */
  async updateMyCompany(data: Partial<Company>): Promise<Company> {
    const response = await apiClient.patch('/companies/me', data);
    return response.data.data;
  }
};
