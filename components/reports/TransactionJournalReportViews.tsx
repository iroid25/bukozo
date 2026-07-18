"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  CalendarDays,
  Download,
  Printer,
  RefreshCw,
  Table2,
  UserCheck,
  Users,
} from "lucide-react";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type DaySheetFilterMode = "trx_date" | "session_date";

type BranchOption = {
  id: string;
  name: string;
};

type LegendItem = {
  code: string;
  meaning: string;
  lastChar: string;
};

type DaySheetRow = {
  trx_number: string;
  gl_account_no: string;
  account_no: string;
  name: string;
  trx_code: string;
  voucher_no: string;
  session_date: string;
  trx_date: string;
  debit: number;
  credit: number;
  user_name: string;
  is_debit_leg: boolean;
  is_credit_leg: boolean;
  trx_type_label: string;
  voucher_group_id: string;
  branch_name: string;
  account_name?: string;
  highlighted?: boolean;
  is_r2t?: boolean;
  is_t2r?: boolean;
};

type DaySheetReport = {
  report_title: string;
  filter_mode: DaySheetFilterMode;
  filter_label: string;
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
  };
  transactions: DaySheetRow[];
  summary: {
    row_count: number;
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
    unique_vouchers: number;
    unique_tellers: number;
  };
  legend: LegendItem[];
};

type TellerReportRow = {
  trx_number: string;
  gl_account_no: string;
  account_no: string;
  name: string;
  trx_code: string;
  source_code: string;
  source_label: string;
  source_detail: string;
  voucher_no: string;
  trx_date: string;
  time_posted: string;
  debit: number;
  credit: number;
  running_balance: number;
  user_name: string;
  is_r2t: boolean;
  is_t2r: boolean;
  trx_type_label: string;
  voucher_group_id: string;
};

type TellerCashStatusReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    session_date: string;
    teller_code: string;
    teller_name: string;
  };
  transactions: TellerReportRow[];
  source_breakdown: Array<{
    source_code: string;
    source_label: string;
    count: number;
    debit_total: number;
    credit_total: number;
    net_amount: number;
  }>;
  summary: {
    transaction_count: number;
    total_debit: number;
    total_credit: number;
    net_change: number;
    is_balanced: boolean;
    opening_float: number;
    closing_balance: number;
  };
  signature_block: {
    prepared_by: string | null;
    verified_by: string | null;
    approved_by: string | null;
  };
  legend: LegendItem[];
};

const DAY_SHEET_MODES: Record<DaySheetFilterMode, { label: string; href: string }> = {
  trx_date: {
    label: "By Transaction Date",
    href: "/dashboard/reports/transactions/trx-day-sheet-by-transaction-date",
  },
  session_date: {
    label: "By Selected Date",
    href: "/dashboard/reports/transactions/trx-day-sheet-by-session-date",
  },
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function localDateInput(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function localDateLabel(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
}

function localDateTimeLabel(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy HH:mm:ss");
}

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to download export");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildQueryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) query.set(key, value.trim());
  });
  return query.toString();
}

function useBranchOptions() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("all");

  const role = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = role === "ADMIN";

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;

    const loadBranches = async () => {
      try {
        const response = await fetch("/api/v1/branches", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (!mounted) return;
        setBranches((result.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })));
      } catch (error) {
        console.error("Failed to load branches", error);
      }
    };

    loadBranches();
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  return {
    branches,
    branchId,
    setBranchId,
    isAdmin,
    userBranchId,
    branchName: isAdmin
      ? branches.find((branch) => branch.id === branchId)?.name || "All Branches"
      : branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch",
  };
}

