import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WarehouseAccessGuard } from './WarehouseAccessGuard';

interface StatusTransitionButtonProps {
  label: string;
  onClick: () => void;
  requiredRoles?: string[];
  requiredWarehouseAccess?: string;
  currentStatus: string;
  targetStatus: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  icon?: ReactNode;
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationMessage?: string;
  tooltipMessage?: string;
  className?: string;
}

export function StatusTransitionButton({
  label,
  onClick,
  requiredRoles = [],
  requiredWarehouseAccess,
  currentStatus,
  targetStatus,
  disabled = false,
  variant = 'default',
  icon,
  showConfirmation = false,
  confirmationTitle,
  confirmationMessage,
  tooltipMessage,
  className,
}: StatusTransitionButtonProps) {
  const { isAdmin, hasAnyRole, hasWarehouseAccess } = useAuth();
  const [showDialog, setShowDialog] = useState(false);

  // Check role permissions - Admin always has permission
  const hasRolePermission = isAdmin || (requiredRoles.length > 0 && hasAnyRole(requiredRoles));

  // Check warehouse access if required - Admin always has access
  const hasWarehousePermission = !requiredWarehouseAccess || isAdmin || hasWarehouseAccess(requiredWarehouseAccess);

  // Check if status transition is valid (basic check - backend will validate)
  // Statuses must be different to allow transition
  const isValidTransition = currentStatus !== targetStatus;

  // Determine if button should be disabled
  // Admin override: Admin bypasses role and warehouse checks
  // For admin: Respect disabled prop (for loading states) and invalid transitions
  // For non-admins: Check all permissions, disabled prop, and status transition
  const isDisabled = isAdmin 
    ? (disabled || !isValidTransition)  // Admin: disable for loading states or invalid transitions
    : disabled || !hasRolePermission || !hasWarehousePermission || !isValidTransition;

  // Determine tooltip message
  const getTooltipMessage = (): string => {
    if (tooltipMessage) return tooltipMessage;
    if (!hasRolePermission) {
      return `This action requires one of the following roles: ${requiredRoles.join(', ')}`;
    }
    if (!hasWarehousePermission) {
      return 'You do not have access to manage this warehouse';
    }
    if (!isValidTransition) {
      return `Cannot transition from ${currentStatus} to ${targetStatus}`;
    }
    return '';
  };

  const handleClick = () => {
    if (showConfirmation) {
      setShowDialog(true);
    } else {
      onClick();
    }
  };

  const handleConfirm = () => {
    setShowDialog(false);
    onClick();
  };

  const button = (
    <Button
      variant={variant}
      disabled={isDisabled}
      onClick={handleClick}
      className={className}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </Button>
  );

  // Wrap with warehouse access guard if needed
  const content = requiredWarehouseAccess ? (
    <WarehouseAccessGuard warehouseId={requiredWarehouseAccess}>
      {button}
    </WarehouseAccessGuard>
  ) : button;

  // Wrap with tooltip if there's a message
  const wrappedContent = getTooltipMessage() ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : content;

  return (
    <>
      {wrappedContent}
      {showConfirmation && (
        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmationTitle || 'Confirm Action'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmationMessage || `Are you sure you want to ${label.toLowerCase()}?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

