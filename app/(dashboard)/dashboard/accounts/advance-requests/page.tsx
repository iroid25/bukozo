"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Banknote,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "COMPLETED";
type AdvanceType = "STAFF" | "OFFICIAL" | "MEMBER";

const ADVANCE_TYPE_CONFIG: Record<AdvanceType, { label: string; className: string }> = {
  STAFF:    { label: "Staff",    className: "bg-blue-100 text-blue-800 border-blue-200" },
  OFFICIAL: { label: "Official", className: "bg-purple-100 text-purple-800 border-purple-200" },
  MEMBER:   { label: "Member",   className: "bg-green-100 text-green-800 border-green-200" },
};

interface Repayment {
  id: string;
  amount: number;
  notes?: string | null;
  paidAt: string;
  recordedBy?: { id: string; name: string } | null;
}

interface AdvanceRequest {
  id: string;
  requestCode: string;
  advanceType: AdvanceType;
  staffId: string;
  staffName: string;
  initiatedByUserId: string;
  amount: number;
  outstandingBalance: number;
  reason: string;
  installments: number;
  monthlyDeduction: number;
  repaymentStartMonth: string;
  notes?: string | null;
  status: AdvanceStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  branchId?: string | null;
  assetId?: string | null;
  createdAt: string;
  staff?: { id: string; name: string; role: string } | null;
  initiatedBy?: { id: string; name: string; role: string } | null;
  approvedBy?: { id: string; name: string } | null;
  rejectedBy?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  repayments?: Repayment[];
}

