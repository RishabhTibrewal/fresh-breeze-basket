import React from "react";
import { cn } from "@/lib/utils";

export interface DocumentHeaderMetadataItem {
  label: string;
  value: React.ReactNode;
}

export interface DocumentHeaderProps {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  metadata?: DocumentHeaderMetadataItem[];
  actions?: React.ReactNode;
  links?: React.ReactNode;
  className?: string;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  subtitle,
  badges,
  metadata,
  actions,
  links,
  className,
}) => {
  return (
    <div className={cn("space-y-4 border-b pb-4", className)}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {badges && (
              <div className="flex flex-wrap items-center gap-2">{badges}</div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        )}
      </div>

      {metadata && metadata.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {metadata.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">
                {item.label}
              </div>
              <div className="font-medium break-words">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {links && (
        <div className="flex flex-wrap gap-2 pt-1 border-t mt-2">{links}</div>
      )}
    </div>
  );
};

export default DocumentHeader;


