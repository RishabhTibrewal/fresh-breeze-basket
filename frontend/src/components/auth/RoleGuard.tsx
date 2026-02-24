import React from 'react';
import { useCanAccess } from '@/hooks/useRole';

interface RoleGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component to conditionally render content based on feature access
 * Usage: <RoleGuard feature="products.create">...</RoleGuard>
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  feature,
  children,
  fallback = null,
}) => {
  const canAccess = useCanAccess(feature);

  if (!canAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

