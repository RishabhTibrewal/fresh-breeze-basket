import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  mrpPrice: number;
  salePrice: number;
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
  const discount = mrpPrice > salePrice
    ? Math.round(((mrpPrice - salePrice) / mrpPrice) * 100)
    : 0;

  const hasDiscount = discount > 0;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const priceSizeClasses = {
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
              ₹{salePrice.toFixed(2)}
            </span>
            <span className={cn('text-muted-foreground line-through', priceSizeClasses[size])}>
              ₹{mrpPrice.toFixed(2)}
            </span>
            {showDiscount && discount > 0 && (
              <Badge variant="destructive" className={cn('text-xs', size === 'sm' && 'text-[10px] px-1')}>
                {discount}% OFF
              </Badge>
            )}
          </>
        ) : (
          <span className={cn('font-bold', sizeClasses[size])}>
            ₹{salePrice.toFixed(2)}
          </span>
        )}
      </div>
      {!hasDiscount && mrpPrice !== salePrice && (
        <div className={cn('text-muted-foreground', priceSizeClasses[size])}>
          MRP: ₹{mrpPrice.toFixed(2)}
        </div>
      )}
    </div>
  );
};

