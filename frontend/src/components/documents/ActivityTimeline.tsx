import React from "react";
import { cn } from "@/lib/utils";
import { Clock, Package, Activity } from "lucide-react";

export type TimelineEventType = "status" | "stock" | "system";

export interface TimelineEvent {
  id: string;
  at: string; // ISO date
  type: TimelineEventType;
  title: string;
  description?: string;
  to?: string;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events,
  className,
}) => {
  if (!events || events.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No activity recorded for this document yet.
      </div>
    );
  }

  const iconFor = (type: TimelineEventType) => {
    switch (type) {
      case "status":
        return <Clock className="w-3.5 h-3.5" />;
      case "stock":
        return <Package className="w-3.5 h-3.5" />;
      case "system":
      default:
        return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <ol className={cn("relative border-l pl-4 space-y-4 text-sm", className)}>
      {sorted.map((event, idx) => (
        <li key={event.id} className="relative pl-2">
          <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border">
            {iconFor(event.type)}
          </span>
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{event.title}</p>
            <span className="text-xs text-muted-foreground">
              {new Date(event.at).toLocaleString()}
            </span>
          </div>
          {event.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {event.description}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};

export default ActivityTimeline;


