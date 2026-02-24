import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ReturnItemInput {
  product_id: string;
  variant_id?: string;
  name?: string;
  unit_price: number;
  maxQty: number;
  warehouse_id?: string;
}

export type ReturnQuantityMap = Record<string, number>;

export interface ReturnItemsTableProps {
  items: ReturnItemInput[];
  value: ReturnQuantityMap;
  onChange: (next: ReturnQuantityMap) => void;
}

function keyFor(item: ReturnItemInput): string {
  return `${item.product_id}_${item.variant_id || "default"}`;
}

export const ReturnItemsTable: React.FC<ReturnItemsTableProps> = ({
  items,
  value,
  onChange,
}) => {
  const handleQtyChange = (item: ReturnItemInput, qtyStr: string) => {
    const k = keyFor(item);
    const parsed = parseFloat(qtyStr);
    const next = { ...value };
    if (!qtyStr || isNaN(parsed) || parsed <= 0) {
      delete next[k];
    } else {
      next[k] = parsed;
    }
    onChange(next);
  };

  const getRowState = (item: ReturnItemInput) => {
    const qty = value[keyFor(item)] || 0;
    if (!qty) return "empty";
    if (qty > item.maxQty) return "invalid";
    return "valid";
  };

  const total = items.reduce((sum, item) => {
    const qty = value[keyFor(item)] || 0;
    return sum + qty * item.unit_price;
  }, 0);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-24 text-right">Max</TableHead>
            <TableHead className="w-32 text-right">Return Qty</TableHead>
            <TableHead className="w-28 text-right">Rate</TableHead>
            <TableHead className="w-32 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const k = keyFor(item);
            const qty = value[k] || 0;
            const rowState = getRowState(item);
            const amount = qty * item.unit_price;
            return (
              <TableRow
                key={k}
                className={cn(
                  rowState === "invalid" && "bg-destructive/5",
                  rowState === "valid" && "bg-emerald-50/40"
                )}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {item.name || item.product_id}
                    </span>
                    {item.variant_id && (
                      <span className="text-xs text-muted-foreground">
                        Variant: {item.variant_id}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {item.maxQty}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    max={item.maxQty}
                    step={1}
                    value={qty || ""}
                    onChange={(e) => handleQtyChange(item, e.target.value)}
                    className={cn(
                      "h-8 text-right",
                      rowState === "invalid" && "border-destructive text-destructive"
                    )}
                  />
                </TableCell>
                <TableCell className="text-right text-sm">
                  ₹ {item.unit_price.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ₹ {amount ? amount.toFixed(2) : "0.00"}
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm py-4">
                No items available for return.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-end text-sm font-semibold">
        <span className="mr-2 text-muted-foreground">Total Refund:</span>
        <span>₹ {total.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default ReturnItemsTable;


