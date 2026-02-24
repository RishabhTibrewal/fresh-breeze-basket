import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ordersService, Order } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import DocumentHeader from "@/components/documents/DocumentHeader";
import StatusBadge from "@/components/documents/StatusBadge";
import ReturnItemsTable, {
  ReturnItemInput,
  ReturnQuantityMap,
} from "@/components/documents/ReturnItemsTable";

type RouteParams = {
  id?: string;
  orderId?: string;
};

interface ReturnOrderItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  warehouse_id?: string | null;
}

export default function CreateReturnOrderPage() {
  const params = useParams<RouteParams>();
  const navigate = useNavigate();
  const location = useLocation();

  const originalOrderId = params.id || params.orderId;

  const [quantities, setQuantities] = useState<ReturnQuantityMap>({});
  const [reason, setReason] = useState("");

  const contextPrefix = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/admin")) return "/admin";
    if (path.startsWith("/sales")) return "/sales";
    if (path.startsWith("/account")) return "/account";
    return "/admin";
  }, [location.pathname]);

  const {
    data: originalOrder,
    isLoading: isLoadingOrder,
    isError: isOrderError,
    error: orderError,
  } = useQuery<Order>({
    queryKey: ["return-original-order", originalOrderId],
    enabled: !!originalOrderId,
    queryFn: async () => {
      if (!originalOrderId) {
        throw new Error("Missing original order id");
      }
      return ordersService.getById(originalOrderId);
    },
  });

  const {
    data: existingReturnsData,
    isLoading: isLoadingReturns,
  } = useQuery({
    queryKey: ["return-orders", originalOrderId],
    enabled: !!originalOrderId,
    queryFn: async () => {
      if (!originalOrderId) return [];
      try {
        const res = await ordersService.getAll({
          order_type: "return",
          original_order_id: originalOrderId,
          limit: 50,
          page: 1,
        });
        return res.data;
      } catch (e) {
        console.warn("Unable to fetch existing returns (may be role-limited):", e);
        return [];
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!originalOrderId) throw new Error("Missing original order id");
      if (!originalOrder) throw new Error("Original order not loaded");

      const payloadItems: ReturnOrderItem[] = buildReturnPayloadItems(
        originalOrder,
        existingReturnsData || [],
        quantities
      );

      if (payloadItems.length === 0) {
        throw new Error("Please enter a return quantity for at least one item.");
      }

      return ordersService.createReturn({
        original_order_id: originalOrderId,
        items: payloadItems.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id || undefined,
          quantity: i.quantity,
        })),
        reason: reason || undefined,
      });
    },
    onSuccess: (returnOrder) => {
      toast.success("Return order created successfully");
      // Redirect to the new return order detail page in the same context
      navigate(`${contextPrefix}/orders/${returnOrder.id}`);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create return order";
      toast.error(msg);
    },
  });

  const { itemsForTable, hasRemaining, validationError } = useMemo(() => {
    if (!originalOrder) {
      return { itemsForTable: [] as ReturnItemInput[], hasRemaining: false, validationError: null as string | null };
    }
    try {
      const result = buildReturnItems(originalOrder, existingReturnsData || []);
      return { itemsForTable: result.items, hasRemaining: result.hasRemaining, validationError: null };
    } catch (e: any) {
      return {
        itemsForTable: [],
        hasRemaining: false,
        validationError: e?.message || "Unable to compute remaining quantities",
      };
    }
  }, [originalOrder, existingReturnsData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalOrder) return;

    if (!hasRemaining) {
      toast.error("All items from this order have already been fully returned.");
      return;
    }

    // Client-side validation: ensure no qty exceeds max
    const overMax = itemsForTable.some((item) => {
      const key = `${item.product_id}_${item.variant_id || "default"}`;
      const qty = quantities[key] || 0;
      return qty > item.maxQty;
    });

    if (overMax) {
      toast.error("One or more rows have return quantity greater than available.");
      return;
    }

    mutation.mutate();
  };

  if (!originalOrderId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-red-600">
          Missing original order id in the URL.
        </p>
      </div>
    );
  }

  if (isLoadingOrder) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isOrderError || !originalOrder) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-red-600 mb-4">
          {(orderError as any)?.message || "Failed to load original order"}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const isSalesOrder = originalOrder.order_type === "sales";

  return (
    <div className="container mx-auto py-6 space-y-4">
      <DocumentHeader
        title={
          isSalesOrder
            ? `Create Return for Order #${(originalOrder as any).order_number || originalOrder.id.slice(0, 8)}`
            : `Create Return`
        }
        subtitle={`Original status: ${originalOrder.status} • Placed on ${new Date(
          originalOrder.created_at
        ).toLocaleString()}`}
        badges={
          <>
            <StatusBadge kind="order_type" value={originalOrder.order_type} />
            <StatusBadge
              kind="order_source"
              value={originalOrder.order_source}
            />
            <StatusBadge
              kind="fulfillment_type"
              value={originalOrder.fulfillment_type}
            />
          </>
        }
        metadata={[
          {
            label: "Original Total",
            value: `₹ ${originalOrder.total_amount?.toFixed(2) ?? "0.00"}`,
          },
          {
            label: "Payment Status",
            value: originalOrder.payment_status || "N/A",
          },
          {
            label: "Order Type",
            value: originalOrder.order_type || "sales",
          },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      {!isSalesOrder && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-3 text-sm text-yellow-900">
            Returns are only supported for sales orders. This order has type{" "}
            <strong>{originalOrder.order_type}</strong>.
          </CardContent>
        </Card>
      )}

      {validationError && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 text-sm text-red-900">
            {validationError}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Items to Return
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingReturns && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Checking existing returns...
              </div>
            )}

            <ReturnItemsTable
              items={itemsForTable}
              value={quantities}
              onChange={setQuantities}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full min-h-[80px] text-sm border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Optional: describe why the customer is returning these items..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !isSalesOrder}
          >
            {mutation.isPending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Creating Return...
              </>
            ) : (
              "Create Return"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function buildReturnItems(
  originalOrder: Order,
  existingReturns: Order[]
): { items: ReturnItemInput[]; hasRemaining: boolean } {
  const baseItems: any[] = (originalOrder as any).order_items || (originalOrder as any).items || [];

  const originalTotals = new Map<string, { qty: number; unit_price: number }>();
  for (const item of baseItems) {
    const key = `${item.product_id}_${item.variant_id || "default"}`;
    const current = originalTotals.get(key) || { qty: 0, unit_price: item.unit_price || 0 };
    current.qty += item.quantity || 0;
    current.unit_price = item.unit_price || current.unit_price || 0;
    originalTotals.set(key, current);
  }

  const returnedTotals = new Map<string, number>();
  for (const ret of existingReturns) {
    const retItems: any[] = (ret as any).order_items || (ret as any).items || [];
    for (const item of retItems) {
      const key = `${item.product_id}_${item.variant_id || "default"}`;
      const current = returnedTotals.get(key) || 0;
      returnedTotals.set(key, current + (item.quantity || 0));
    }
  }

  const result: ReturnItemInput[] = [];
  let hasRemaining = false;

  for (const [key, orig] of originalTotals.entries()) {
    const [product_id, variantKey] = key.split("_");
    const returned = returnedTotals.get(key) || 0;
    const remaining = Math.max(0, orig.qty - returned);
    if (remaining <= 0) continue;

    hasRemaining = true;
    result.push({
      product_id,
      variant_id: variantKey === "default" ? undefined : variantKey,
      name: undefined,
      unit_price: orig.unit_price || 0,
      maxQty: remaining,
    });
  }

  return { items: result, hasRemaining };
}

function buildReturnPayloadItems(
  originalOrder: Order,
  existingReturns: Order[],
  quantities: ReturnQuantityMap
): ReturnOrderItem[] {
  const { items } = buildReturnItems(originalOrder, existingReturns);
  const payload: ReturnOrderItem[] = [];

  for (const item of items) {
    const key = `${item.product_id}_${item.variant_id || "default"}`;
    const qty = quantities[key] || 0;
    if (!qty || qty <= 0) continue;

    payload.push({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: qty,
      unit_price: item.unit_price,
      warehouse_id: undefined,
    });
  }

  return payload;
}


