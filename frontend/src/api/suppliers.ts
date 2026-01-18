import apiClient from '@/lib/apiClient';

export interface Supplier {
  id: string;
  supplier_code?: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  tax_id?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier_bank_accounts?: SupplierBankAccount[];
}

export interface SupplierBankAccount {
  id: string;
  supplier_id: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  is_primary: boolean;
  created_at: string;
}

export interface CreateSupplierData {
  supplier_code?: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  tax_id?: string;
  payment_terms?: string;
  notes?: string;
  bank_accounts?: Omit<SupplierBankAccount, 'id' | 'supplier_id' | 'created_at'>[];
}

export interface SuppliersResponse {
  success: boolean;
  data: Supplier[];
}

export const suppliersService = {
  async getAll(filters?: { is_active?: boolean; search?: string }): Promise<Supplier[]> {
    const { data } = await apiClient.get<SuppliersResponse>('/suppliers', {
      params: filters,
    });
    return data.data || [];
  },

  async getById(id: string): Promise<Supplier> {
    const { data } = await apiClient.get<{ success: boolean; data: Supplier }>(`/suppliers/${id}`);
    return data.data;
  },

  async create(supplierData: CreateSupplierData): Promise<Supplier> {
    const { data } = await apiClient.post<{ success: boolean; data: Supplier }>('/suppliers', supplierData);
    return data.data;
  },

  async update(id: string, supplierData: Partial<CreateSupplierData>): Promise<Supplier> {
    const { data } = await apiClient.put<{ success: boolean; data: Supplier }>(`/suppliers/${id}`, supplierData);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/suppliers/${id}`);
  },
};
