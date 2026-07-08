"use client";

import { useState } from "react";
import { Shield, Edit3, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";

const fmtUGX = (n: any) => `UGX ${Number(n || 0).toLocaleString("en-UG")}`;

const ROLE_LABELS: Record<string, string> = {
  TELLER: "Teller",
  AGENT: "Agent",
  LOANOFFICER: "Loan Officer",
  DATA_ENTRANT: "Data Entrant",
  ACCOUNT_OPENER: "Account Opener",
  BRANCHMANAGER: "Branch Manager",
  ACCOUNTANT: "Accountant",
};

function useStaffLimits() {
  return useQuery({
    queryKey: ["staff-limits"],
    queryFn: async () => {
      const r = await axios.get("/api/v1/settings/roles");
      const d = r.data as any;
      return d?.data ?? [];
    },
    staleTime: 30000,
  });
}

function EditLimitModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: any;
}) {
  const qc = useQueryClient();
  const [perTransaction, setPerTransaction] = useState(
    String(item?.perTransactionLimit ?? "")
  );
  const [dailyLimit, setDailyLimit] = useState(
    String(item?.dailyLimit ?? "")
  );
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const r = await axios.patch("/api/v1/settings/roles", {
        role: item.role,
        isActive,
        perTransactionLimit: Number(perTransaction) || undefined,
        dailyLimit: Number(dailyLimit) || undefined,
      });
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-limits"] });
      toast.success("Staff limit updated");
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to update"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b">
          <h2 className="text-lg font-bold">
            Edit Limits — {ROLE_LABELS[item?.role] || item?.role}
          </h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Per-Transaction Limit (UGX)
            </label>
            <input
              type="number"
              value={perTransaction}
              onChange={(e) => setPerTransaction(e.target.value)}
              placeholder="e.g. 5000000"
              className="block w-full rounded-md border-0 py-2 px-3 ring-1 ring-gray-300 focus:ring-2 focus:ring-emerald-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Daily Limit (UGX)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="e.g. 20000000"
              className="block w-full rounded-md border-0 py-2 px-3 ring-1 ring-gray-300 focus:ring-2 focus:ring-emerald-500 sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-900">
              Limit is active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StaffLimitsPage() {
  const { data: raw, isLoading, refetch } = useStaffLimits();
  const [editItem, setEditItem] = useState<any>(null);
  const limits: any[] = Array.isArray(raw) ? raw : [];

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100">
            <Shield className="w-6 h-6 text-emerald-700" />
          </div>
          Staff Limits Configuration
        </h1>
        <p className="text-slate-500 text-sm mt-1 ml-14">
          Set per-role transaction and daily limits for tellers, agents, and
          other staff.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Staff Limits</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
          ) : limits.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No staff limits configured</p>
              <p className="text-sm mt-1">
                Limits can be created by editing a role below.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <Button
                    key={role}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditItem({
                        role,
                        perTransactionLimit: null,
                        dailyLimit: null,
                        isActive: true,
                      })
                    }
                  >
                    Configure {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {limits.map((l: any) => (
                <div
                  key={l.id || l.role}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Shield className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {ROLE_LABELS[l.role] || l.role}
                      </p>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-slate-500">
                          Per txn:{" "}
                          <span className="font-medium text-slate-700">
                            {l.perTransactionLimit
                              ? fmtUGX(l.perTransactionLimit)
                              : "—"}
                          </span>
                        </span>
                        <span className="text-slate-500">
                          Daily:{" "}
                          <span className="font-medium text-slate-700">
                            {l.dailyLimit ? fmtUGX(l.dailyLimit) : "—"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        l.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }
                    >
                      {l.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditItem(l)}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editItem && (
        <EditLimitModal
          open={!!editItem}
          item={editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}
