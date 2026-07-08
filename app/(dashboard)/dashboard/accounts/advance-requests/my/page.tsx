"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Banknote,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "COMPLETED";

interface MyAdvance {
  id: string;
  requestCode: string;
  amount: number;
  reason: string;
  installments: number;
  monthlyDeduction: number;
  repaymentStartMonth: string;
  notes?: string | null;
  status: AdvanceStatus;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  approvedBy?: { id: string; name: string } | null;
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

const STATUS_CONFIG: Record<AdvanceStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: "Pending Approval", icon: Clock, className: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  APPROVED: { label: "Approved", icon: CheckCircle, className: "text-green-600 bg-green-50 border-green-200" },
  REJECTED: { label: "Rejected", icon: AlertCircle, className: "text-red-600 bg-red-50 border-red-200" },
  ACTIVE: { label: "Active — Repaying", icon: CheckCircle, className: "text-blue-600 bg-blue-50 border-blue-200" },
  COMPLETED: { label: "Completed", icon: CheckCircle, className: "text-gray-600 bg-gray-50 border-gray-200" },
};

export default function MyAdvancesPage() {
  const [advances, setAdvances] = useState<MyAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/v1/staff-advances/my");
      setAdvances(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("Failed to load your advances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = advances.filter((a) => a.status === "ACTIVE");
  const totalOutstanding = active.reduce((s, a) => s + a.amount, 0);
  const totalMonthly = active.reduce((s, a) => s + a.monthlyDeduction, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-amber-600" />
            My Advances
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your salary advance requests and repayment schedule.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-blue-700 font-medium">Total Outstanding</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{fmt(totalOutstanding)}</p>
              <p className="text-xs text-blue-600 mt-1">{active.length} active advance{active.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700 font-medium">Monthly Deduction</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{fmt(totalMonthly)}</p>
              <p className="text-xs text-amber-600 mt-1">From your salary each month</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : advances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Banknote className="h-10 w-10 opacity-30" />
            <p>You have no advance requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {advances.map((adv) => {
            const expanded = expandedId === adv.id;
            const config = STATUS_CONFIG[adv.status];
            const Icon = config.icon;
            return (
              <Card key={adv.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : adv.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className={`rounded-full border p-1.5 ${config.className}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{REASON_LABELS[adv.reason] ?? adv.reason}</span>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {adv.requestCode}
                          </span>
                          {(adv as any).advanceType && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                              {(adv as any).advanceType}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.label} · {format(new Date(adv.createdAt), "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg">{fmt(adv.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {adv.installments} month{adv.installments !== 1 ? "s" : ""} · {fmt(adv.monthlyDeduction)}/mo
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t px-5 py-4 space-y-3 bg-muted/10">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Amount</p>
                          <p className="font-semibold">{fmt(adv.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Monthly Deduction</p>
                          <p className="font-semibold">{fmt(adv.monthlyDeduction)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Repayment Starts</p>
                          <p className="font-semibold">{adv.repaymentStartMonth}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Installments</p>
                          <p className="font-semibold">{adv.installments} months</p>
                        </div>
                        {adv.approvedBy && (
                          <div>
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Approved By</p>
                            <p className="font-semibold">{adv.approvedBy.name}</p>
                            {adv.approvedAt && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(adv.approvedAt), "dd MMM yyyy")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {adv.notes && (
                        <div className="rounded-lg border bg-white p-3 text-sm">
                          <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Notes</p>
                          <p>{adv.notes}</p>
                        </div>
                      )}

                      {adv.status === "REJECTED" && adv.rejectionReason && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-red-800">Reason for rejection</p>
                            <p className="text-red-700">{adv.rejectionReason}</p>
                          </div>
                        </div>
                      )}

                      {adv.status === "ACTIVE" && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                          Deductions of <strong>{fmt(adv.monthlyDeduction)}</strong> begin from{" "}
                          <strong>{adv.repaymentStartMonth}</strong> and run for{" "}
                          <strong>{adv.installments} month{adv.installments !== 1 ? "s" : ""}</strong>.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
