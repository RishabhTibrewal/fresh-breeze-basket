import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCompanyCurrency(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('company_currency') || 'INR';
  }
  return 'INR';
}

export function setCompanyCurrency(currency: string): void {
  if (typeof window !== 'undefined' && currency) {
    localStorage.setItem('company_currency', currency.toUpperCase());
    window.dispatchEvent(new Event('company_currency_changed'));
  }
}

export function getCurrencySymbol(currencyCode?: string): string {
  const code = (currencyCode || getCompanyCurrency()).toUpperCase();
  switch (code) {
    case 'AED': return 'AED';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'SAR': return 'SAR';
    case 'INR':
    default:
      return '₹';
  }
}

export function formatCurrency(amount: number | string | null | undefined, currencyCode?: string): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const code = (currencyCode || getCompanyCurrency()).toUpperCase();
  const symbol = getCurrencySymbol(code);
  return `${symbol} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
