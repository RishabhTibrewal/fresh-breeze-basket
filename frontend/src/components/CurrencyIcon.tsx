import React from 'react';
import { DollarSign, IndianRupee, Euro, PoundSterling } from 'lucide-react';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { cn } from '@/lib/utils';

interface CurrencyIconProps {
  className?: string;
  currency?: string;
}

export const CurrencyIcon: React.FC<CurrencyIconProps> = ({
  className = "h-4 w-4 text-muted-foreground",
  currency: propCurrency
}) => {
  const { currency: companyCurrency } = useCompanyCurrency();
  const code = (propCurrency || companyCurrency || 'INR').toUpperCase();

  switch (code) {
    case 'INR':
      return <IndianRupee className={className} />;
    case 'EUR':
      return <Euro className={className} />;
    case 'GBP':
      return <PoundSterling className={className} />;
    case 'USD':
      return <DollarSign className={className} />;
    case 'AED':
    case 'SAR':
      return <span className={cn("text-xs font-bold leading-none select-none", className)}>{code}</span>;
    default:
      return <DollarSign className={className} />;
  }
};

export default CurrencyIcon;