const REASON_LABELS: Record<string, string> = {
  medical: "Medical",
  school_fees: "School Fees",
  rent: "Rent",
  personal: "Personal",
  other: "Other",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(n || 0);

function StatusBadge({ status }: { status: AdvanceStatus }) {
  const map: Record<AdvanceStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    APPROVED: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
    REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
    ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-800 border-blue-200" },
    COMPLETED: { label: "Completed", className: "bg-gray-100 text-gray-800 border-gray-200" },
  };
  const { label, className } = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function AdvanceRequestsPage() {
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reject state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AdvanceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Repayment state
  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [repayTarget, setRepayTarget] = useState<AdvanceRequest | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.advanceType = typeFilter;
      const res = await axios.get("/api/v1/staff-advances", { params });
      setRequests(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Failed to load advance requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const loadRepayments = async (advance: AdvanceRequest) => {
    try {
      const res = await axios.get(`/api/v1/staff-advances/${advance.id}/repayment`);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === advance.id
            ? { ...r, repayments: Array.isArray(res.data?.data) ? res.data.data : [] }
            : r,
        ),
      );
    } catch {
      // silent
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await axios.post(`/api/v1/staff-advances/${id}/approve`);
      toast.success("Advance approved — teller float deducted and posted to current assets");
      void load();
    } catch (error: any) {
      toast.error(error.response?.data?.details || error.response?.data?.error || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    try {
      setActionLoading(true);
      await axios.post(`/api/v1/staff-advances/${rejectTarget.id}/reject`, {
        rejectionReason: rejectReason || "Rejected by approver",
      });
      toast.success("Advance request rejected");
      setRejectDialogOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      void load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepayConfirm = async () => {
    if (!repayTarget) return;
    const amount = Number(repayAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid repayment amount");
      return;
    }
    try {
      setActionLoading(true);
      const res = await axios.post(`/api/v1/staff-advances/${repayTarget.id}/repayment`, {
        amount,
        notes: repayNotes,
      });
      toast.success(res.data?.data?.message || "Repayment recorded");
      setRepayDialogOpen(false);
      setRepayTarget(null);
      setRepayAmount("");
      setRepayNotes("");
      void load();
    } catch (error: any) {
      toast.error(error.response?.data?.details || error.response?.data?.error || "Failed to record repayment");
    } finally {
      setActionLoading(false);
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const active = requests.filter((r) => r.status === "ACTIVE");
  const totalOutstanding = active.reduce((s, r) => s + Number(r.outstandingBalance || 0), 0);

  const filteredRequests =
    statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);

  const RequestCard = ({ req }: { req: AdvanceRequest }) => {
    const expanded = expandedId === req.id;
    const paid = Number(req.amount) - Number(req.outstandingBalance || req.amount);
    const paidPct = req.amount > 0 ? Math.min(100, (paid / req.amount) * 100) : 0;

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            onClick={() => {
              const next = expanded ? null : req.id;
              setExpandedId(next);
              if (next && req.status === "ACTIVE" && !req.repayments) {
                void loadRepayments(req);
              }
            }}
          >
            <div className="flex items-center gap-4 min-w-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{req.staffName}</span>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {req.requestCode}
                  </span>
                  <StatusBadge status={req.status} />
                  {req.advanceType && ADVANCE_TYPE_CONFIG[req.advanceType] && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ADVANCE_TYPE_CONFIG[req.advanceType].className}`}>
                      {ADVANCE_TYPE_CONFIG[req.advanceType].label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {REASON_LABELS[req.reason] ?? req.reason} ·{" "}
                  {format(new Date(req.createdAt), "dd MMM yyyy")}
                  {req.branch ? ` · ${req.branch.name}` : ""}
                  {req.initiatedBy ? ` · via ${req.initiatedBy.name}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-lg">{fmt(req.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {req.installments} mo · {fmt(req.monthlyDeduction)}/mo
              </p>
            </div>
          </button>

          {expanded && (
            <div className="border-t px-5 py-4 space-y-4 bg-muted/10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Staff</p>
                  <p className="font-medium">{req.staffName}</p>
                  <p className="text-xs text-muted-foreground">{req.staff?.role}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Initiated By</p>
                  <p className="font-medium">{req.initiatedBy?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{req.initiatedBy?.role}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Monthly Deduction</p>
                  <p className="font-medium">{fmt(req.monthlyDeduction)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Repayment Starts</p>
                  <p className="font-medium">{req.repaymentStartMonth}</p>
                </div>
              </div>

              {req.status === "ACTIVE" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Repayment progress</span>
                    <span className="font-medium">
                      {fmt(paid)} paid · {fmt(Number(req.outstandingBalance))} outstanding
                    </span>
                  </div>
                  <Progress value={paidPct} className="h-2" />
                </div>
              )}

              {req.notes && (
                <div className="rounded-lg border bg-white p-3 text-sm">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Notes</p>
                  <p>{req.notes}</p>
                </div>
              )}

              {req.status === "REJECTED" && req.rejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800">Rejection reason</p>
                    <p className="text-red-700">{req.rejectionReason}</p>
                  </div>
                </div>
              )}

              {req.status === "ACTIVE" && req.assetId && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-2 text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <p>
                    Posted to current assets on{" "}
                    {req.approvedAt ? format(new Date(req.approvedAt), "dd MMM yyyy") : "—"}
                    {req.approvedBy ? ` by ${req.approvedBy.name}` : ""}
                  </p>
                </div>
              )}

              {/* Repayment history */}
              {req.status === "ACTIVE" && req.repayments && req.repayments.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">
                    Repayment History
                  </p>
                  <div className="space-y-1">
                    {req.repayments.map((rp) => (
                      <div
                        key={rp.id}
                        className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{fmt(rp.amount)}</span>
                          {rp.notes && (
                            <span className="text-muted-foreground ml-2">— {rp.notes}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <p>{format(new Date(rp.paidAt), "dd MMM yyyy")}</p>
                          {rp.recordedBy && <p>by {rp.recordedBy.name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1 flex-wrap">
                {req.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1"
                      disabled={actionLoading}
                      onClick={() => handleApprove(req.id)}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50 gap-1"
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectTarget(req);
                        setRejectReason("");
                        setRejectDialogOpen(true);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </>
                )}

                {req.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setRepayTarget(req);
                      setRepayAmount(String(req.monthlyDeduction));
                      setRepayNotes("");
                      setRepayDialogOpen(true);
                    }}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Record Repayment
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-amber-600" />
            Advance Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage staff salary advance requests and installment repayments.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Approval</p>
              <p className="text-2xl font-bold">{pending.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Advances</p>
              <p className="text-2xl font-bold">{active.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Outstanding</p>
              <p className="text-lg font-bold">{fmt(totalOutstanding)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">All Requests</TabsTrigger>
          <TabsTrigger value="installments">
            Installments
            {active.length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {active.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Requests Tab ── */}
        <TabsContent value="requests" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="OFFICIAL">Official</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Banknote className="h-10 w-10 opacity-30" />
                <p>No advance requests found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <RequestCard key={req.id} req={req} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Installments Tab ── */}
        <TabsContent value="installments" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Active advances with outstanding balances. Use "Record Repayment" when a staff
            member brings cash to the teller window.
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : active.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <CreditCard className="h-10 w-10 opacity-30" />
                <p>No active advances with pending installments.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {active.map((req) => {
                const paid = Number(req.amount) - Number(req.outstandingBalance || req.amount);
                const paidPct = req.amount > 0 ? Math.min(100, (paid / req.amount) * 100) : 0;
                return (
                  <Card key={req.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold">{req.staffName}</p>
                            <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {req.requestCode}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {REASON_LABELS[req.reason] ?? req.reason}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Amount</p>
                              <p className="font-semibold">{fmt(req.amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outstanding</p>
                              <p className="font-semibold text-red-600">
                                {fmt(Number(req.outstandingBalance))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Monthly Deduction</p>
                              <p className="font-semibold">{fmt(req.monthlyDeduction)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Repayment Start</p>
                              <p className="font-semibold">{req.repaymentStartMonth}</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{fmt(paid)} paid</span>
                              <span>{paidPct.toFixed(0)}%</span>
                            </div>
                            <Progress value={paidPct} className="h-1.5" />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setRepayTarget(req);
                            setRepayAmount(String(req.monthlyDeduction));
                            setRepayNotes("");
                            setRepayDialogOpen(true);
                          }}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Record Payment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Reject Dialog ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Advance Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting{" "}
              <strong>{rejectTarget?.staffName}</strong>&apos;s advance of{" "}
              <strong>{rejectTarget ? fmt(rejectTarget.amount) : ""}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason (optional)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={actionLoading} onClick={handleRejectConfirm}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Repayment Dialog ── */}
      <Dialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Advance Repayment</DialogTitle>
            <DialogDescription>
              Recording a payment for <strong>{repayTarget?.staffName}</strong>.
              Outstanding: <strong>{repayTarget ? fmt(Number(repayTarget.outstandingBalance)) : ""}</strong>.
              This will post a GL entry (Dr 102001-Cash / Cr 102005-Advances).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount (UGX)</label>
              <Input
                type="number"
                min="1"
                step="100"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder={`Default: ${repayTarget ? fmt(repayTarget.monthlyDeduction) : ""}`}
              />
              <p className="text-xs text-muted-foreground">
                Monthly deduction: {repayTarget ? fmt(repayTarget.monthlyDeduction) : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="e.g. Cash received at teller window"
                value={repayNotes}
                onChange={(e) => setRepayNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={actionLoading} onClick={handleRepayConfirm}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
