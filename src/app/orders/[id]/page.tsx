"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import * as mdi from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cancelOrderAction, completeOrderAction, getOrderDetail } from "@/src/app/actions/ordercloud";

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString?: string) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getStatusColor(status?: string) {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s === "open" || s === "submitted" || s === "awaitingapproval" || s === "processing" || s === "confirmed") return "primary";
  if (s === "completed" || s === "delivered" || s === "closed") return "success";
  if (s === "canceled" || s === "declined" || s === "problem" || s === "cancelled") return "danger";
  return "neutral";
}

function getDisplayStatus(order: any) {
  const s = order.Status?.toLowerCase();
  if (s === "open") return "OPEN";
  if (s === "completed") return "COMPLETED";
  if (s === "canceled") return "CANCELLED";

  return order.Status || "Unknown";
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) {
  return (
    <details className="group border border-sidebar-border rounded-md bg-body-bg" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between bg-muted px-4 py-3 font-semibold text-body-text outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        {title}
        <Icon
          path={mdi.mdiChevronDown}
          className="h-5 w-5 text-subtle-text transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="p-4 text-sm text-body-text">
        <div className="grid grid-cols-1 gap-x-12 gap-y-2 lg:grid-cols-2">
          {children}
        </div>
      </div>
    </details>
  );
}

