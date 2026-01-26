import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ProcurementStatus = 
  // PO statuses
  | 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
  // GRN statuses
  | 'inspected' | 'rejected' | 'completed'
  // Invoice statuses
  | 'partial' | 'paid' | 'overdue'
  // Payment statuses
  | 'processing' | 'failed';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      // Success/Active statuses
      case 'approved':
      case 'ordered':
      case 'received':
      case 'completed':
      case 'paid':
        return 'default';
      
      // Warning/In-progress statuses
      case 'pending':
      case 'partially_received':
      case 'partial':
      case 'processing':
      case 'inspected':
        return 'secondary';
      
      // Error/Cancelled statuses
      case 'cancelled':
      case 'rejected':
      case 'overdue':
      case 'failed':
        return 'destructive';
      
      // Neutral statuses
      case 'draft':
      default:
        return 'outline';
    }
  };

  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge variant={getVariant(status)} className={cn(className)}>
      {formatStatus(status)}
    </Badge>
  );
}

