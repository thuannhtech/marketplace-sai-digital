"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelOrderAction, confirmOrderAction, completeOrderAction, updateOrderAction } from "@/src/app/actions/ordercloud";

export default function OrderActions({
  order,
  displayStatus,
  onOrderUpdated,
}: {
  order: any;
  displayStatus: string;
  onOrderUpdated?: () => Promise<void> | void;
}) {
  const router = useRouter();
  
  // Modals state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  // Form states
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [sapSaleOrderID, setSapSaleOrderID] = useState(order.xp?.SAPSaleOrderID || "");
  const [isUpdating, setIsUpdating] = useState(false);

  // Actions
  const handleCancel = async () => {
    setIsUpdating(true);
    const res = await cancelOrderAction(order.ID, cancelReason, cancelDetails);
    setIsUpdating(false);
    if (res.success) {
      setIsCancelModalOpen(false);
      await onOrderUpdated?.();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleConfirm = async () => {
    if (!sapSaleOrderID) {
      alert("SAP Sale Order ID is required to confirm.");
      return;
    }
    setIsUpdating(true);
    const res = await confirmOrderAction(order.ID, sapSaleOrderID);
    setIsUpdating(false);
    if (res.success) {
      setIsConfirmModalOpen(false);
      await onOrderUpdated?.();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Are you sure you want to complete this order?")) return;
    setIsUpdating(true);
    const res = await completeOrderAction(order.ID);
    setIsUpdating(false);
    if (res.success) {
      await onOrderUpdated?.();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleManualUpdate = async () => {
    const payload = { xp: { SAPSaleOrderID: sapSaleOrderID } };
    setIsUpdating(true);
    const res = await updateOrderAction(order.ID, payload);
    setIsUpdating(false);
    if (res.success) {
      alert("Order updated successfully!");
      await onOrderUpdated?.();
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleCreditMemo = () => {
    alert("Navigating to Credit Memo creation/edit page...");
  };

  const canCancel = ["PROCESSING", "CONFIRMED", "COMPLETED"].includes(displayStatus);
  const canConfirm = displayStatus === "PROCESSING";
  const canComplete = displayStatus === "CONFIRMED";
  const isCancelled = displayStatus === "CANCELLED";
  const isClosed = displayStatus === "CLOSED";

  const hasMemo = order.xp?.CreditMemoExists; 
  const memoRejected = order.xp?.CreditMemoStatus === "REJECTED";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-sidebar-border rounded-xl shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-subtle-text mr-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Order Actions
        </h2>

        {canCancel && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setIsCancelModalOpen(true)} 
            disabled={isUpdating}
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-sm transition-all hover:shadow-md border-0"
          >
            Cancel Order
          </Button>
        )}

        {canConfirm && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => {
              if (order.xp?.SAPSaleOrderID) handleConfirm();
              else setIsConfirmModalOpen(true);
            }} 
            disabled={isUpdating} 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-sm transition-all hover:shadow-md border-0"
          >
            Confirm Order
          </Button>
        )}

        {canComplete && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleComplete} 
            disabled={isUpdating} 
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-sm transition-all hover:shadow-md border-0"
          >
            Complete Order
          </Button>
        )}

        {isCancelled && !isClosed && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCreditMemo}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300 transition-colors"
          >
             {(!hasMemo || memoRejected) ? "Create Credit Memo" : "Edit Credit Memo"}
          </Button>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualUpdate} 
          disabled={isUpdating}
          className="border-sidebar-border hover:bg-muted/50 text-body-text transition-colors"
        >
          Update
        </Button>
      </div>

      {/* Cancel Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="E.g., Customer requested" />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <textarea 
                className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={cancelDetails} 
                onChange={(e) => setCancelDetails(e.target.value)} 
                placeholder="Additional details..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Close</Button>
            <Button colorScheme="danger" onClick={handleCancel} disabled={!cancelReason || isUpdating}>Confirm Cancellation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Modal (if SAPSaleOrderID is missing) */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">This order is missing a SAP Sale Order ID. Please provide it before confirming.</p>
            <div className="space-y-2">
              <Label>SAP Sale Order ID <span className="text-destructive">*</span></Label>
              <Input value={sapSaleOrderID} onChange={(e) => setSapSaleOrderID(e.target.value)} placeholder="Enter SAP ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>Close</Button>
            <Button onClick={handleConfirm} disabled={!sapSaleOrderID || isUpdating} className="bg-primary hover:bg-primary/90">Confirm Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