function useDaySheetReport(mode: DaySheetFilterMode, branchId?: string) {
  const [fromDate, setFromDate] = useState(localDateInput(new Date()));
  const [toDate, setToDate] = useState(localDateInput(new Date()));
  const [userName, setUserName] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [trxCode, setTrxCode] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [report, setReport] = useState<DaySheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState("");
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = buildQueryString({
        filterMode: mode,
        fromDate,
        toDate,
        branchId,
        userName,
        glAccount,
        trxCode,
        voucherNo,
      });
      const response = await fetch(`/api/v1/reports/transactions/day-sheet?${query}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load day sheet");
      }
      const data = result.data as DaySheetReport;
      setReport(data);
      setGeneratedAt(localDateTimeLabel(data.report_meta.generated_at));
      if (!activeVoucher && data.transactions.length > 0) {
        setActiveVoucher(data.transactions[0].voucher_no);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load day sheet report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, branchId, liveRefreshVersion]);

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    userName,
    setUserName,
    glAccount,
    setGlAccount,
    trxCode,
    setTrxCode,
    voucherNo,
    setVoucherNo,
    report,
    loading,
    fetchReport,
    generatedAt,
    activeVoucher,
    setActiveVoucher,
  };
}

function useCashierReport(branchId?: string) {
  const [sessionDate, setSessionDate] = useState(localDateInput(new Date()));
  const [tellerId, setTellerId] = useState("all");
  const [trxCode, setTrxCode] = useState("");
  const [tellers, setTellers] = useState<Array<{ id: string; name: string; branch_name?: string }>>([]);
  const [report, setReport] = useState<TellerCashStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [activeVoucher, setActiveVoucher] = useState("");
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  useEffect(() => {
    let mounted = true;
    const loadTellers = async () => {
      try {
        const query = buildQueryString({ branchId });
        const response = await fetch(`/api/v1/reports/transactions/cashier-teller-cash-status/tellers?${query}`, {
          cache: "no-store",
          credentials: "include",
        });
        const result = await response.json();
        if (!response.ok || !result.success) return;
        if (!mounted) return;
        const tellerRows = result.data || [];
        setTellers([{ id: "all", name: "All Tellers", branch_name: "All Branches" }, ...tellerRows]);
        setTellerId((current) => current || "all");
      } catch (error) {
        console.error("Failed to load tellers", error);
      }
    };

    loadTellers();
    return () => {
      mounted = false;
    };
  }, [branchId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = buildQueryString({
        sessionDate,
        tellerId: tellerId === "all" ? "" : tellerId,
        branchId,
        trxCode,
      });
      const response = await fetch(`/api/v1/reports/transactions/cashier-teller-cash-status?${query}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load cashier status");
      }
      const data = result.data as TellerCashStatusReport;
      setReport(data);
      setGeneratedAt(localDateTimeLabel(data.report_meta.generated_at));
      if (!activeVoucher && data.transactions.length > 0) {
        setActiveVoucher(data.transactions[0].voucher_no);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load cashier/teller cash status report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tellerId) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDate, tellerId, branchId, trxCode, liveRefreshVersion]);

  return {
    sessionDate,
    setSessionDate,
    tellerId,
    setTellerId,
    trxCode,
    setTrxCode,
    tellers,
    report,
    loading,
    fetchReport,
    generatedAt,
    activeVoucher,
    setActiveVoucher,
  };
}

function ModeSwitcher({ mode }: { mode: DaySheetFilterMode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(DAY_SHEET_MODES).map(([key, info]) => (
        <Button
          key={key}
          asChild
          variant={key === mode ? "default" : "outline"}
          size="sm"
          className="rounded-full"
        >
          <Link href={info.href}>{info.label}</Link>
        </Button>
      ))}
    </div>
  );
}

function ReportTableCell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <span className={cn(muted && "text-muted-foreground")}>{children}</span>;
}

