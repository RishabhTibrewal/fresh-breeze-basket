import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  mrpPrice?: number | null;
  salePrice?: number | null;
  showDiscount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  mrpPrice,
  salePrice,
  showDiscount = true,
  size = 'md',
  className,
}) => {
  // Safely coerce nullish values to numbers so .toFixed() never throws
  const safeMrp = Number(mrpPrice) || 0;
  const safeSale = salePrice != null ? Number(salePrice) : safeMrp;

  const discount = safeMrp > safeSale
    ? Math.round(((safeMrp - safeSale) / safeMrp) * 100)
    : 0;

  const hasDiscount = discount > 0;

  const sizeClasses: Record<string, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const priceSizeClasses: Record<string, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        {hasDiscount ? (
          <>
            <span className={cn('font-bold', sizeClasses[size])}>
              ₹{safeSale.toFixed(2)}
            </span>
            <span className={cn('text-muted-foreground line-through', priceSizeClasses[size])}>
              ₹{safeMrp.toFixed(2)}
            </span>
            {showDiscount && (
              <Badge variant="destructive" className={cn('text-xs', size === 'sm' && 'text-[10px] px-1')}>
                {discount}% OFF
              </Badge>
            )}
          </>
        ) : (
          <span className={cn('font-bold', sizeClasses[size])}>
            ₹{safeSale.toFixed(2)}
          </span>
        )}
      </div>
      {!hasDiscount && safeMrp !== safeSale && (
        <div className={cn('text-muted-foreground', priceSizeClasses[size])}>
          MRP: ₹{safeMrp.toFixed(2)}
        </div>
      )}
    </div>
  );
};
