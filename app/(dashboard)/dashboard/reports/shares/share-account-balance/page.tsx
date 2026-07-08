"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Printer, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Branch = { id: string; name: string };
type ProductRow = {
  code: string;
  name: string;
  accountCount: number;
  totalBlocked: number;
  totalValue: number;
  accounts: Array<{
    accountNumber: string;
    memberName: string;
    physicalPostalAddress: string;
    refNo: string;
    amountBlocked: number;
    balance: number;
    drCr: "CR" | "DR";
    phone: string;
    bankVerificationNo: string | null;
  }>;
};
type Envelope = { title: string; generatedAt: string; summary: Record<string, string>; data: { products: ProductRow[]; accountTypeSummary: any[]; accounts: any[] } };

function formatCurrency(value: number) {
  return `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ShareAccountBalancePage() {
  const { data: session, status } = useSession();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<Envelope | null>(null);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 15000,
  });
  const [filters, setFilters] = useState({
    branchId: "all",
    status: "all",
  });

  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  const activeBranchName = useMemo(() => {
    if (!isAdmin) return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    if (filters.branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) return;
      const json = await response.json();
      setBranches((json.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })));
    } catch {
      toast.error("Failed to load branches");
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports/shares/account-balance", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          status: filters.status === "all" ? undefined : filters.status,
          format: "JSON",
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load share balances");
      setReport(json.data as Envelope);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load share balances");
    } finally {
      setLoading(false);
    }
  }, [filters.branchId, filters.status, isAdmin, status, userBranchId]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!isAdmin && userBranchId) setFilters((current) => ({ ...current, branchId: userBranchId }));
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadReport();
  }, [status, liveRefreshVersion, loadReport]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const response = await fetch("/api/v1/reports/shares/account-balance", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          status: filters.status === "all" ? undefined : filters.status,
          format: "EXCEL",
        }),
      });
      if (!response.ok) throw new Error("Failed to export share balance report");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `share-account-balance-${Date.now()}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export share balance report");
    } finally {
      setExporting(false);
    }
  }, [filters.branchId, filters.status, isAdmin, userBranchId]);

  const products = report?.data.products || [];
  const summary = report?.summary || {};
  const rows = report?.data.accounts || [];

  return (
    <ReportPageLayout
      title="Shares Account Balance Report"
      description="Share capital balances by product with member-level detail."
      fitContent
      summaryFirst
      summary={
        report ? (
          <>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Accounts</div><div className="mt-1 text-lg font-bold">{summary.totalAccounts || 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Shares</div><div className="mt-1 text-lg font-bold">{summary.totalShares || 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Value</div><div className="mt-1 text-lg font-bold">{summary.totalValue || "0"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Average Shares</div><div className="mt-1 text-lg font-bold">{summary.averageShares || 0}</div></CardContent></Card>
          </>
        ) : null
      }
      filters={
        <div className="grid gap-3 lg:grid-cols-4">
          <div>
            <Label>Branch</Label>
            {isAdmin ? (
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.branchId} onChange={(e) => setFilters((c) => ({ ...c, branchId: e.target.value }))}>
                <option value="all">All Branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            ) : (
              <Input value={activeBranchName} disabled />
            )}
          </div>
          <div>
            <Label>Status</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}>
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
              <option value="DORMANT">Dormant</option>
            </select>
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <Button className="flex-1" onClick={loadReport} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Report
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleExport} disabled={exporting || !report}>
              {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export to Excel
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.print()} disabled={!report}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        </div>
      }
    >
      <Card className="border-none shadow-none">
        <CardHeader className="px-0 pb-3">
          <SaccoReportHeader
            title="Shares Account Balance Report"
            subtitle="Balances grouped by product"
            branchLabel={activeBranchName}
            periodLabel="As at current snapshot"
            generatedAt={report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : undefined}
          />
        </CardHeader>
        <CardContent className="px-0">
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.code} className="overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between bg-indigo-950 px-4 py-3 text-white">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-indigo-200">Product</div>
                    <div className="text-lg font-bold">{product.code} - {product.name}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{product.accountCount} members</div>
                    <div>{formatCurrency(product.totalValue)}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        {["A/C No.", "Name", "Physical/Postal Address", "Ref. No.", "Amount Blocked", "Balance", "DR/CR"].map((header) => (
                          <th key={header} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {product.accounts.map((row) => (
                        <tr key={`${product.code}-${row.accountNumber}`} className="border-b last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap">{row.accountNumber}</td>
                          <td className="px-3 py-2">{row.memberName}</td>
                          <td className="px-3 py-2">{row.physicalPostalAddress || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.refNo}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.amountBlocked)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.balance)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.drCr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <div>Total: {product.accountCount}</div>
                  <div>{formatCurrency(product.totalValue)}</div>
                </div>
              </div>
            ))}
            {!products.length && (
              <div className="rounded-xl border border-dashed p-10 text-center text-slate-500">
                Generate the report to view products and member balances.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-xs text-slate-500">
        Loaded {rows.length} accounts from the API.
      </div>
    </ReportPageLayout>
  );
}