export function DaySheetReportPage({ mode }: { mode: DaySheetFilterMode }) {
  const { data: session } = useSession();
  const { branches, branchId, setBranchId, isAdmin, branchName } = useBranchOptions();
  const state = useDaySheetReport(mode, isAdmin ? branchId : (session?.user as any)?.branchId);

  const exportUrl = useMemo(() => {
    const query = buildQueryString({
      filterMode: mode,
      fromDate: state.fromDate,
      toDate: state.toDate,
      branchId: isAdmin ? branchId : (session?.user as any)?.branchId,
      userName: state.userName,
      glAccount: state.glAccount,
      trxCode: state.trxCode,
      voucherNo: state.voucherNo,
    });
    return `/api/v1/reports/transactions/day-sheet/export?${query}`;
  }, [
    branchId,
    isAdmin,
    mode,
    session,
    state.fromDate,
    state.glAccount,
    state.toDate,
    state.trxCode,
    state.userName,
    state.voucherNo,
  ]);

  const selectedRowClass = (row: DaySheetRow) => {
    return cn(
      row.is_r2t && "bg-emerald-50",
      row.is_t2r && "bg-sky-50",
      row.trx_code === "GJ" && row.gl_account_no.startsWith("5") && "bg-amber-50",
      state.activeVoucher && row.voucher_no === state.activeVoucher && "ring-2 ring-primary/40 bg-primary/5",
      row.debit === 0 && row.credit > 0 && "text-muted-foreground"
    );
  };

  const report = state.report;

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("No data to print. Generate the report first.");
      return;
    }
    const headers = ["Trx No.", "GL A/C No.", "A/C No.", "Name", "Trx Code", "Voucher No.", "Selected Date", "Trx Date", "Debit", "Credit", "User Name"];
    const rows = report.transactions.map((row) => [
      row.trx_number,
      row.gl_account_no,
      row.account_no,
      row.name,
      row.trx_code,
      row.voucher_no,
      localDateLabel(row.session_date),
      localDateLabel(row.trx_date),
      row.debit,
      row.credit,
      row.user_name,
    ]);
    printReport({
      title: report.report_title || "Day Sheet",
      subtitle: report.filter_label,
      period: `${report.report_meta.from_date} to ${report.report_meta.to_date}`,
      filters: {
        Branch: report.report_meta.branch,
      },
      headers,
      rows,
      totals: ["", "", "", "", "", "", "", "Total", report.summary.total_debit, report.summary.total_credit, ""],
      summary: {
        Rows: report.summary.row_count,
        "Debit Total": report.summary.total_debit,
        "Credit Total": report.summary.total_credit,
        "Unique Vouchers": report.summary.unique_vouchers,
        "Unique Tellers": report.summary.unique_tellers,
      },
    });
  }, [report]);

  return (
    <ReportPageLayout
      title={report?.report_title || DAY_SHEET_MODES[mode].label}
      description="Daily transaction register with voucher grouping and export controls."
      generatedAt={state.generatedAt || undefined}
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {isAdmin ? (
            <div className="space-y-2">
              <label className="text-xs font-medium">Branch</label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium">Branch</label>
              <Input value={branchName} disabled />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium">From Date</label>
            <Input type="date" value={state.fromDate} onChange={(event) => state.setFromDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">To Date</label>
            <Input type="date" value={state.toDate} onChange={(event) => state.setToDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">User Name</label>
            <Input value={state.userName} onChange={(event) => state.setUserName(event.target.value)} placeholder="Filter by teller" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">GL Account</label>
            <Input value={state.glAccount} onChange={(event) => state.setGlAccount(event.target.value)} placeholder="e.g. 102001" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Trx Code</label>
            <Input value={state.trxCode} onChange={(event) => state.setTrxCode(event.target.value.toUpperCase())} placeholder="SD, SW, GJ..." />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Voucher No.</label>
            <Input value={state.voucherNo} onChange={(event) => state.setVoucherNo(event.target.value)} placeholder="Voucher filter" />
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
            <Button onClick={state.fetchReport} disabled={state.loading} icon={RefreshCw} iconPosition="left">
              {state.loading ? "Loading..." : "Generate Report"}
            </Button>
            <Button variant="outline" onClick={handlePrint} icon={Printer} iconPosition="left">
              Print
            </Button>
            <Button variant="outline" onClick={() => downloadFile(exportUrl, `${DAY_SHEET_MODES[mode].label.replace(/\s+/g, "-").toLowerCase()}.xlsx`)} icon={Download} iconPosition="left">
              Export Excel
            </Button>
            <ModeSwitcher mode={mode} />
          </div>
        </div>
      }
      summary={
        report ? (
          <>
            <ReportSummaryCard title="Rows" value={report.summary.row_count} icon={Table2} />
            <ReportSummaryCard title="Debit Total" value={money(report.summary.total_debit)} />
            <ReportSummaryCard title="Credit Total" value={money(report.summary.total_credit)} />
            <ReportSummaryCard
              title="Balance Check"
              value={report.summary.is_balanced ? "BALANCED" : "UNBALANCED"}
              icon={ArrowLeftRight}
              className={report.summary.is_balanced ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}
            />
          </>
        ) : null
      }
    >
      <div className="w-full min-w-0 p-4 space-y-6">
        {report && (
          <>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight">{report.report_title}</h2>
              <p className="text-sm text-muted-foreground">{report.filter_label}</p>
              <p className="text-xs text-muted-foreground">Branch: {report.report_meta.branch}</p>
            </div>

            <div className="w-full max-w-full overflow-x-auto rounded-lg border">
              <table className="min-w-[1280px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-semibold">Trx No.</th>
                    <th className="px-3 py-2 text-left font-semibold">GL A/C No.</th>
                    <th className="px-3 py-2 text-left font-semibold">A/C No.</th>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Trx Code</th>
                    <th className="px-3 py-2 text-left font-semibold">Voucher No.</th>
                    <th className="px-3 py-2 text-left font-semibold">Selected Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Trx Date</th>
                    <th className="px-3 py-2 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2 text-right font-semibold">Credit</th>
                    <th className="px-3 py-2 text-left font-semibold">User Name</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((row, index) => (
                    <tr key={`${row.trx_number}-${row.gl_account_no}-${index}`} className={cn("border-b transition-colors", selectedRowClass(row), index % 2 === 0 && "bg-background")}>
                      <td className="px-3 py-2 font-mono text-xs">{row.trx_number}</td>
                      <td className="px-3 py-2">{row.gl_account_no}</td>
                      <td className="px-3 py-2">{row.account_no}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        {row.account_name && <div className="text-xs text-muted-foreground">{row.account_name}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.trx_code}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className={cn("text-left underline-offset-4 hover:underline", state.activeVoucher === row.voucher_no && "font-semibold text-primary")}
                          onClick={() => state.setActiveVoucher((current) => (current === row.voucher_no ? "" : row.voucher_no))}
                        >
                          {row.voucher_no}
                        </button>
                      </td>
                      <td className="px-3 py-2">{localDateLabel(row.session_date)}</td>
                      <td className="px-3 py-2">{localDateLabel(row.trx_date)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        <ReportTableCell muted={row.debit === 0}>{money(row.debit)}</ReportTableCell>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <ReportTableCell muted={row.credit === 0}>{money(row.credit)}</ReportTableCell>
                      </td>
                      <td className="px-3 py-2">{row.user_name}</td>
                    </tr>
                  ))}
                  {!report.transactions.length && (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={11}>
                        No journal lines found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/40">
                  <tr className="border-t-2 border-foreground/10 font-semibold">
                    <td className="px-3 py-3" colSpan={8}>
                      Total: {report.summary.row_count}
                    </td>
                    <td className="px-3 py-3 text-right">{money(report.summary.total_debit)}</td>
                    <td className="px-3 py-3 text-right">{money(report.summary.total_credit)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={report.summary.is_balanced ? "default" : "destructive"}>
                        {report.summary.is_balanced ? "BALANCED" : "UNBALANCED"}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Transaction Code Legend</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {report.legend.map((item) => (
                  <div key={item.code} className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <div className="font-semibold">{item.code}</div>
                    <div className="text-muted-foreground">{item.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ReportPageLayout>
  );
}

export function CashierCashStatusReportPage() {
  const { data: session } = useSession();
  const { branches, branchId, setBranchId, isAdmin, branchName } = useBranchOptions();
  const state = useCashierReport(isAdmin ? branchId : (session?.user as any)?.branchId);

  const exportUrl = useMemo(() => {
    const query = buildQueryString({
      sessionDate: state.sessionDate,
      tellerId: state.tellerId === "all" ? "" : state.tellerId,
      branchId: isAdmin ? branchId : (session?.user as any)?.branchId,
      trxCode: state.trxCode,
    });
    return `/api/v1/reports/transactions/cashier-teller-cash-status/export?${query}`;
  }, [branchId, isAdmin, session, state.sessionDate, state.tellerId, state.trxCode]);

  const report = state.report;

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("No data to print. Generate the report first.");
      return;
    }
    const headers = ["GL A/C No.", "A/C No.", "Name", "Trx No.", "Time", "Trx Code", "Source", "Voucher No.", "Trx Date", "Debit", "Credit", "Running Balance", "User Name"];
    const rows = report.transactions.map((row) => [
      row.gl_account_no,
      row.account_no,
      row.name,
      row.trx_number,
      row.time_posted,
      row.trx_code,
      row.source_label,
      row.voucher_no,
      localDateLabel(row.trx_date),
      row.debit,
      row.credit,
      row.running_balance,
      row.user_name,
    ]);
    printReport({
      title: "Cashier / Teller Cash Status",
      subtitle: `Cashier/Teller: ${report.report_meta.teller_code} - ${report.report_meta.teller_name}`,
      period: localDateLabel(report.report_meta.session_date),
      filters: {
        Branch: report.report_meta.branch,
      },
      headers,
      rows,
      totals: ["", "", "", "", "", "", "", "", "Total", report.summary.total_debit, report.summary.total_credit, report.summary.closing_balance, ""],
      summary: {
        Transactions: report.summary.transaction_count,
        "Opening Float": report.summary.opening_float,
        "Net Change": report.summary.net_change,
        "Closing Balance": report.summary.closing_balance,
      },
    });
  }, [report]);

  const rowClass = (row: TellerReportRow) =>
    cn(
      row.is_r2t && "bg-emerald-50",
      row.is_t2r && "bg-sky-50",
      state.activeVoucher && row.voucher_no === state.activeVoucher && "ring-2 ring-primary/40 bg-primary/5",
      row.credit > 0 && row.debit === 0 && "bg-rose-50/40"
    );

  return (
    <ReportPageLayout
      title="Cashier / Teller Cash Status"
      description="Live teller float position and running balance for the selected date."
      generatedAt={state.generatedAt || undefined}
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {isAdmin ? (
            <div className="space-y-2">
              <label className="text-xs font-medium">Branch</label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium">Branch</label>
              <Input value={branchName} disabled />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium">Selected Date</label>
            <Input type="date" value={state.sessionDate} onChange={(event) => state.setSessionDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Teller</label>
            <Select value={state.tellerId} onValueChange={state.setTellerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select teller" />
              </SelectTrigger>
              <SelectContent>
                {state.tellers.map((teller) => (
                  <SelectItem key={teller.id} value={teller.id}>
                    {teller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Trx Code</label>
            <Input value={state.trxCode} onChange={(event) => state.setTrxCode(event.target.value.toUpperCase())} placeholder="R2T, T2R, GJ..." />
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
            <Button onClick={state.fetchReport} disabled={state.loading} icon={RefreshCw} iconPosition="left">
              {state.loading ? "Loading..." : "Generate Report"}
            </Button>
            <Button variant="outline" onClick={handlePrint} icon={Printer} iconPosition="left">
              Print
            </Button>
            <Button variant="outline" onClick={() => downloadFile(exportUrl, "cashier-teller-cash-status.xlsx")} icon={Download} iconPosition="left">
              Export Excel
            </Button>
          </div>
        </div>
      }
      summary={
        report ? (
          <>
            <ReportSummaryCard title="Transactions" value={report.summary.transaction_count} icon={Table2} />
            <ReportSummaryCard title="Opening Float" value={money(report.summary.opening_float)} icon={Users} />
            <ReportSummaryCard title="Net Change" value={money(report.summary.net_change)} icon={ArrowLeftRight} className={report.summary.is_balanced ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"} />
            <ReportSummaryCard title="Closing Balance" value={money(report.summary.closing_balance)} icon={CalendarDays} />
          </>
        ) : null
      }
    >
      <div className="w-full min-w-0 p-4 space-y-6">
        {report && (
          <>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight">Cashier / Teller Cash Status</h2>
              <p className="text-sm text-muted-foreground">
                Reporting Date: {localDateLabel(report.report_meta.session_date)}
              </p>
              <p className="text-xs text-muted-foreground">
                Cashier/Teller No.: {report.report_meta.teller_code} | Teller: {report.report_meta.teller_name}
              </p>
              <p className="text-xs text-muted-foreground">Branch: {report.report_meta.branch}</p>
            </div>

            <div className="w-full max-w-full overflow-x-auto rounded-lg border">
              <table className="min-w-[1480px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-semibold">GL A/C No.</th>
                    <th className="px-3 py-2 text-left font-semibold">A/C No.</th>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Trx No.</th>
                    <th className="px-3 py-2 text-left font-semibold">Time</th>
                    <th className="px-3 py-2 text-left font-semibold">Trx Code</th>
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                    <th className="px-3 py-2 text-left font-semibold">Voucher No.</th>
                    <th className="px-3 py-2 text-left font-semibold">Trx Date</th>
                    <th className="px-3 py-2 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2 text-right font-semibold">Credit</th>
                    <th className="px-3 py-2 text-right font-semibold">Running Balance</th>
                    <th className="px-3 py-2 text-left font-semibold">User Name</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((row, index) => (
                    <tr key={`${row.trx_number}-${row.gl_account_no}-${index}`} className={cn("border-b transition-colors", rowClass(row), index % 2 === 0 && "bg-background")}>
                      <td className="px-3 py-2">{row.gl_account_no}</td>
                      <td className="px-3 py-2">{row.account_no}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.trx_type_label}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.trx_number}</td>
                      <td className="px-3 py-2">{row.time_posted}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.trx_code}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.source_label}</div>
                        <div title={row.source_detail} className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {row.source_detail || row.source_code}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className={cn("text-left underline-offset-4 hover:underline", state.activeVoucher === row.voucher_no && "font-semibold text-primary")}
                          onClick={() => state.setActiveVoucher((current) => (current === row.voucher_no ? "" : row.voucher_no))}
                        >
                          {row.voucher_no}
                        </button>
                      </td>
                      <td className="px-3 py-2">{localDateLabel(row.trx_date)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        <ReportTableCell muted={row.debit === 0}>{money(row.debit)}</ReportTableCell>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <ReportTableCell muted={row.credit === 0}>{money(row.credit)}</ReportTableCell>
                      </td>
                      <td className={cn("px-3 py-2 text-right font-semibold", row.running_balance < 0 && "text-destructive")}>
                        {money(row.running_balance)}
                      </td>
                      <td className="px-3 py-2">{row.user_name}</td>
                    </tr>
                  ))}
                  {!report.transactions.length && (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={13}>
                        No teller lines found for the selected date.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/40">
                  <tr className="border-t-2 border-foreground/10 font-semibold">
                    <td className="px-3 py-3" colSpan={9}>
                      Total: {report.summary.transaction_count}
                    </td>
                    <td className="px-3 py-3 text-right">{money(report.summary.total_debit)}</td>
                    <td className="px-3 py-3 text-right">{money(report.summary.total_credit)}</td>
                    <td className="px-3 py-3 text-right">{money(report.summary.closing_balance)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={report.summary.is_balanced ? "default" : "destructive"}>
                        {report.summary.is_balanced ? "BALANCED" : "UNBALANCED"}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Source Breakdown</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {report.source_breakdown.map((source) => (
                  <div key={source.source_code} className="rounded-md border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{source.source_label}</div>
                        <div className="text-xs text-muted-foreground">{source.source_code}</div>
                      </div>
                      <Badge variant="outline">{source.count}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Debit</div>
                        <div className="font-semibold">{money(source.debit_total)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Credit</div>
                        <div className="font-semibold">{money(source.credit_total)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Net</div>
                        <div className={cn("font-semibold", source.net_amount < 0 ? "text-destructive" : "text-foreground")}>
                          {money(source.net_amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {!report.source_breakdown.length && (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    No source breakdown available for the selected filters.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Signature Block</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Prepared By", report.signature_block.prepared_by],
                  ["Verified By", report.signature_block.verified_by],
                  ["Approved By", report.signature_block.approved_by],
                ].map(([label, value]) => (
                  <div key={label} className="space-y-2">
                    <div className="h-12 rounded-md border-b border-dashed" />
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="text-sm">{value || "________________"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Transaction Code Legend</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {report.legend.map((item) => (
                  <div key={item.code} className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <div className="font-semibold">{item.code}</div>
                    <div className="text-muted-foreground">{item.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ReportPageLayout>
  );
}
