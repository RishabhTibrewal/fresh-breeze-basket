import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/api/company';
import apiClient from '@/lib/apiClient';
import { getCompanyCurrency, setCompanyCurrency, getCurrencySymbol, formatCurrency } from '@/lib/utils';

function getSubdomain(): string {
  if (typeof window === 'undefined') return 'default';
  const hostname = window.location.hostname;
  const storedSubdomain = localStorage.getItem('tenant_subdomain');
  if (storedSubdomain) return storedSubdomain;
  if (hostname.includes('.') && !hostname.startsWith('127.0.0.1')) {
    const parts = hostname.split('.');
    const isLocalhostDomain = parts.length === 2 && parts[1] === 'localhost';
    const hasSubdomain = parts.length > 2 || isLocalhostDomain;
    const isRootDomain = parts.length === 2 && !isLocalhostDomain;
    const candidate = parts[0];
    if (isRootDomain || candidate === 'www') return 'default';
    if (hasSubdomain) return candidate;
  }
  return 'default';
}

export function useCompanyCurrency() {
  const [currency, setLocalCurrency] = useState<string>(getCompanyCurrency());

  const { data: company } = useQuery({
    queryKey: ['company', 'currency-info'],
    queryFn: async () => {
      try {
        const myComp = await companyService.getMyCompany();
        if (myComp?.currency) return myComp;
      } catch {
        // Unauthenticated or error - try by-slug
      }
      try {
        const subdomain = getSubdomain();
        const res = await apiClient.get(`/companies/by-slug/${subdomain}`);
        if (res.data?.data) return res.data.data;
      } catch {
        // Fallback
      }
      return null;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (company?.currency) {
      setCompanyCurrency(company.currency);
      setLocalCurrency(company.currency.toUpperCase());
    }
  }, [company?.currency]);

  useEffect(() => {
    const handleCurrencyChange = () => {
      setLocalCurrency(getCompanyCurrency());
    };
    window.addEventListener('company_currency_changed', handleCurrencyChange);
    return () => {
      window.removeEventListener('company_currency_changed', handleCurrencyChange);
    };
  }, []);

  const symbol = getCurrencySymbol(currency);

  const format = (amount: number | string | null | undefined) => {
    return formatCurrency(amount, currency);
  };

  return {
    currency,
    symbol,
    formatCurrency: format,
  };
}
