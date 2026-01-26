import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStage {
  id: string;
  label: string;
  status?: string;
  entityId?: string;
  entityType: 'po' | 'grn' | 'invoice' | 'payment';
  route?: string;
}

interface ProcurementWorkflowProps {
  po?: {
    id?: string;
    status?: string;
    po_number?: string;
  };
  grn?: {
    id?: string;
    status?: string;
    grn_number?: string;
  };
  invoice?: {
    id?: string;
    status?: string;
    invoice_number?: string;
  };
  payments?: Array<{
    id?: string;
    status?: string;
  }>;
  onStageClick?: (stage: WorkflowStage) => void;
  className?: string;
}

export function ProcurementWorkflow({
  po,
  grn,
  invoice,
  payments = [],
  onStageClick,
  className,
}: ProcurementWorkflowProps) {
  const navigate = useNavigate();

  const stages: WorkflowStage[] = [
    {
      id: 'po',
      label: 'Purchase Order',
      status: po?.status,
      entityId: po?.id,
      entityType: 'po',
      route: po?.id ? `/admin/purchase-orders/${po.id}` : undefined,
    },
    {
      id: 'grn',
      label: 'Goods Receipt',
      status: grn?.status,
      entityId: grn?.id,
      entityType: 'grn',
      route: grn?.id ? `/admin/goods-receipts/${grn.id}` : undefined,
    },
    {
      id: 'invoice',
      label: 'Invoice',
      status: invoice?.status,
      entityId: invoice?.id,
      entityType: 'invoice',
      route: invoice?.id ? `/admin/purchase-invoices/${invoice.id}` : undefined,
    },
    {
      id: 'payment',
      label: 'Payment',
      status: payments.length > 0 ? payments[0].status : undefined,
      entityId: payments.length > 0 ? payments[0].id : undefined,
      entityType: 'payment',
      route: payments.length > 0 ? `/admin/supplier-payments/${payments[0].id}` : undefined,
    },
  ];

  const getStageStatus = (stage: WorkflowStage): 'completed' | 'active' | 'pending' => {
    if (!stage.status) return 'pending';
    
    const completedStatuses: Record<string, string[]> = {
      po: ['approved', 'ordered', 'partially_received', 'received'],
      grn: ['completed'],
      invoice: ['paid'],
      payment: ['completed'],
    };

    const activeStatuses: Record<string, string[]> = {
      po: ['pending'],
      grn: ['pending', 'inspected', 'approved'],
      invoice: ['pending', 'partial'],
      payment: ['pending', 'processing'],
    };

    if (completedStatuses[stage.entityType]?.includes(stage.status)) {
      return 'completed';
    }
    if (activeStatuses[stage.entityType]?.includes(stage.status)) {
      return 'active';
    }
    return 'pending';
  };

  const handleStageClick = (stage: WorkflowStage) => {
    if (onStageClick) {
      onStageClick(stage);
    } else if (stage.route) {
      navigate(stage.route);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {stages.map((stage, index) => {
            const stageStatus = getStageStatus(stage);
            const isClickable = !!stage.route || !!onStageClick;
            const isCompleted = stageStatus === 'completed';
            const isActive = stageStatus === 'active';

            return (
              <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={cn(
                    'flex flex-col items-center gap-2 min-w-[100px]',
                    isClickable && 'cursor-pointer hover:opacity-80 transition-opacity'
                  )}
                  onClick={() => isClickable && handleStageClick(stage)}
                >
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : isActive ? (
                      <Circle className="h-6 w-6 text-blue-600 fill-blue-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-xs font-medium',
                      isCompleted && 'text-green-600',
                      isActive && 'text-blue-600',
                      !isCompleted && !isActive && 'text-gray-400'
                    )}>
                      {stage.label}
                    </p>
                    {stage.status && (
                      <div className="mt-1">
                        <StatusBadge status={stage.status} />
                      </div>
                    )}
                    {!stage.status && stage.entityId && (
                      <p className="text-xs text-muted-foreground mt-1">Not created</p>
                    )}
                  </div>
                </div>
                {index < stages.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

