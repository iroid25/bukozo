// app/dashboard/members/components/ApprovalButton.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
} from "lucide-react";

import { useRouter } from "next/navigation";

interface ApprovalButtonProps {
  memberId: string | null | undefined;
  isApproved: boolean;
  currentStatus?: "pending" | "approved" | "rejected";
  memberName?: string;
}

export default function ApprovalButton({
  memberId,
  isApproved,
  currentStatus = isApproved ? "approved" : "pending",
  memberName = "Member",
}: ApprovalButtonProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const router = useRouter();

  // Early return if memberId is null/undefined
  if (!memberId) {
    console.error("ApprovalButton: memberId is missing");
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        Error: Invalid Member ID
      </div>
    );
  }

  const handleApprove = async () => {
    if (!memberId) {
      toast.error("Invalid member ID");
      return;
    }

    setIsApproving(true);
    try {
      console.log("Approving member with ID:", memberId);
      const res = await fetch(`/api/v1/members/${memberId}/approve`, { method: "PUT" });
      const result = await res.json();
      if (!res.ok) {
        toast.error("Failed to approve member", { description: result.error });
      } else {
        toast.success("Member approved successfully!", {
          description: `${memberName} has been approved and can now access SACCO services.`,
        });
        router.refresh();
      }
    } catch (error) {
      console.error("Error in handleApprove:", error);
      toast.error("Something went wrong", {
        description: "Please try again later.",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!memberId) {
      toast.error("Invalid member ID");
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setIsRejecting(true);
    try {
      console.log("Rejecting member with ID:", memberId);
      const res = await fetch(`/api/v1/members/${memberId}/approve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error("Failed to reject member", { description: result.error });
      } else {
        toast.success("Member application rejected", {
          description: `${memberName}'s application has been rejected.`,
        });
        setShowRejectDialog(false);
        setRejectionReason("");
        router.refresh();
      }
    } catch (error) {
      console.error("Error in handleReject:", error);
      toast.error("Something went wrong", {
        description: "Please try again later.",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Status indicator component
  const StatusBadge = () => {
    switch (currentStatus) {
      case "approved":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Approved
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            <XCircle className="h-4 w-4" />
            Rejected
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <Clock className="h-4 w-4" />
            Pending Approval
          </div>
        );
    }
  };

  // If already approved, show status and limited actions
  if (currentStatus === "approved") {
    return (
      <div className="flex items-center gap-3">
        <StatusBadge />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Actions <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setShowRejectDialog(true)}
              className="text-red-600 focus:text-red-600"
            >
              <UserX className="h-4 w-4 mr-2" />
              Revoke Approval
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // If rejected, show status and option to approve
  if (currentStatus === "rejected") {
    return (
      <div className="flex items-center gap-3">
        <StatusBadge />
        <Button
          onClick={handleApprove}
          disabled={isApproving}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {isApproving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Approving...
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4 mr-2" />
              Approve Now
            </>
          )}
        </Button>
      </div>
    );
  }

  // Pending status - show approval options
  return (
    <div className="flex items-center gap-3">
      <StatusBadge />

      {/* Approval Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {isApproving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Approving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </>
          )}
        </Button>

        <Button
          onClick={() => setShowRejectDialog(true)}
          disabled={isApproving || isRejecting}
          variant="destructive"
          size="sm"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Reject Member Application
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {memberName}'s membership
              application. This action will notify the applicant and can be
              reversed later if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-3">
              <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Please provide a detailed reason for rejecting this application..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                This reason will be recorded and may be shared with the
                applicant.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isRejecting}
            >
              {isRejecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Rejecting...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Reject Application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
