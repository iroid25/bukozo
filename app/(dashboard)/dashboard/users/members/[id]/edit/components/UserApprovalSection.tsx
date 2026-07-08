// components/UserApprovalSection.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UserApprovalSectionProps {
  userId: string;
  userName: string;
  userRole: string;
  isApproved: boolean;
  isActive: boolean;
}

export function UserApprovalSection({
  userId,
  userName,
  userRole,
  isApproved,
  isActive,
}: UserApprovalSectionProps) {
  const router = useRouter();
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // If already approved, show approved status
  if (isApproved) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <span className="font-semibold">{userName}</span> has been approved
          and can now perform transactions.
        </AlertDescription>
      </Alert>
    );
  }

  // If rejected (not approved and not active)
  if (!isApproved && !isActive) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <span className="font-semibold">{userName}</span> has been rejected
          and cannot perform transactions.
        </AlertDescription>
      </Alert>
    );
  }

  // Pending approval
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/v1/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      const result = await res.json();

      if (res.ok) {
        toast.success("User approved successfully");
        setIsApproveDialogOpen(false);
        setApprovalNotes("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to approve user");
      }
    } catch (error) {
      toast.error("An error occurred while approving user");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsRejecting(true);
    try {
      const res = await fetch(`/api/v1/users/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason }),
      });
      const result = await res.json();

      if (res.ok) {
        toast.success("User rejected");
        setIsRejectDialogOpen(false);
        setRejectionReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reject user");
      }
    } catch (error) {
      toast.error("An error occurred while rejecting user");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <>
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <div className="flex items-center justify-between w-full">
          <AlertDescription className="text-yellow-800 flex-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                <span className="font-semibold">{userName}</span> is pending
                approval. Review their information and approve or reject their
                account.
              </span>
            </div>
          </AlertDescription>
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setIsRejectDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setIsApproveDialogOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      </Alert>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
            <DialogDescription>
              You are about to approve <strong>{userName}</strong>. They will be
              able to perform transactions after approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Approval Notes (Optional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Add any notes about this approval..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject User</DialogTitle>
            <DialogDescription>
              You are about to reject <strong>{userName}</strong>. Please
              provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this user is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
              variant="destructive"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
