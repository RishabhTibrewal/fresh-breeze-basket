import React, { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ordersService, Order } from "@/api/orders";
import { inventoryService, StockMovement } from "@/api/inventory";
import { creditPeriodService } from "@/api/creditPeriod";
import { invoicesService } from "@/api/invoices";
import { warehousesService } from "@/api/warehouses";
import { paymentsService, Payment } from "@/api/payments";
import { customerService } from "@/api/customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Edit,
  AlertTriangle,
  RotateCcw,
  Printer,
  Download,
  RefreshCw,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
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

  // Get warehouses for displaying warehouse info
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => warehousesService.getAll(true),
  });

  // Get credit period details
  const {
    data: creditPeriodData,
    isLoading: isLoadingCreditPeriod,
  } = useQuery({
    queryKey: ["creditPeriod", id],
    queryFn: () => creditPeriodService.getCreditPeriodByOrderId(id!),
    enabled:
      !!id &&
      !!order &&
      (order.payment_status === "full_credit" ||
        order.payment_status === "partial_payment" ||
        order.payment_status === "partial"),
  });

  // Fetch payments for this order
  const {
    data: payments = [],
    isLoading: isLoadingPayments,
  } = useQuery<Payment[]>({
    queryKey: ["order-payments", id],
    queryFn: async () => {
      if (!id) return [];
      try {
        return await paymentsService.getAll({ order_id: id });
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  // Fetch customer details to show customer name
  const {
    data: customerDetails,
  } = useQuery({
    queryKey: ["customer-by-user", order?.user_id],
    queryFn: async () => {
      if (!order?.user_id) return null;
      try {
        const response = await customerService.getCustomerByUserId(order.user_id);
        // Handle both direct response and wrapped response
        return response?.data || response;
      } catch {
        return null;
      }
    },
    enabled: !!order?.user_id,
  });

  const customerName = customerDetails?.name || 
    (customerDetails?.profile 
      ? `${customerDetails.profile.first_name || ''} ${customerDetails.profile.last_name || ''}`.trim()
      : null) ||
    (order as any)?.customer?.name ||
    order?.user_id || 
    "Guest / POS";

  const queryClient = useQueryClient();

  // Dialog states
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const [returnOrderOpen, setReturnOrderOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnReason, setReturnReason] = useState("");

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.put(`/orders/${id}/cancel`, {
        reason: cancelReason,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["order-document", id] });
      setCancelOrderOpen(false);
      setCancelReason("");
    },
    onError: (error: any) => {
      toast.error(
        `Failed to cancel order: ${error.response?.data?.error || error.message}`
      );
    },
  });

  // Create return order mutation
  const createReturnOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order?.order_items || order.order_items.length === 0) {
        throw new Error("No items to return");
      }

      const returnItems = (order.order_items || (order as any).items || []).map(
        (item: any) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
        })
      );

      const response = await apiClient.post("/orders/returns", {
        original_order_id: id,
        items: returnItems,
        reason: returnReason || "Return requested",
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Return order created successfully");
      // Refresh this order document and its linked returns
      queryClient.invalidateQueries({ queryKey: ["order-document", id] });
      queryClient.invalidateQueries({ queryKey: ["order-document-returns", id] });
      // Also refresh sales orders list so returns appear in /sales/orders
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      setReturnOrderOpen(false);
      setReturnReason("");
      if (data?.data?.id) {
        navigate(`${contextPrefix}/orders/${data.data.id}`);
      }
    },
    onError: (error: any) => {
      toast.error(
        `Failed to create return order: ${
          error.response?.data?.error || error.message
        }`
      );
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
            label: "Customer",
            value: customerName,
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
            {order.status !== "cancelled" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`${contextPrefix}/orders/${order.id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Order
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`${contextPrefix}/orders/${order.id}/edit`)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Payment
                </Button>
              </>
            )}
            {!isReturn &&
              order.order_type === "sales" &&
              order.status !== "cancelled" && (
                <Dialog open={returnOrderOpen} onOpenChange={setReturnOrderOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Return Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Return Order</DialogTitle>
                      <DialogDescription>
                        Create a return order for this order. All items will be returned.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Return Reason
                        </label>
                        <Textarea
                          placeholder="Enter reason for return..."
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Items to be returned:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {((order as any).order_items ||
                            (order as any).items ||
                            []).map((item: any) => (
                            <li key={item.id}>
                              {item.product?.name || `Product ${item.product_id}`} -
                              Qty: {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                <Button
                        onClick={() => createReturnOrderMutation.mutate()}
                        disabled={
                          createReturnOrderMutation.isPending ||
                          !returnReason.trim()
                        }
                >
                        {createReturnOrderMutation.isPending
                          ? "Creating..."
                          : "Create Return Order"}
                </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            <Button
              variant="outline"
                  size="sm"
              onClick={async () => {
                try {
                  const invoiceUrl = `${
                    import.meta.env.VITE_API_URL || ""
                  }/api/invoices/pos/${id}`;
                  window.open(invoiceUrl, "_blank");
                } catch (error) {
                  toast.error("Failed to open invoice");
                }
              }}
                >
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
                </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await invoicesService.downloadCustomerBill(id!);
                } catch (error) {
                  toast.error("Failed to download invoice");
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Invoice
            </Button>
            {order.status !== "cancelled" && (
              <Dialog open={cancelOrderOpen} onOpenChange={setCancelOrderOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Order</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel this order? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="Reason for cancellation"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Go Back</Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={() => cancelOrderMutation.mutate()}
                      disabled={cancelOrderMutation.isPending}
                    >
                      {cancelOrderMutation.isPending
                        ? "Cancelling..."
                        : "Cancel Order"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                  ? () => {
                      // Navigate to inventory module
                      navigate("/inventory/movements");
                    }
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
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="hidden md:table-cell">Warehouse</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((order as any).order_items || (order as any).items || []).map(
                      (item: any) => {
                        const warehouse = warehouses.find(
                          (w) => w.id === item.warehouse_id
                        );
                        const unitPrice = item.unit_price || 0;
                        const quantity = item.quantity || 0;
                        const subtotal = quantity * unitPrice;
                        const taxAmount = item.tax_amount || 0;
                        const lineTotal = subtotal + taxAmount;

                        return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {item.product?.name || item.product_id}
                            </span>
                                {item.variant_name && (
                                  <span className="text-xs text-muted-foreground">
                                    Variant: {item.variant_name}
                                  </span>
                                )}
                                {item.variant && !item.variant_name && (
                              <span className="text-xs text-muted-foreground">
                                {item.variant.name}
                              </span>
                            )}
                                {item.product_code && (
                                  <span className="text-xs text-muted-foreground">
                                    Code: {item.product_code}
                                  </span>
                                )}
                                {item.warehouse_id && (
                                  <span className="text-xs text-muted-foreground md:hidden">
                                    {warehouse
                                      ? `${warehouse.code} - ${warehouse.name}`
                                      : "Warehouse N/A"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                              {quantity}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {warehouse ? (
                                <div className="text-xs">
                                  <div className="font-medium">{warehouse.code}</div>
                                  <div className="text-muted-foreground">
                                    {warehouse.name}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                              ₹ {unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                              ₹ {Number(taxAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                              ₹ {lineTotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                        );
                      }
                  )}
                    <TableRow className="font-bold">
                      <TableCell colSpan={6} className="text-right">
                        Total
                      </TableCell>
                      <TableCell className="text-right">
                        ₹ {order.total_amount?.toFixed(2) ?? "0.00"}
                      </TableCell>
                    </TableRow>
                </TableBody>
              </Table>
              </div>
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">
                ₹ {order.total_amount?.toFixed(2) ?? "0.00"}
              </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium">
                    {order.payment_method
                      ? order.payment_method.charAt(0).toUpperCase() +
                        order.payment_method.slice(1)
                      : "N/A"}
              </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Status</p>
                  <div className="mt-1">
                    {order.payment_status === "full_payment" || order.payment_status === "paid" ? (
                      <Badge className="bg-green-600">Full Payment</Badge>
                    ) : order.payment_status === "partial_payment" ||
                      order.payment_status === "partial" ? (
                      <Badge className="bg-yellow-500">Partial Payment</Badge>
                    ) : order.payment_status === "full_credit" || order.payment_status === "credit" ? (
                      <Badge className="bg-blue-500">Full Credit</Badge>
                    ) : (
                      <Badge variant="outline">
                        {order.payment_status || "Pending"}
                      </Badge>
                    )}
                  </div>
                </div>
              {order.tracking_number && (
                  <div>
                    <p className="text-muted-foreground">Tracking Number</p>
                    <p className="font-medium">{order.tracking_number}</p>
                  </div>
                )}
              </div>

              {/* Payments Table */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-base font-medium mb-3">
                  Payment History
                </h4>
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : payments.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Cheque No</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {payment.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              {payment.payment_date
                                ? format(new Date(payment.payment_date), "MMM d, yyyy")
                                : format(new Date(payment.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              ₹ {parseFloat(payment.amount.toString()).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {payment.payment_method
                                ? payment.payment_method.charAt(0).toUpperCase() +
                                  payment.payment_method.slice(1)
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {payment.status === "completed" ? (
                                <Badge className="bg-green-600">Completed</Badge>
                              ) : payment.status === "pending" ? (
                                <Badge className="bg-yellow-500">Pending</Badge>
                              ) : payment.status === "failed" ? (
                                <Badge variant="destructive">Failed</Badge>
                              ) : payment.status === "refunded" ? (
                                <Badge variant="outline">Refunded</Badge>
                              ) : (
                                <Badge variant="outline">{payment.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.transaction_id || "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.cheque_no || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No payment records found for this order.
                  </div>
                )}
              </div>

              {/* Credit Period Table */}
              {creditPeriodData && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-base font-medium mb-3">
                    Credit Period Details
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium w-1/3">
                            Credit Period ID
                          </TableCell>
                          <TableCell>
                            {creditPeriodData.id.substring(0, 8)}...
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Amount</TableCell>
                          <TableCell>
                            ₹ {parseFloat(creditPeriodData.amount?.toString() || "0").toFixed(2)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Period</TableCell>
                          <TableCell>
                            {creditPeriodData.period || "N/A"} days
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Start Date</TableCell>
                          <TableCell>
                            {format(
                              new Date(creditPeriodData.start_date),
                              "MMM d, yyyy"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">End Date</TableCell>
                          <TableCell>
                            {format(
                              new Date(
                                creditPeriodData.end_date ||
                                  creditPeriodData.due_date
                              ),
                              "MMM d, yyyy"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Status</TableCell>
                          <TableCell>
                            {creditPeriodData.description ===
                            "Order Cancelled" ? (
                              <Badge
                                variant="outline"
                                className="bg-gray-400 text-white"
                              >
                                Cancelled
                              </Badge>
                            ) : new Date() >
                              new Date(
                                creditPeriodData.end_date ||
                                  creditPeriodData.due_date
                              ) ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : (
                              <Badge className="bg-green-600">Active</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {creditPeriodData.status && (
                          <TableRow>
                            <TableCell className="font-medium">
                              Payment Status
                            </TableCell>
                            <TableCell>
                              {creditPeriodData.status === "paid" ? (
                                <Badge className="bg-green-600">Paid</Badge>
                              ) : creditPeriodData.status === "partial" ? (
                                <Badge className="bg-yellow-500">
                                  Partially Paid
                                </Badge>
                              ) : (
                                <Badge variant="outline">Unpaid</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                        {creditPeriodData.description && (
                          <TableRow>
                            <TableCell className="font-medium">
                              Description
                            </TableCell>
                            <TableCell className="break-words">
                              {creditPeriodData.description}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell className="font-medium">Created At</TableCell>
                          <TableCell>
                            {format(
                              new Date(creditPeriodData.created_at),
                              "MMM d, yyyy, h:mm a"
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
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
                <h3 className="font-medium mb-2">Shipping Address</h3>
                {order.shipping_address ? (
                  <div className="p-3 bg-muted/50 rounded-md">
                    {(order.shipping_address as any).address_type && (
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                        {(order.shipping_address as any).address_type}
                      </p>
                    )}
                  <AddressBlock address={order.shipping_address as any} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No shipping address.
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-2">Billing Address</h3>
                {order.billing_address ? (
                  <div className="p-3 bg-muted/50 rounded-md">
                    {(order.billing_address as any).address_type && (
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                        {(order.billing_address as any).address_type}
                      </p>
                    )}
                  <AddressBlock address={order.billing_address as any} />
                  </div>
                ) : order.shipping_address ? (
                  <div className="text-muted-foreground text-sm italic">
                    Same as shipping address
                  </div>
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
          <div className="space-y-4">
            {/* Return Orders Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">
                  Return Orders
              </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {returnOrders?.length || 0} return order(s) created for this order
                </p>
            </CardHeader>
              <CardContent>
                {returnOrders && returnOrders.length > 0 ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Return Order #</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnOrders.map((returnOrder: any) => (
                            <TableRow key={returnOrder.id}>
                              <TableCell className="font-medium">
                                {returnOrder.order_number || returnOrder.id.substring(0, 8)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    returnOrder.status === "completed"
                                      ? "default"
                                      : returnOrder.status === "cancelled"
                                      ? "destructive"
                                      : "outline"
                                  }
                                >
                                  {returnOrder.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                ₹ {returnOrder.total_amount?.toFixed(2) || "0.00"}
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(returnOrder.created_at),
                                  "MMM d, yyyy"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                        navigate(
                                      `${contextPrefix}/orders/${returnOrder.id}`
                        )
                                  }
                                >
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`${contextPrefix}/orders/${order.id}/return`)
                      }
                    >
                      Create New Return
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      No return orders found for this order.
                    </p>
                    {!isReturn &&
                      order.order_type === "sales" &&
                      order.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(`${contextPrefix}/orders/${order.id}/return`)
                          }
                        >
                          Create Return Order
                        </Button>
                      )}
                  </div>
                )}
            </CardContent>
          </Card>

            {/* Stock Movements Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">
                  Stock Movements
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {stockMovements?.length || 0} inventory movement(s) linked to this order
                </p>
              </CardHeader>
              <CardContent>
                {stockMovements && stockMovements.length > 0 ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Movement Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockMovements.map((movement: any) => (
                            <TableRow key={movement.id}>
                              <TableCell className="font-medium">
                                {movement.product?.name || movement.product_id}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {movement.movement_type} {movement.quantity > 0 ? "IN" : "OUT"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {movement.quantity > 0 ? "+" : ""}
                                {movement.quantity}
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(movement.created_at),
                                  "MMM d, yyyy, h:mm a"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigate("/inventory/movements");
                                  }}
                                >
                                  View All
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate("/inventory/movements");
                      }}
                    >
                      View All Stock Movements
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      No stock movements found for this order.
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>
          </div>
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


