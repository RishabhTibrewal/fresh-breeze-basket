import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import type { ReportFilter } from '@/api/reports';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BranchOption {
  id: string;
  name: string;
}

interface ReportFiltersProps {
  filters: ReportFilter;
  onFilterChange: (key: keyof ReportFilter | string, value: unknown) => void;
  onReset?: () => void;
  branches?: BranchOption[];
  showSearch?: boolean;
  showCurrency?: boolean;
  hideDateRange?: boolean;  // set true for master data reports that don't need a date window
  children?: React.ReactNode; // slot for module-specific extra filters
}

// ---------------------------------------------------------------------------
// Date picker button helper
// ---------------------------------------------------------------------------
function DateButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 text-sm gap-2 min-w-[130px]">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{date ? format(date, 'dd MMM yyyy') : label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ReportFilters({
  filters,
  onFilterChange,
  onReset,
  branches = [],
  showSearch = false,
  showCurrency = false,
  hideDateRange = false,
  children,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range */}
      {!hideDateRange && (
        <>
          <DateButton
            label="From date"
            value={filters.from_date}
            onChange={(v) => onFilterChange('from_date', v)}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <DateButton
            label="To date"
            value={filters.to_date}
            onChange={(v) => onFilterChange('to_date', v)}
          />
        </>
      )}
      {/* Branch / Warehouse select */}
      {branches.length > 0 && (
        <Select
          value={(filters.branch_ids as string[] | undefined)?.[0] ?? 'all'}
          onValueChange={(v) => onFilterChange('branch_ids', v === 'all' ? [] : [v])}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Currency */}
      {showCurrency && (
        <Select
          value={filters.currency ?? 'AED'}
          onValueChange={(v) => onFilterChange('currency', v)}
        >
          <SelectTrigger className="h-9 text-sm w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['AED', 'USD', 'EUR', 'INR', 'SAR'].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 text-sm pl-8 w-[200px]"
            placeholder="Search..."
            value={(filters.search as string) ?? ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>
      )}

      {/* Module-specific extra filters (via children slot) */}
      {children}

      {/* Reset */}
      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground gap-1"
          onClick={onReset}
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}

export default ReportFilters;
