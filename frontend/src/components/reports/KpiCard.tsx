import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  /** Sub-label under the value */
  subtitle?: string;
  /** Percentage change vs previous period, e.g. +12.4 or -3.2 */
  trend?: number;
  /** Lucide icon node */
  icon?: React.ReactNode;
  /** Loading skeleton state */
  isLoading?: boolean;
  /** Optional accent colour class for the icon background */
  iconColor?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  isLoading,
  iconColor = 'bg-primary/10 text-primary',
}: KpiCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-3.5 w-1/2 mb-3" />
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </CardContent>
      </Card>
    );
  }

  const trendColor =
    trend === undefined || trend === 0
      ? 'text-muted-foreground'
      : trend > 0
      ? 'text-emerald-600'
      : 'text-red-500';

  const TrendIcon =
    trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight truncate">{value}</p>

            {(trend !== undefined || subtitle) && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {trend !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
          </div>

          {icon && (
            <div className={`flex-shrink-0 rounded-lg p-2.5 ${iconColor}`}>
              <div className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
            </div>
          )}
        </div>

        {/* Subtle gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-transparent" />
      </CardContent>
    </Card>
  );
}

export default KpiCard;
