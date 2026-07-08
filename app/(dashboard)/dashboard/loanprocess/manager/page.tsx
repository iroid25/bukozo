"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ManagerLoansPage() {
  const { data: session } = useSession();
  const [apps, setApps] = useState<any[]>([]);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [tellerId, setTellerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = async () => {
    try {
      const res = await fetch("/api/v1/loans/applications/manager-queue");
      if (!res.ok) {
        toast.error("Failed to load approval queue");
        return;
      }
      const json = await res.json();
      setApps(json.data || []);
    } catch {
      toast.error("Network error loading approval queue");
    }
  };

  useEffect(() => {
    loadQueue();
  }, [session]);

  function openApprove(a: any) {
    setSelected(a);
    setApprovedAmount(Number(a.amountApplied) || 0);
    setTellerId("");
    setApproveOpen(true);
  }

  function openReject(a: any) {
    setSelected(a);
    setRejectOpen(true);
  }

  async function approve() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/loans/applications/${selected.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          amountGranted: approvedAmount,
          loanOfficerId: tellerId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to approve application");
        return;
      }
      toast.success("Application approved");
      setApproveOpen(false);
      loadQueue();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function reject(reason: string) {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/loans/applications/${selected.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to reject application");
        return;
      }
      toast.success("Application rejected");
      setRejectOpen(false);
      loadQueue();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Manager – Approvals</h1>
      <Card>
        <CardHeader><CardTitle>Waiting for Approval</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {apps.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{a.member?.user?.name ?? "—"}</div>
                    {a.isInstitution && (
                      <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Institution</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{a.loanProduct?.name} • Requested UGX {Number(a.amountApplied).toLocaleString()}</div>
                  {a.member?.memberNumber && (
                    <div className="text-xs text-muted-foreground font-mono">#{a.member.memberNumber}</div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => openApprove(a)}>Approve</Button>
                  <Button variant="destructive" onClick={() => openReject(a)}>Reject</Button>
                </div>
              </div>
            ))}
            {apps.length === 0 && <div className="text-sm text-muted-foreground py-6">No applications to review.</div>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Application</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Approved Amount</Label>
              <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Allocate Teller (optional)</Label>
              <Input placeholder="teller user id" value={tellerId} onChange={(e) => setTellerId(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={approve} disabled={submitting}>{submitting ? "Approving…" : "Approve"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
          <RejectForm onSubmit={reject} onCancel={() => setRejectOpen(false)} submitting={submitting} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RejectForm({ onSubmit, onCancel, submitting }: { onSubmit: (reason: string) => void; onCancel: () => void; submitting: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why rejected" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button variant="destructive" onClick={() => onSubmit(reason)} disabled={submitting || !reason.trim()}>
          {submitting ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
