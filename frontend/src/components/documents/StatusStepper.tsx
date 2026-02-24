import React from "react";
import { cn } from "@/lib/utils";

export interface StatusStepperProps {
  steps: string[];
  current: string;
  className?: string;
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
  steps,
  current,
  className,
}) => {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.toLowerCase() === current.toLowerCase())
  );

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {steps.map((step, index) => {
        const isActive = index <= currentIndex && currentIndex !== -1;
        const isCurrent = index === currentIndex;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-medium",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-muted"
              )}
            >
              {index + 1}
            </div>
            <span
              className={cn(
                "whitespace-nowrap",
                isCurrent ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </span>
            {index < steps.length - 1 && (
              <div className="h-px w-6 bg-border hidden sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StatusStepper;


