"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  Activity,
  Banknote,
  Building2,
  Download,
  Filter,
  RefreshCw,
  Shield,
  Table2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  CustomerInternalAccountingRecord,
  CustomerInternalAccountingSummary,
} from "@/lib/reports/customer-internal-accounting-types";
import { renderSaccoPdfFooter, renderSaccoPdfHeader } from "@/lib/reports/report-pdf";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = {
  id: string;
  name: string;
  location: string;
};

function currency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export default function CustomerInternalAccountingSystemClient(props: {
  userRole: string;
  userBranchId: string | null;
  userBranchName: string | null;
}) {
  const isAdmin = props.userRole === "ADMIN";
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<string>(isAdmin ? "all" : props.userBranchId || "all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<CustomerInternalAccountingRecord[]>([]);
  const [summary, setSummary] = useState<CustomerInternalAccountingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  useEffect(() => {
    const loadBranches = async () => {
      if (!isAdmin) return;
      const response = await fetch("/api/v1/lookups/branches", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBranchOptions(
        rows.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          location: branch.location,
        })),
      );
    };
    void loadBranches();
  }, [isAdmin]);

  const branchLabel = useMemo(() => {
    if (!isAdmin) return props.userBranchName || "Current Branch";
    if (branchId === "all") return "All Branches";
    return branchOptions.find((branch) => branch.id === branchId)?.name || "Selected Branch";
  }, [branchId, branchOptions, isAdmin, props.userBranchName]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = status === "all" || record.accountStatus === status;
      const matchesSearch =
        !query ||
        [
          record.memberName,
          record.memberNumber,
          record.accountNumber,
          record.accountType,
          record.branchName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [records, search, status]);

  const branchParam = useMemo(() => {
    if (!isAdmin) return props.userBranchId || undefined;
    return branchId === "all" ? undefined : branchId;
  }, [branchId, isAdmin, props.userBranchId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchParam) params.set("branchId", branchParam);
      if (status !== "all") params.set("status", status);

      const [recordsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/reports/customer-internal-accounting-system?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/v1/reports/customer-internal-accounting-system/statistics?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (!recordsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch report");
      }

      const recordsJson = await recordsRes.json();
      const statsJson = await statsRes.json();
      setRecords(Array.isArray(recordsJson?.data) ? recordsJson.data : []);
      setSummary(statsJson?.data || recordsJson?.summary || null);
      setGeneratedAt(new Date().toLocaleString());
      setHasLoadedOnce(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customer accounting report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [branchParam, status]);

  useEffect(() => {
    if (!hasLoadedOnce) return;
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const payload = filteredRecords.map((record) => ({
      Branch: record.branchName,
      "Member No.": record.memberNumber,
      Customer: record.memberName,
      "Account No.": record.accountNumber,
      "Account Type": record.accountType,
      Status: record.accountStatus,
      "Current Balance": record.currentBalance,
      "Total Deposits": record.totalDeposits,
      "Total Withdrawals": record.totalWithdrawals,
      "Loan Disbursements": record.totalLoanDisbursements,
      "Loan Repayments": record.totalLoanRepayments,
      "Net Movement": record.netMovement,
      "Last Activity": record.lastActivityAt ? format(new Date(record.lastActivityAt), "yyyy-MM-dd HH:mm") : "N/A",
    }));
    const worksheet = XLSX.utils.json_to_sheet(payload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Accounting");
    const fileName = `Customer_Internal_Accounting_${branchLabel.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel export ready");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const generated = generatedAt || new Date().toLocaleString();
    const title = "Customer Internal Accounting System";
    renderSaccoPdfHeader(doc, {
      title,
      subtitle: "Branch-scoped customer accounting review",
      branchLabel,
      generatedAt: generated,
    });

    const metrics = [
      { label: "Accounts", value: summary?.totalAccounts || 0 },
      { label: "Members", value: summary?.totalMembers || 0 },
      { label: "Balance", value: currency(summary?.totalBalance || 0) },
      { label: "Deposits", value: currency(summary?.totalDeposits || 0) },
      { label: "Withdrawals", value: currency(summary?.totalWithdrawals || 0) },
      { label: "Net", value: currency(summary?.netMovement || 0) },
    ];
    let x = 12;
    const y = 36;
    const width = 42;
    metrics.forEach((metric) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, width, 18, 3, 3, "FD");
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.text(metric.label, x + 3, y + 6);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(String(metric.value), x + 3, y + 13);
      x += width + 3;
    });

    autoTable(doc, {
      startY: 58,
      head: [[
        "Branch",
        "Customer",
        "Account No.",
        "Type",
        "Status",
        "Balance",
        "Deposits",
        "Withdrawals",
        "Net Movement",
      ]],
      body: filteredRecords.map((record) => [
        record.branchName,
        `${record.memberNumber} - ${record.memberName}`,
        record.accountNumber,
        record.accountType,
        record.accountStatus,
        currency(record.currentBalance),
        currency(record.totalDeposits),
        currency(record.totalWithdrawals),
        currency(record.netMovement),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [3, 22, 53], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 58, left: 12, right: 12, bottom: 16 },
      didDrawPage: () => renderSaccoPdfFooter(doc),
    });

    doc.save(`Customer_Internal_Accounting_${branchLabel.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF export ready");
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_32%),linear-gradient(to_bottom,_#f8fafc,_#ffffff_45%,_#f7f9fb)] px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <Card className="border-slate-200/80 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <CardHeader className="space-y-4 border-b border-slate-200/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  <Shield className="h-3.5 w-3.5" />
                  SACCO Reports
                </div>
                <CardTitle className="text-2xl md:text-3xl">Customer Internal Accounting System</CardTitle>
                <p className="max-w-3xl text-sm text-slate-600">
                  Comprehensive customer-level accounting view with branch control, current balances,
                  transaction movement, and loan exposure.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {branchLabel}
                </Badge>
                {generatedAt && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Updated {generatedAt}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Accounts" value={summary?.totalAccounts || 0} icon={Table2} />
              <MetricCard title="Members" value={summary?.totalMembers || 0} icon={Building2} />
              <MetricCard title="Balance" value={currency(summary?.totalBalance || 0)} icon={Wallet} />
              <MetricCard title="Deposits" value={currency(summary?.totalDeposits || 0)} icon={Banknote} />
              <MetricCard title="Withdrawals" value={currency(summary?.totalWithdrawals || 0)} icon={Activity} />
              <MetricCard title="Net Movement" value={currency(summary?.netMovement || 0)} icon={Filter} />
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch</label>
                  <Select value={branchId} onValueChange={setBranchId} disabled={!isAdmin}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="all">All Branches</SelectItem>}
                      {!isAdmin ? (
                        <SelectItem value={props.userBranchId || "all"}>
                          {props.userBranchName || "Current Branch"}
                        </SelectItem>
                      ) : (
                        branchOptions.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer, account, or branch..."
                    className="w-80"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={fetchReport} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
                <Button variant="outline" onClick={exportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button onClick={exportPdf}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Branch</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Deposits</TableHead>
                    <TableHead className="text-right">Withdrawals</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.branchName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{record.memberName}</div>
                            <div className="text-xs text-slate-500">{record.memberNumber}</div>
                          </div>
                        </TableCell>
                        <TableCell>{record.accountNumber}</TableCell>
                        <TableCell>{record.accountType}</TableCell>
                        <TableCell>{record.accountStatus}</TableCell>
                        <TableCell className="text-right font-medium">{currency(record.currentBalance)}</TableCell>
                        <TableCell className="text-right">{currency(record.totalDeposits)}</TableCell>
                        <TableCell className="text-right">{currency(record.totalWithdrawals)}</TableCell>
                        <TableCell className="text-right font-medium">{currency(record.netMovement)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                        No records match the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {title}
        </div>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
