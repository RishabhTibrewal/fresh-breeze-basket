import { apiClient } from '../api/client';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  AED: 'AED ',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: 'SAR ',
};

let currentCurrency = 'INR';

export function setCompanyCurrency(currency: string) {
  if (currency) {
    currentCurrency = currency.toUpperCase();
  }
}

export function getCompanyCurrency(): string {
  return currentCurrency;
}

export function getCurrencySymbol(currencyCode?: string): string {
  const code = (currencyCode || currentCurrency).toUpperCase();
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export function formatCurrency(amount: number | string | null | undefined, currencyCode?: string): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${num.toFixed(2)}`;
}

export async function fetchCompanyCurrency(): Promise<string> {
  try {
    const response = await apiClient.get('/companies/me');
    const currency = response.data?.data?.currency || response.data?.currency;
    if (currency) {
      setCompanyCurrency(currency);
      return currency;
    }
  } catch (error) {
    console.log('Error fetching company currency in mobile:', error);
  }
  return currentCurrency;
}
