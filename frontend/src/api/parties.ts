import apiClient from '@/lib/apiClient';

export interface ContactParty {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_customer: boolean;
  is_supplier: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyLedgerEntry {
  party_id: string;
  company_id: string;
  name: string;
  ledger_side: 'receivable' | 'payable';
  doc_type: 'sale' | 'purchase' | string;
  doc_id: string;
  amount: number;
  doc_date: string;
  status: string;
}

export interface PartyLedgerResponse {
  party: ContactParty;
  entries: PartyLedgerEntry[];
  totals: {
    totalReceivable: number;
    totalPayable: number;
    netPosition: number;
  };
}

export const partiesService = {
  async getParties(params?: {
    is_customer?: boolean;
    is_supplier?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContactParty[]> {
    const response = await apiClient.get('/parties', { params });
    return response.data.data ?? response.data;
  },

  async getPartyById(id: string): Promise<ContactParty> {
    const response = await apiClient.get(`/parties/${id}`);
    return response.data.data ?? response.data;
  },

  async createParty(payload: {
    name: string;
    email?: string;
    phone?: string;
    is_customer?: boolean;
    is_supplier?: boolean;
    notes?: string;
  }): Promise<ContactParty> {
    const response = await apiClient.post('/parties', payload);
    return response.data.data ?? response.data;
  },

  async linkPartyToCustomer(partyId: string, customerId: string): Promise<ContactParty> {
    const response = await apiClient.patch(`/parties/${partyId}/link-customer`, {
      customer_id: customerId,
    });
    return response.data.data ?? response.data;
  },

  async linkPartyToSupplier(partyId: string, supplierId: string): Promise<ContactParty> {
    const response = await apiClient.patch(`/parties/${partyId}/link-supplier`, {
      supplier_id: supplierId,
    });
    return response.data.data ?? response.data;
  },

  async getPartyLedger(partyId: string): Promise<PartyLedgerResponse> {
    const response = await apiClient.get(`/parties/${partyId}/ledger`);
    return response.data.data ?? response.data;
  },
};