function InfoRow({ label, value, type = "text", badgeColor }: { label: string, value: any, type?: "text" | "checkbox" | "date" | "datetime-local" | "textarea" | "badge", badgeColor?: any }) {
  return (
    <div className={`flex flex-col sm:flex-row ${type === "textarea" ? "sm:items-start" : "sm:items-center"} py-2 gap-2`}>
      <span className={`text-subtle-text font-medium sm:w-1/3 ${type === "textarea" ? "mt-2" : ""}`}>{label}</span>
      <div className={`sm:w-2/3 ${type === "checkbox" ? "flex items-center h-9" : ""}`}>
        {type === "checkbox" ? (
          <input type="checkbox" checked={Boolean(value)} disabled className="h-4 w-4 rounded border-sidebar-border text-primary focus:ring-primary" />
        ) : type === "textarea" ? (
          <textarea
            value={value || ""}
            readOnly
            className="w-full min-h-[80px] rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background cursor-default focus-visible:outline-none focus-visible:ring-0 focus-visible:border-sidebar-border"
          />
        ) : type === "badge" ? (
          <Badge colorScheme={badgeColor || "neutral"}>{String(value)}</Badge>
        ) : (
          <Input 
            type={type === "date" || type === "datetime-local" ? type : "text"}
            value={value || ""} 
            readOnly 
            className="h-9 bg-muted/50 cursor-default focus-visible:ring-0 focus-visible:border-sidebar-border" 
          />
        )}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getOrderDetail(id);
      if (response.success) {
        setOrder(response.data);
      } else {
        setError(response.error || "Failed to fetch order details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  async function handleCancelOrder() {
    if (!order?.ID || !cancelReason.trim()) return;

    setIsCancelling(true);
    try {
      const response = await cancelOrderAction(order.ID, cancelReason.trim(), cancelDetails.trim());
      if (!response.success) {
        throw new Error(response.error || "Failed to cancel order.");
      }

      setIsCancelModalOpen(false);
      setCancelReason("");
      setCancelDetails("");
      await fetchOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order.");
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCompleteOrder() {
    if (!order?.ID) return;

    setIsCompleting(true);
    try {
      const response = await completeOrderAction(order.ID);
      if (!response.success) {
        throw new Error(response.error || "Failed to complete order.");
      }

      await fetchOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete order.");
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-subtle-text">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary" />
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>
          <Icon path={mdi.mdiArrowLeft} className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          {error || "Order not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <Icon path={mdi.mdiArrowLeft} className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-body-text flex items-center gap-3">
            Order Details
            {getDisplayStatus(order) === "CANCELLED" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Badge colorScheme={getStatusColor(getDisplayStatus(order))} className="text-sm">
                      {getDisplayStatus(order)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Reason: {order.xp?.CancelReason || "N/A"}</p>
                    <p>Details: {order.xp?.CancelReasonDetail || "N/A"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Badge colorScheme={getStatusColor(getDisplayStatus(order))} className="text-sm">
                {getDisplayStatus(order)}
              </Badge>
            )}
          </h1>
          <p className="text-subtle-text">View detailed information for order {order.ID}</p>
        </div>
        {getDisplayStatus(order) !== "CANCELLED" ? (
          <div className="ml-auto flex items-center gap-3">
            {getDisplayStatus(order) !== "COMPLETED" ? (
              <Button onClick={() => void handleCompleteOrder()} disabled={isCompleting}>
                {isCompleting ? "Completing..." : "Complete Order"}
              </Button>
            ) : null}
            <Button colorScheme="danger" onClick={() => setIsCancelModalOpen(true)} disabled={isCancelling}>
              Cancel Order
            </Button>
          </div>
        ) : null}
      </div>
      <div className="space-y-4">
          <CollapsibleSection title="Order Information" defaultOpen={true}>
            <InfoRow label="Order Number" value={order.xp?.OrderNumber || order.ID} />
            <InfoRow label="Created Date" value={formatDate(order.DateCreated)} />
            <InfoRow label="Purchased Date" value={formatDate(order.DateSubmitted)} />
            <InfoRow label="Purchased From" value={order.xp?.PurchasedFrom || "en"} />
            <InfoRow label="Updated Date" value={formatDate(order.DateUpdated || order.DateCreated)} />
            <InfoRow label="Guest Customer" value={order.xp?.GuestCustomer ? "Yes" : "No"} />
            <InfoRow label="Status" value={getDisplayStatus(order)} type="badge" badgeColor={getStatusColor(getDisplayStatus(order))} />
            <InfoRow label="Cancel Reason" value={order.xp?.CancelReason || "N/A"} />
            <InfoRow label="Qty Ordered" value={order.LineItemCount || 0} />
            <InfoRow label="SubTotal" value={formatPrice(order.Subtotal || 0)} />
            <InfoRow label="Discount" value={formatPrice(order.PromotionDiscount || 0)} />
            <InfoRow label="Total Paid" value={formatPrice(order.Total || 0)} />
          </CollapsibleSection>

          <CollapsibleSection title="Customer Information">
            <InfoRow label="Customer ID" value={order.FromUser?.ID || "N/A"} />
            <InfoRow label="Customer Name" value={order.FromUser ? `${order.FromUser.FirstName || ""} ${order.FromUser.LastName || ""}`.trim() : "N/A"} />
            <InfoRow label="Customer Email Address" value={order.FromUser?.Email || "N/A"} />
          </CollapsibleSection>

          <CollapsibleSection title="Delivery Information">
            <InfoRow label="DeliveryMethod" value={order.xp?.DeliveryMethod || "STANDARD"} />
            <InfoRow label="DeliveryCost" value={order.xp?.DeliveryCost || "14.95"} />
            <InfoRow label="ETA" value={order.xp?.ETA ? new Date(order.xp.ETA).toISOString().slice(0, 10) : "2024-11-12"} type="date" />
            <InfoRow label="Delivery Instruction" value={order.xp?.DeliveryInstruction || ""} type="textarea" />
          </CollapsibleSection>

          <CollapsibleSection title="Payment Information">
            <InfoRow label="Payment Provider" value={order.PaymentInfo?.Provider || "N/A"} />
            <InfoRow label="Payment Method" value={order.PaymentInfo?.Method || "N/A"} />
            <InfoRow label="Payment Status" value={order.PaymentInfo?.Status || "N/A"} />
            <InfoRow label="Transaction RefID" value={order.PaymentInfo?.TransactionRefID || "N/A"} />
            <InfoRow label="Currency" value={order.PaymentInfo?.Currency || "USD"} />
          </CollapsibleSection>

          <CollapsibleSection title="Shipping Address">
            {order.ResolvedShippingAddress ? (
              <div className="space-y-1">
                <p>{order.ResolvedShippingAddress.FirstName} {order.ResolvedShippingAddress.LastName}</p>
                <p>{order.ResolvedShippingAddress.Street1}</p>
                {order.ResolvedShippingAddress.Street2 && <p>{order.ResolvedShippingAddress.Street2}</p>}
                <p>{order.ResolvedShippingAddress.City}</p>
                <p>{order.ResolvedShippingAddress.Country}</p>
              </div>
            ) : (
              <p className="text-subtle-text">No shipping address found (Order level ShippingAddressID is missing).</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Billing Address">
            {order.BillingAddress ? (
              <div className="space-y-1">
                <p>{order.BillingAddress.FirstName} {order.BillingAddress.LastName}</p>
                <p>{order.BillingAddress.Street1}</p>
                {order.BillingAddress.Street2 && <p>{order.BillingAddress.Street2}</p>}
                <p>{order.BillingAddress.City}</p>
                <p>{order.BillingAddress.Country}</p>
              </div>
            ) : (
              <p className="text-subtle-text">No billing address provided.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Applied Promotions & Coupons">
            {order.AppliedPromotions && order.AppliedPromotions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border border-sidebar-border rounded-md overflow-hidden">
                  <thead className="bg-muted">
                    <tr className="border-b border-sidebar-border">
                      <th className="px-3 py-2 font-semibold">PromotionID</th>
                      <th className="px-3 py-2 font-semibold">Promotion From</th>
                      <th className="px-3 py-2 font-semibold">CouponCode</th>
                      <th className="px-3 py-2 font-semibold">PromotionType</th>
                      <th className="px-3 py-2 font-semibold">DiscountAmount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.AppliedPromotions.map((promo: any) => (
                      <tr key={promo.ID} className="border-b border-sidebar-border/70 last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{promo.ID}</td>
                        <td className="px-3 py-2">{promo.xp?.PromotionFrom || "EC"}</td>
                        <td className="px-3 py-2">{promo.Code || ""}</td>
                        <td className="px-3 py-2">{promo.xp?.PromotionType || promo.Type || "PERCENTAGE"}</td>
                        <td className="px-3 py-2 font-medium text-destructive">-{formatPrice(promo.Amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-subtle-text italic">No promotions applied.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Items Ordered">
            {order.LineItems && order.LineItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border border-sidebar-border rounded-md overflow-hidden">
                  <thead className="bg-muted">
                    <tr className="border-b border-sidebar-border">
                      <th className="px-3 py-2 font-semibold">Product</th>
                      <th className="px-3 py-2 font-semibold">Qty</th>
                      <th className="px-3 py-2 font-semibold">Unit Price</th>
                      <th className="px-3 py-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.LineItems.map((item: any) => (
                      <tr key={item.ID} className="border-b border-sidebar-border/70 last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[200px]" title={item.Product?.Name}>{item.Product?.Name || item.ProductID}</p>
                        </td>
                        <td className="px-3 py-2">{item.Quantity}</td>
                        <td className="px-3 py-2">{formatPrice(item.UnitPrice)}</td>
                        <td className="px-3 py-2 font-medium">{formatPrice(item.LineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-subtle-text italic">No items found.</p>
            )}
          </CollapsibleSection>
        </div>

      {isCancelModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/35 px-4 py-16">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-body-text">Cancel Order</h2>
                <p className="mt-1 text-sm text-subtle-text">
                  Cancel order <span className="font-medium text-body-text">{order.ID}</span>?
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling}>
                <Icon path={mdi.mdiClose} className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-body-text" htmlFor="cancel-reason">
                  Reason
                </label>
                <Input
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Customer requested"
                  disabled={isCancelling}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-body-text" htmlFor="cancel-details">
                  Details
                </label>
                <textarea
                  id="cancel-details"
                  value={cancelDetails}
                  onChange={(event) => setCancelDetails(event.target.value)}
                  placeholder="Additional details"
                  disabled={isCancelling}
                  className="min-h-24 w-full rounded-md border border-input bg-body-bg px-3 py-2 text-sm text-body-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling}>
                Close
              </Button>
              <Button type="button" colorScheme="danger" onClick={() => void handleCancelOrder()} disabled={isCancelling || !cancelReason.trim()}>
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
  );
}
