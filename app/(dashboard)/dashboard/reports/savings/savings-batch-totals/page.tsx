"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Printer, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { printReport } from "@/lib/reports/print-report";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type Branch = { id: string; name: string };
type BatchRow = {
  batchNumber: string;
  processedDate: string;
  processor: string;
  approver: string;
  approvedDate: string;
  status: string;
  totalTransactions: number;
  totalAmount: string;
  averageTransaction: string;
  members: Array<{
    accountNumber: string;
    memberName: string;
    phone: string;
    bankVerificationNo: string | null;
    refNo: string;
    balance: string;
    transactionAmount: string;
    teller: string;
  }>;
};
type Envelope = { title: string; generatedAt: string; summary: Record<string, string>; data: { batches: BatchRow[] } };

const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
const defaultTo = today.toISOString().split("T")[0];

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

export default function SavingsBatchTotalsPage() {
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
    dateFrom: defaultFrom,
    dateTo: defaultTo,
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
      const response = await fetch("/api/v1/reports/savings/batch-totals", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: session?.user,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          status: filters.status === "all" ? undefined : filters.status,
          startDate: filters.dateFrom,
          endDate: filters.dateTo,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load batch totals");
      setReport(json.data as Envelope);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load batch totals");
    } finally {
      setLoading(false);
    }
  }, [filters.branchId, filters.dateFrom, filters.dateTo, filters.status, isAdmin, session?.user, status, userBranchId]);

  const loadReportRef = useRef(loadReport);

  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!isAdmin && userBranchId) setFilters((current) => ({ ...current, branchId: userBranchId }));
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setTimeout(() => {
      void loadReportRef.current();
    }, 300);
    return () => clearTimeout(timer);
  }, [
    filters.branchId,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    liveRefreshVersion,
    status,
    userBranchId,
  ]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const response = await fetch("/api/v1/reports/savings/batch-totals", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: session?.user,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          status: filters.status === "all" ? undefined : filters.status,
          startDate: filters.dateFrom,
          endDate: filters.dateTo,
          format: "xlsx",
        }),
      });
      if (!response.ok) throw new Error("Failed to export batch totals");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `savings-batch-totals-${filters.dateFrom}_to_${filters.dateTo}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export batch totals");
    } finally {
      setExporting(false);
    }
  }, [filters.branchId, filters.dateFrom, filters.dateTo, filters.status, isAdmin, session?.user, userBranchId]);

  const batches = report?.data.batches || [];
  const totals = report?.summary || {};

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first before printing.");
      return;
    }
    const groupBy = batches.map((batch) => ({
      key: 0,
      label: `Batch ${batch.batchNumber} - ${batch.processedDate}`,
      subHeaders: ["A/C No.", "Member", "Phone", "Ref No", "Balance", "Amount", "Teller"],
      subRows: batch.members.map((m) => [
        m.accountNumber,
        m.memberName,
        m.phone,
        m.refNo,
        m.balance,
        m.transactionAmount,
        m.teller,
      ]),
      subTotals: ["Total", String(batch.totalTransactions), "", "", "", batch.totalAmount, ""],
    }));
    printReport({
      title: "Savings Batch Totals",
      subtitle: `${activeBranchName} • ${filters.dateFrom} to ${filters.dateTo}`,
      period: `${filters.dateFrom} to ${filters.dateTo}`,
      headers: ["A/C No.", "Member", "Phone", "Ref No", "Balance", "Amount", "Teller"],
      rows: [],
      groupBy,
    });
  }, [report, batches, activeBranchName, filters.dateFrom, filters.dateTo]);

  return (
    <ReportPageLayout
      title="Savings Batch Totals Report"
      description="Batches grouped with member rows, subtotals, and grand total."
      fitContent
      summaryFirst
      summary={
        report ? (
          <>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Batches</div><div className="mt-1 text-lg font-bold">{totals.totalBatches || 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Transactions</div><div className="mt-1 text-lg font-bold">{totals.totalTransactions || 0}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Amount</div><div className="mt-1 text-lg font-bold">{totals.totalAmount || "0"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Posted</div><div className="mt-1 text-lg font-bold">{totals.postedBatches || 0}</div></CardContent></Card>
          </>
        ) : null
      }
      filters={
        <div className="grid w-full gap-3 grid-cols-1 md:grid-cols-4 lg:grid-cols-12">
          <div className="md:col-span-2 lg:col-span-2">
            <Label>From</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((c) => ({ ...c, dateFrom: e.target.value }))} />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <Label>To</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((c) => ({ ...c, dateTo: e.target.value }))} />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <Label>Status</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}>
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="md:col-span-2 lg:col-span-2">
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
          <div className="flex items-end gap-2 md:col-span-4 lg:col-span-4">
            <Button className="flex-1" onClick={loadReport} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleExport} disabled={exporting || !report}>
              {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>
            <Button variant="outline" className="flex-1" onClick={handlePrint} disabled={!report}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      }
    >
      <Card className="border-none shadow-none">
        <CardHeader className="px-0 pb-3">
          <SaccoReportHeader
            title="Savings Batch Totals Report"
            subtitle="Batches grouped with totals and member rows"
            branchLabel={activeBranchName}
            periodLabel={`${filters.dateFrom} to ${filters.dateTo}`}
            generatedAt={report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : undefined}
          />
        </CardHeader>
        <CardContent className="px-0">
          <ScrollArea className="w-full min-w-0 max-h-[calc(100vh-440px)] min-h-[360px] pr-3">
          <div className="space-y-4">
            {batches.map((batch) => (
              <div key={batch.batchNumber} className="w-full min-w-0 overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Batch</div>
                    <div className="text-lg font-bold">{batch.batchNumber}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{batch.processedDate}</div>
                    <div className="text-slate-300">{batch.processor}</div>
                  </div>
                </div>
                <div className="w-full min-w-0 overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="w-[15%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">A/C No.</th>
                        <th className="w-[22%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
                        <th className="w-[15%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">BVN/TIN</th>
                        <th className="w-[15%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                        <th className="w-[20%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ref. No.</th>
                        <th className="w-[13%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.members.map((member) => (
                        <tr key={`${batch.batchNumber}-${member.accountNumber}`} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-2.5 py-1.5 truncate max-w-0 font-mono text-slate-800" title={member.accountNumber}>{member.accountNumber}</td>
                          <td className="px-2.5 py-1.5 truncate max-w-0 font-medium text-slate-900" title={member.memberName}>{member.memberName}</td>
                          <td className="px-2.5 py-1.5 truncate max-w-0 text-slate-600" title={member.bankVerificationNo || "-"}>{member.bankVerificationNo || "-"}</td>
                          <td className="px-2.5 py-1.5 truncate max-w-0 text-slate-600" title={member.phone || "-"}>{member.phone || "-"}</td>
                          <td className="px-2.5 py-1.5 truncate max-w-0 font-mono text-slate-600" title={member.refNo}>{member.refNo}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-900" title={member.balance}>{member.balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <div>Total: {batch.members.length}</div>
                  <div>{batch.totalAmount}</div>
                </div>
              </div>
            ))}
            {!batches.length && (
              <div className="rounded-xl border border-dashed p-10 text-center text-slate-500">
                Generate the report to view batches and member rows.
              </div>
            )}
          </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
