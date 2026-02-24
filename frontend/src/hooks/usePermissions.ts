import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import apiClient from '@/lib/apiClient';

export interface Permission {
  permission_code: string;
  module: string;
  action: string;
}

// Helper to get company ID from subdomain or profile
async function getCompanyId(): Promise<string | null> {
  // Try to get from localStorage first (cached)
  const cachedCompanyId = localStorage.getItem('company_id');
  if (cachedCompanyId) {
    return cachedCompanyId;
  }

  // Extract subdomain from hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    let subdomain: string | null = null;
    
    // Check localStorage for manually set tenant
    const storedSubdomain = localStorage.getItem('tenant_subdomain');
    if (storedSubdomain) {
      subdomain = storedSubdomain;
    } else if (hostname.includes('.') && !hostname.startsWith('127.0.0.1')) {
      const parts = hostname.split('.');
      const isLocalhostDomain = parts.length === 2 && parts[1] === 'localhost';
      const hasSubdomain = parts.length > 2 || isLocalhostDomain;
      const isRootDomain = parts.length === 2 && !isLocalhostDomain;
      const candidate = parts[0];

      if (isRootDomain || candidate === 'www') {
        subdomain = 'default';
      } else if (hasSubdomain) {
        subdomain = candidate;
      }
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const tenantFromUrl = urlParams.get('tenant') || hashParams.get('tenant');
      subdomain = tenantFromUrl || 'default';
    }

    if (subdomain) {
      try {
        // Fetch company ID from backend using subdomain
        const response = await apiClient.get(`/companies/by-slug/${subdomain}`);
        if (response.data?.success && response.data?.data?.id) {
          const companyId = response.data.data.id;
          localStorage.setItem('company_id', companyId);
          return companyId;
        }
      } catch (error) {
        console.error('Error fetching company ID:', error);
      }
    }
  }

  return null;
}

export const usePermissions = () => {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      try {
        // Get company ID from profile or subdomain
        let companyId = profile?.company_id;
        
        if (!companyId) {
          companyId = await getCompanyId();
        }

        if (!companyId) {
          console.warn('No company ID available for permissions check');
          setPermissions([]);
          setLoading(false);
          return;
        }

        const { data, error } = await (supabase.rpc as any)('get_user_permissions', {
          p_user_id: user.id,
          p_company_id: companyId
        });

        if (error) {
          console.error('Error fetching permissions:', error);
          throw error;
        }
        
        setPermissions(data || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user, profile?.company_id]);

  return { permissions, loading };
};

export const useCanAccess = (permissionCode: string): boolean => {
  const { permissions, loading } = usePermissions();
  return useMemo(() => {
    if (loading) return false;
    return permissions.some(p => p.permission_code === permissionCode);
  }, [permissions, permissionCode, loading]);
};

export const useAccessibleModules = () => {
  const { user, profile } = useAuth();
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      if (!user) {
        setModules([]);
        setLoading(false);
        return;
      }

      try {
        // Get company ID from profile or subdomain
        let companyId = profile?.company_id;
        
        if (!companyId) {
          companyId = await getCompanyId();
        }

        if (!companyId) {
          console.warn('No company ID available for modules check');
          setModules([]);
          setLoading(false);
          return;
        }
        
        const { data, error } = await (supabase.rpc as any)('get_user_accessible_modules', {
          p_user_id: user.id,
          p_company_id: companyId
        });

        if (error) {
          console.error('Error fetching accessible modules:', error);
          throw error;
        }
        
        setModules(data?.map((m: any) => m.module_code) || []);
      } catch (error) {
        console.error('Error fetching accessible modules:', error);
        setModules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [user, profile?.company_id]);

  return { modules, loading };
};

export const useCompanyModules = () => {
  const { profile } = useAuth();
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyModules = async () => {
      try {
        // Get company ID from profile or subdomain
        let companyId = profile?.company_id;
        
        if (!companyId) {
          companyId = await getCompanyId();
        }

        if (!companyId) {
          console.warn('No company ID available for company modules check');
          setCompanyModules([]);
          setLoading(false);
          return;
        }
        
        const { data, error } = await (supabase.rpc as any)('get_company_modules', {
          p_company_id: companyId
        });

        if (error) {
          console.error('Error fetching company modules:', error);
          throw error;
        }
        
        setCompanyModules(data?.map((m: any) => m.module_code) || []);
      } catch (error) {
        console.error('Error fetching company modules:', error);
        setCompanyModules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyModules();
  }, [profile?.company_id]);

  return { companyModules, loading };
};
