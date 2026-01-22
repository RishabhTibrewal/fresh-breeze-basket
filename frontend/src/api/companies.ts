import apiClient from '@/lib/apiClient';

export interface Company {
  id: string;
  name: string;
  slug: string;
}

export interface CompanyAdmin {
  id: string;
  email: string;
  role: 'admin';
}

export interface RegisterCompanyData {
  company_name: string;
  company_slug?: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface RegisterCompanyResponse {
  company: Company;
  admin: CompanyAdmin;
  login_url: string;
}

export const companiesService = {
  async registerCompany(data: RegisterCompanyData): Promise<RegisterCompanyResponse> {
    const response = await apiClient.post<{ success: boolean; data: RegisterCompanyResponse }>(
      '/companies/register',
      data
    );
    return response.data.data;
  }
};
