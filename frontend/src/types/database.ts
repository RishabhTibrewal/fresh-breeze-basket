export interface Address {
  id: string;
  user_id: string;
  address_type: 'shipping' | 'billing' | 'both';
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
} 