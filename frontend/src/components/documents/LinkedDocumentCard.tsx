import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LinkedDocumentCardProps {
  title: string;
  count: number;
  description?: string;
  onClick?: () => void;
  toLabel?: string;
  className?: string;
}

export const LinkedDocumentCard: React.FC<LinkedDocumentCardProps> = ({
  title,
  count,
  description,
  onClick,
  toLabel = "View",
  className,
}) => {
  const clickable = Boolean(onClick);

  return (
    <Card
      className={cn(
        "inline-flex items-center justify-between px-3 py-2 cursor-default",
        clickable && "hover:bg-muted/70 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-0 flex items-center gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm font-semibold">{count}</span>
          {clickable && (
            <span className="text-[11px] uppercase tracking-wide text-primary">
              {toLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LinkedDocumentCard;


