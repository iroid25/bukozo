"use client";

// ============================================
// FILE: components/reconciliation/ActionDialog.tsx
// ============================================
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Reconciliation } from "@/types/reconciliation";

interface ActionDialogProps {
  reconciliation: Reconciliation | null;
  actionType: "approve" | "reject" | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

export function ActionDialog({
  reconciliation,
  actionType,
  isLoading,
  onClose,
  onConfirm,
}: ActionDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNotes("");
      onClose();
    }
  };

  const isApproval = actionType === "approve";
  const tellerName =
    (reconciliation as any)?.float?.user?.name ||
    reconciliation?.floatId ||
    "Unknown";

  return (
    <Dialog open={reconciliation !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApproval ? "Approve" : "Reject"} Reconciliation
          </DialogTitle>
          <DialogDescription>For {tellerName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>
              {isApproval
                ? "Approval Notes (Optional)"
                : "Rejection Reason (Required)"}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isApproval
                  ? "Add any notes about this approval..."
                  : "Explain why this reconciliation is being rejected..."
              }
              rows={4}
            />
          </div>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (!isApproval && !notes.trim())}
            className={`w-full ${
              isApproval
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isLoading
              ? "Processing..."
              : isApproval
                ? "Approve Reconciliation"
                : "Reject Reconciliation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
