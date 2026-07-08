"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";

  type PendingMember = {
  id: string;
  memberNumber: string;
  surname: string;
  otherNames: string;
  registrationDate: Date;
  occupation: string | null;
  approvalStatus: string;
  fingerprintTemplate?: string | null;
  user: {
    email: string | null;
    phone: string | null;
  };
};

export default function PendingMembersTable({
  members,
}: {
  members: PendingMember[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    memberId: string | null;
  }>({ open: false, memberId: null });
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async (memberId: string) => {
    setLoadingId(memberId);
    try {
      const res = await fetch(`/api/v1/members/${memberId}/approve`, { method: "PUT" });
      const result = await res.json();
      if (res.ok) {
        toast.success("Member approved successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to approve member");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRejectClick = (memberId: string) => {
    setRejectDialog({ open: true, memberId });
    setRejectionReason("");
  };

  const confirmReject = async () => {
    if (!rejectDialog.memberId) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setLoadingId(rejectDialog.memberId);
    try {
      const res = await fetch(`/api/v1/members/${rejectDialog.memberId}/approve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Member rejected");
        setRejectDialog({ open: false, memberId: null });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reject member");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoadingId(null);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        No pending members found.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Occupation</TableHead>
              <TableHead>Biometrics</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  <div>
                    {member.surname} {member.otherNames}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {member.memberNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{member.user.email}</div>
                  <div className="text-xs text-muted-foreground">{member.user.phone}</div>
                </TableCell>
                <TableCell>{member.occupation || "N/A"}</TableCell>
                <TableCell>
                  {member.fingerprintTemplate ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Fingerprint Enrolled
                    </Badge>
                  ) : (
                    <Badge variant="outline">No Fingerprint</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(member.registrationDate), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">Pending</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(member.id)}
                    disabled={loadingId === member.id || !member.fingerprintTemplate}
                    title={
                      member.fingerprintTemplate
                        ? "Approve member"
                        : "Fingerprint enrollment required before approval"
                    }
                  >
                    {loadingId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRejectClick(member.id)}
                    disabled={loadingId === member.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          setRejectDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Member Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this member application.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, memberId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={loadingId === rejectDialog.memberId}
            >
              {loadingId === rejectDialog.memberId ? (
                 <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
