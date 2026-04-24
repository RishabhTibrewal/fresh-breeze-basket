import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { format, parse, isValid } from 'date-fns';
import type { ReportFilter } from '@/api/reports';
import { warehousesService } from '@/api/warehouses';

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
  showQuickRange?: boolean;
  showOrderSource?: boolean;
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
  const date = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

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
              // Use date-fns formatting from the selected local Date object to avoid UTC day-shift.
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
  showQuickRange = true,
  showOrderSource = true,
  hideDateRange = false,
  children,
}: ReportFiltersProps) {
  const { data: fetchedWarehouses = [] } = useQuery({
    queryKey: ['report-filter-warehouses'],
    queryFn: () => warehousesService.getAll(true),
    staleTime: 10 * 60 * 1000,
  });

  const branchOptions = branches.length
    ? branches
    : fetchedWarehouses.map((w) => ({ id: w.id, name: w.name }));

  const applyQuickRange = (preset: string) => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    if (preset === 'today') {
      onFilterChange('from_date', today);
      onFilterChange('to_date', today);
      return;
    }

    if (preset === 'yesterday') {
      const d = new Date(now);
      d.setDate(now.getDate() - 1);
      const y = format(d, 'yyyy-MM-dd');
      onFilterChange('from_date', y);
      onFilterChange('to_date', y);
      return;
    }

    if (preset === 'this_week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      onFilterChange('from_date', format(monday, 'yyyy-MM-dd'));
      onFilterChange('to_date', today);
      return;
    }

    if (preset === 'last_week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - diff);

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);

      onFilterChange('from_date', format(lastMonday, 'yyyy-MM-dd'));
      onFilterChange('to_date', format(lastSunday, 'yyyy-MM-dd'));
      return;
    }

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      onFilterChange('from_date', format(start, 'yyyy-MM-dd'));
      onFilterChange('to_date', format(end, 'yyyy-MM-dd'));
      return;
    }

    if (preset === 'mtd') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      onFilterChange('from_date', format(start, 'yyyy-MM-dd'));
      onFilterChange('to_date', today);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick date presets */}
      {!hideDateRange && showQuickRange && (
        <Select
          value="custom"
          onValueChange={(v) => {
            if (v !== 'custom') applyQuickRange(v);
          }}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="Quick Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Quick Range</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="last_week">Last Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="mtd">Month To Date</SelectItem>
          </SelectContent>
        </Select>
      )}

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
      {branchOptions.length > 0 && (
        <Select
          value={(filters.branch_ids as string[] | undefined)?.[0] ?? 'all'}
          onValueChange={(v) => onFilterChange('branch_ids', v === 'all' ? [] : [v])}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="All Outlet/Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outlet/Warehouse</SelectItem>
            {branchOptions.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Order source */}
      {showOrderSource && (
        <Select
          value={(filters.order_source as string | undefined) ?? 'all'}
          onValueChange={(v) => onFilterChange('order_source', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="pos">POS</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="ecommerce">Ecommerce</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
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
