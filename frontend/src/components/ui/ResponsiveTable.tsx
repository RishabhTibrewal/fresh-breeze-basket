import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  mobileHide?: boolean; // Hide this column on mobile
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  renderCard?: (item: T) => React.ReactNode;
  renderRow?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function ResponsiveTable<T extends { id: string }>({
  columns,
  data,
  renderCard,
  renderRow,
  emptyMessage = 'No data available',
  className,
  onRowClick,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  // Mobile: Card layout
  if (isMobile) {
    if (renderCard) {
      return (
        <div className={cn('space-y-4', className)}>
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
          ) : (
            data.map((item) => (
              <div key={item.id} onClick={() => onRowClick?.(item)}>
                {renderCard(item)}
              </div>
            ))
          )}
        </div>
      );
    }

    // Default card rendering
    return (
      <div className={cn('space-y-4', className)}>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
        ) : (
          data.map((item) => (
            <Card
              key={item.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-accent',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(item)}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  {columns
                    .filter(col => !col.mobileHide)
                    .map((column) => (
                      <div key={column.key} className="flex justify-between items-start gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {column.header}:
                        </span>
                        <span className="text-sm text-right flex-1">
                          {column.render ? column.render(item) : (item as any)[column.key]}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Desktop: Table layout
  if (renderRow) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(item)}
                >
                  {renderRow(item)}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Default table rendering
  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item.id}
                className={onRowClick ? 'cursor-pointer hover:bg-accent' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

