import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ordersService, Order } from "@/api/orders";
import { inventoryService, StockMovement } from "@/api/inventory";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import DocumentHeader from "@/components/documents/DocumentHeader";
import StatusBadge from "@/components/documents/StatusBadge";
import LinkedDocumentCard from "@/components/documents/LinkedDocumentCard";
import ActivityTimeline, {
  TimelineEvent,
} from "@/components/documents/ActivityTimeline";
import StatusStepper from "@/components/documents/StatusStepper";

type RouteParams = {
  id?: string;
  orderId?: string;
};

export default function OrderDocumentPage() {
  const params = useParams<RouteParams>();
  const navigate = useNavigate();
  const location = useLocation();

  const id = params.id || params.orderId;

  const contextPrefix = React.useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/admin")) return "/admin";
    if (path.startsWith("/sales")) return "/sales";
    if (path.startsWith("/account")) return "/account";
    return "/admin";
  }, [location.pathname]);

  const {
    data: order,
    isLoading,
    isError,
    error,
  } = useQuery<Order>({
    queryKey: ["order-document", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Missing order id");
      return ordersService.getById(id);
    },
  });

  const {
    data: returnOrders,
  } = useQuery<Order[]>({
    queryKey: ["order-document-returns", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return [];
      try {
        const res = await ordersService.getAll({
          order_type: "return",
          original_order_id: id,
          limit: 50,
          page: 1,
        });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const {
    data: stockMovements,
  } = useQuery<StockMovement[]>({
    queryKey: ["order-document-stock-movements", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return [];
      try {
        // Backend may or may not support reference filters yet; fallback is safe.
        const res = await inventoryService.getStockMovements();
        return res.filter(
          (m) => m.reference_type === "order" && m.reference_id === id
        );
      } catch {
        return [];
      }
    },
  });

  if (!id) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-red-600">Missing order id in the URL.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <p className="text-sm text-red-600">
          {(error as any)?.message || "Failed to load order"}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    );
  }

  const isReturn = order.order_type === "return";
  const displayNumber = (order as any).order_number || order.id.slice(0, 8);
  const createdAt = new Date(order.created_at);

  const handleCreateReturn = () => {
    navigate(`${contextPrefix}/orders/${order.id}/return`);
  };

  const timelineEvents: TimelineEvent[] = buildTimelineEvents(
    order,
    stockMovements || []
  );

  return (
    <div className="container mx-auto py-6 space-y-4">
      <DocumentHeader
        title={
          isReturn
            ? `Return Order #${displayNumber}`
            : `Order #${displayNumber}`
        }
        subtitle={`Created on ${createdAt.toLocaleString()}`}
        badges={
          <>
            <StatusBadge kind="order_status" value={order.status} />
            <StatusBadge kind="order_type" value={order.order_type} />
            <StatusBadge kind="order_source" value={order.order_source} />
            <StatusBadge
              kind="fulfillment_type"
              value={order.fulfillment_type}
            />
          </>
        }
        metadata={[
          {
            label: "Total Amount",
            value: `₹ ${order.total_amount?.toFixed(2) ?? "0.00"}`,
          },
          {
            label: "Payment Status",
            value: order.payment_status || "N/A",
          },
          {
            label: "User ID",
            value: order.user_id || "Guest / POS",
          },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
            {!isReturn &&
              order.order_type === "sales" &&
              order.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleCreateReturn}
                >
                  Create Return
                </Button>
              )}
          </div>
        }
        links={
          <>
            <LinkedDocumentCard
              title="Return Orders"
              count={returnOrders?.length || 0}
              description="Linked returns for this order"
              onClick={
                returnOrders && returnOrders.length > 0
                  ? () =>
                      navigate(`${contextPrefix}/orders/${order.id}/return`)
                  : undefined
              }
            />
            <LinkedDocumentCard
              title="Stock Movements"
              count={stockMovements?.length || 0}
              description="Inventory impact for this order"
              onClick={
                stockMovements && stockMovements.length > 0
                  ? () => navigate("/admin/inventory/movements")
                  : undefined
              }
            />
          </>
        }
      />

      {isReturn && (
        <div className="flex justify-between items-center">
          <StatusStepper
            steps={["pending", "processing", "completed"]}
            current={order.status}
          />
          {(order as any).original_order_id && (
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                navigate(
                  `${contextPrefix}/orders/${(order as any).original_order_id}`
                )
              }
            >
              View Original Order
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="linked">Linked</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Order Type: </span>
                {order.order_type || "sales"}
              </p>
              <p>
                <span className="text-muted-foreground">Order Source: </span>
                {order.order_source || "ecommerce"}
              </p>
              <p>
                <span className="text-muted-foreground">Fulfillment: </span>
                {order.fulfillment_type || "delivery"}
              </p>
              {order.notes && (
                <p>
                  <span className="text-muted-foreground">Notes: </span>
                  {order.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((order as any).order_items || (order as any).items || []).map(
                    (item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {item.product?.name || item.product_id}
                            </span>
                            {item.variant && (
                              <span className="text-xs text-muted-foreground">
                                {item.variant.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ₹ {(item.unit_price || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ₹ {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Total: </span>
                ₹ {order.total_amount?.toFixed(2) ?? "0.00"}
              </p>
              <p>
                <span className="text-muted-foreground">Payment Method: </span>
                {order.payment_method || "N/A"}
              </p>
              <p>
                <span className="text-muted-foreground">Payment Status: </span>
                {order.payment_status || "N/A"}
              </p>
              {order.tracking_number && (
                <p>
                  <span className="text-muted-foreground">Tracking: </span>
                  {order.tracking_number}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-1">Shipping Address</h3>
                {order.shipping_address ? (
                  <AddressBlock address={order.shipping_address as any} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No shipping address.
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-1">Billing Address</h3>
                {order.billing_address ? (
                  <AddressBlock address={order.billing_address as any} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No billing address.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linked">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Linked Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <LinkedDocumentCard
                title="Return Orders"
                count={returnOrders?.length || 0}
                description="Returns created against this order"
                onClick={
                  returnOrders && returnOrders.length > 0
                    ? () =>
                        navigate(
                          `${contextPrefix}/orders/${order.id}/return`
                        )
                    : undefined
                }
              />
              <LinkedDocumentCard
                title="Stock Movements"
                count={stockMovements?.length || 0}
                description="Inventory movements linked to this order"
                onClick={
                  stockMovements && stockMovements.length > 0
                    ? () => navigate("/admin/inventory/movements")
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline events={timelineEvents} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddressBlock({ address }: { address: any }) {
  return (
    <div className="space-y-1 text-sm">
      <div>{address.address_line1}</div>
      {address.address_line2 && <div>{address.address_line2}</div>}
      <div>
        {address.city}
        {address.state ? `, ${address.state}` : ""} {address.postal_code || ""}
      </div>
      <div>{address.country}</div>
    </div>
  );
}

function buildTimelineEvents(
  order: Order,
  movements: StockMovement[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: "created",
    at: order.created_at,
    type: "system",
    title: "Order created",
    description: `Status: ${order.status}`,
  });

  if (order.updated_at && order.updated_at !== order.created_at) {
    events.push({
      id: "updated",
      at: order.updated_at,
      type: "status",
      title: "Order updated",
      description: `Current status: ${order.status}`,
    });
  }

  movements.forEach((m) => {
    events.push({
      id: m.id,
      at: m.created_at,
      type: "stock",
      title: `${m.movement_type} ${m.quantity > 0 ? "IN" : "OUT"}`,
      description: `Product: ${m.product?.name || m.product_id}, Qty: ${
        m.quantity
      }`,
    });
  });

  return events;
}


