import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { downloadReport, type ReportFilter } from '@/api/reports';
import { toast } from 'sonner';

interface ExportBarProps {
  endpoint: string;
  filters?: ReportFilter;
  /** Label shown before the buttons, default: 'Export' */
  label?: string;
  disabled?: boolean;
}

export function ExportBar({ endpoint, filters, label = 'Export', disabled }: ExportBarProps) {
  const [loadingFormat, setLoadingFormat] = useState<'pdf' | 'excel' | null>(null);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (loadingFormat) return;
    setLoadingFormat(format);
    try {
      await downloadReport(endpoint, format, filters);
      toast.success(`${format.toUpperCase()} downloaded successfully`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}

      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={disabled || loadingFormat !== null}
        onClick={() => handleExport('pdf')}
      >
        {loadingFormat === 'pdf' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5 text-red-500" />
        )}
        PDF
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={disabled || loadingFormat !== null}
        onClick={() => handleExport('excel')}
      >
        {loadingFormat === 'excel' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
        )}
        Excel
      </Button>
    </div>
  );
}

export default ExportBar;
