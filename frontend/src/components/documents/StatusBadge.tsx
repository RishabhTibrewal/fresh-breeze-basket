import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeKind =
  | "order_status"
  | "order_type"
  | "order_source"
  | "fulfillment_type";

export interface StatusBadgeProps {
  kind: StatusBadgeKind;
  value: string | undefined | null;
  size?: "sm" | "md";
  className?: string;
}

function normalize(value?: string | null): string {
  return (value || "").toLowerCase();
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  kind,
  value,
  size = "sm",
  className,
}) => {
  if (!value) return null;

  const val = normalize(value);

  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let label = value;

  switch (kind) {
    case "order_status": {
      // pending | processing | shipped | delivered | cancelled
      if (val === "delivered" || val === "completed") variant = "default";
      else if (val === "pending" || val === "processing") variant = "secondary";
      else if (val === "cancelled") variant = "destructive";
      else variant = "outline";
      break;
    }
    case "order_type": {
      // sales | purchase | return
      if (val === "sales") variant = "default";
      else if (val === "purchase") variant = "secondary";
      else if (val === "return") variant = "destructive";
      break;
    }
    case "order_source": {
      // ecommerce | pos | sales | internal
      if (val === "ecommerce" || val === "sales") variant = "default";
      else if (val === "pos") variant = "secondary";
      else if (val === "internal") variant = "outline";
      break;
    }
    case "fulfillment_type": {
      // delivery | pickup | cash_counter
      if (val === "delivery") variant = "default";
      else if (val === "pickup") variant = "secondary";
      else if (val === "cash_counter") variant = "outline";
      break;
    }
  }

  const text =
    label
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "";

  const sizeClasses = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <Badge
      variant={variant}
      className={cn("inline-flex items-center gap-1 rounded-full", sizeClasses, className)}
    >
      {text}
    </Badge>
  );
};

export default StatusBadge;


