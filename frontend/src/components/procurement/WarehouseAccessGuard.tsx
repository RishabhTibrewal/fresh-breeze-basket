import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface WarehouseAccessGuardProps {
  warehouseId: string;
  children: ReactNode;
  fallback?: ReactNode;
  showWarning?: boolean;
}

export function WarehouseAccessGuard({ 
  warehouseId, 
  children, 
  fallback,
  showWarning = false 
}: WarehouseAccessGuardProps) {
  const { isAdmin, hasWarehouseAccess } = useAuth();

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check warehouse access
  const hasAccess = hasWarehouseAccess(warehouseId);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showWarning) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have access to manage this warehouse.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

