"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Table2,
  UserCheck,
  Wallet,
} from "lucide-react";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  GeneralTransactionRegisterReport,
  GeneralTransactionRegisterRow,
  TransactionJournalListingReport,
  TransactionJournalListingRow,
} from "@/lib/reports/transaction-journal-reports";

type BranchOption = {
  id: string;
  name: string;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Number(value || 0));
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

function buildQueryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) query.set(key, value.trim());
  });
  return query.toString();
}

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("Failed to download export");
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

function useBranchOptions() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("all");

  const role = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = role === "ADMIN";

  useEffect(() => {
    if (!isAdmin && userBranchId) setBranchId(userBranchId);
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

function ReportTableCell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <span className={cn(muted && "text-muted-foreground")}>{children}</span>;
}

function useGeneralRegister(branchId?: string) {
  const [fromDate, setFromDate] = useState(localDateInput(new Date()));
  const [toDate, setToDate] = useState(localDateInput(new Date()));
  const [userName, setUserName] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [trxCode, setTrxCode] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [report, setReport] = useState<GeneralTransactionRegisterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = buildQueryString({
        fromDate,
        toDate,
        branchId,
        userName,
        glAccount,
        trxCode,
        voucherNo,
        memberSearch,
      });
      const response = await fetch(`/api/v1/reports/transactions/general-transaction-register?${query}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load register");
      const data = result.data as GeneralTransactionRegisterReport;
      setReport(data);
      setGeneratedAt(localDateTimeLabel(data.report_meta.generated_at));
      if (!activeVoucher && data.transactions.length > 0) {
        setActiveVoucher(data.transactions[0].voucher_group_id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load general transaction register");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

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
    memberSearch,
    setMemberSearch,
    report,
    loading,
    fetchReport,
    generatedAt,
    activeVoucher,
    setActiveVoucher,
  };
}

function useJournalListing(branchId?: string) {
  const [fromDate, setFromDate] = useState(localDateInput(new Date()));
  const [toDate, setToDate] = useState(localDateInput(new Date()));
  const [userName, setUserName] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [trxCode, setTrxCode] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [report, setReport] = useState<TransactionJournalListingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = buildQueryString({
        fromDate,
        toDate,
        branchId,
        userName,
        glAccount,
        trxCode,
        voucherNo,
        memberSearch,
        textSearch,
      });
      const response = await fetch(`/api/v1/reports/transactions/transaction-journal-listing?${query}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load journal listing");
      const data = result.data as TransactionJournalListingReport;
      setReport(data);
      setGeneratedAt(localDateTimeLabel(data.report_meta.generated_at));
      if (!activeVoucher && data.transactions.length > 0) {
        setActiveVoucher(data.transactions[0].voucher_group_id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load transaction journal listing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

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
    memberSearch,
    setMemberSearch,
    textSearch,
    setTextSearch,
    report,
    loading,
    fetchReport,
    generatedAt,
    activeVoucher,
    setActiveVoucher,
  };
}

function registerRowClass(row: GeneralTransactionRegisterRow, activeVoucher: string) {
  return cn(
    row.is_t2r && "bg-sky-50",
    row.trx_code === "GJ" && row.gl_account_no.startsWith("5") && "bg-amber-50",
    row.is_system_account && "text-muted-foreground/80",
    activeVoucher && row.voucher_group_id === activeVoucher && "ring-2 ring-primary/40 bg-primary/5",
    row.is_debit_leg && "border-l-2 border-emerald-500",
    row.is_credit_leg && "border-l-2 border-sky-500",
  );
}

function journalRowClass(row: TransactionJournalListingRow, activeVoucher: string) {
  return cn(
    row.is_t2r && "bg-sky-50",
    row.is_mobile_channel && "bg-violet-50",
    row.is_third_party && "bg-amber-50",
    row.is_system_account && "text-muted-foreground/80",
    activeVoucher && row.voucher_group_id === activeVoucher && "ring-2 ring-primary/40 bg-primary/5",
    row.is_debit_leg && "border-l-2 border-emerald-500",
    row.is_credit_leg && "border-l-2 border-sky-500",
  );
}

export function GeneralTransactionRegisterReportPage({ dense = false }: { dense?: boolean } = {}) {
  const { data: session } = useSession();
  const { branches, branchId, setBranchId, isAdmin, branchName } = useBranchOptions();
  const state = useGeneralRegister(isAdmin ? branchId : (session?.user as any)?.branchId);

  const exportUrl = useMemo(() => {
    const query = buildQueryString({
      fromDate: state.fromDate,
      toDate: state.toDate,
      branchId: isAdmin ? branchId : (session?.user as any)?.branchId,
      userName: state.userName,
      glAccount: state.glAccount,
      trxCode: state.trxCode,
      voucherNo: state.voucherNo,
      memberSearch: state.memberSearch,
    });
    return `/api/v1/reports/transactions/general-transaction-register/export?${query}`;
  }, [branchId, isAdmin, session, state.fromDate, state.glAccount, state.memberSearch, state.toDate, state.trxCode, state.userName, state.voucherNo]);

  const report = state.report;

  return (
    <ReportPageLayout
      title={report?.report_title || "General Trx Register by Trx Date"}
      description="Complete double-entry GL transaction register filtered by transaction date."
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
          <div className="space-y-2">
            <label className="text-xs font-medium">Member Search</label>
            <Input value={state.memberSearch} onChange={(event) => state.setMemberSearch(event.target.value)} placeholder="Search member or account" />
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
            <Button onClick={state.fetchReport} disabled={state.loading} icon={RefreshCw} iconPosition="left">
              {state.loading ? "Loading..." : "Generate Report"}
            </Button>
            <Button variant="outline" onClick={() => window.print()} icon={Printer} iconPosition="left">
              Print
            </Button>
            <Button variant="outline" onClick={() => downloadFile(exportUrl, "general-transaction-register.xlsx")} icon={Download} iconPosition="left">
              Export Excel
            </Button>
          </div>
        </div>
      }
      summary={
        report ? (
          <>
            <ReportSummaryCard title="Rows" value={report.summary.row_count} icon={Table2} />
            <ReportSummaryCard title="Debit Total" value={money(report.summary.total_debit)} icon={Wallet} />
            <ReportSummaryCard title="Credit Total" value={money(report.summary.total_credit)} icon={ArrowLeftRight} />
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
              <p className="text-sm text-muted-foreground">
                Reporting Date From: {localDateLabel(report.report_meta.from_date)} To: {localDateLabel(report.report_meta.to_date)}
              </p>
              <p className="text-xs text-muted-foreground">Branch: {report.report_meta.branch}</p>
            </div>

            <div className="w-full max-w-full overflow-x-auto rounded-lg border">
              <table className={cn("w-full border-collapse text-sm", dense ? "min-w-[1120px]" : "min-w-[1280px]")}>
                <thead className="sticky top-0 z-10 bg-muted/60">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-semibold">Trx No.</th>
                    <th className="px-2 py-2 text-left font-semibold">GL A/C No.</th>
                    <th className="px-2 py-2 text-left font-semibold">A/C No.</th>
                    <th className="px-2 py-2 text-left font-semibold">Name</th>
                    <th className="px-2 py-2 text-left font-semibold">Trx Code</th>
                    <th className="px-2 py-2 text-left font-semibold">Voucher No.</th>
                    <th className="px-2 py-2 text-left font-semibold">Selected Date</th>
                    <th className="px-2 py-2 text-left font-semibold">Trx Date</th>
                    <th className="px-2 py-2 text-right font-semibold">Debit</th>
                    <th className="px-2 py-2 text-right font-semibold">Credit</th>
                    <th className="px-2 py-2 text-left font-semibold">User Name</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((row, index) => (
                    <tr key={`${row.trx_number}-${row.gl_account_no}-${index}`} className={cn("border-b transition-colors", registerRowClass(row, state.activeVoucher), index % 2 === 0 && "bg-background")}>
                      <td className="px-2 py-2 font-mono text-[11px] whitespace-nowrap">{row.trx_number}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{row.gl_account_no}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{row.account_no}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{row.name}</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Badge variant="outline">{row.trx_code}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className={cn("text-left underline-offset-4 hover:underline", state.activeVoucher === row.voucher_group_id && "font-semibold text-primary")}
                          onClick={() => state.setActiveVoucher((current) => (current === row.voucher_group_id ? "" : row.voucher_group_id))}
                        >
                          {row.voucher_no}
                        </button>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{localDateLabel(row.session_date)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{localDateLabel(row.trx_date)}</td>
                      <td className="px-2 py-2 text-right font-medium">
                        <ReportTableCell muted={row.debit === 0}>{money(row.debit)}</ReportTableCell>
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        <ReportTableCell muted={row.credit === 0}>{money(row.credit)}</ReportTableCell>
                      </td>
                      <td className="px-2 py-2">{row.user_name}</td>
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
                    <td className="px-2 py-3" colSpan={8}>
                      Total: {report.summary.row_count}
                    </td>
                    <td className="px-2 py-3 text-right">{money(report.summary.total_debit)}</td>
                    <td className="px-2 py-3 text-right">{money(report.summary.total_credit)}</td>
                    <td className="px-2 py-3">
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

export function TransactionJournalListingReportPage() {
  const { data: session } = useSession();
  const { branches, branchId, setBranchId, isAdmin, branchName } = useBranchOptions();
  const state = useJournalListing(isAdmin ? branchId : (session?.user as any)?.branchId);

  const exportUrl = useMemo(() => {
    const query = buildQueryString({
      fromDate: state.fromDate,
      toDate: state.toDate,
      branchId: isAdmin ? branchId : (session?.user as any)?.branchId,
      userName: state.userName,
      glAccount: state.glAccount,
      trxCode: state.trxCode,
      voucherNo: state.voucherNo,
      memberSearch: state.memberSearch,
      textSearch: state.textSearch,
    });
    return `/api/v1/reports/transactions/transaction-journal-listing/export?${query}`;
  }, [branchId, isAdmin, session, state.fromDate, state.glAccount, state.memberSearch, state.textSearch, state.toDate, state.trxCode, state.userName, state.voucherNo]);

  const report = state.report;

  return (
    <ReportPageLayout
      title={report?.report_title || "Transaction Journal Listing By Selected Date"}
      description="Complete double-entry GL journal listing filtered by the selected date."
      generatedAt={state.generatedAt || undefined}
      summaryColumns={6}
      filters={
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isAdmin ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Branch</label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-8 text-xs">
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Branch</label>
              <Input className="h-8 text-xs" value={branchName} disabled />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">From Date</label>
            <Input className="h-8 text-xs" type="date" value={state.fromDate} onChange={(e) => state.setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">To Date</label>
            <Input className="h-8 text-xs" type="date" value={state.toDate} onChange={(e) => state.setToDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">User / Teller</label>
            <Input className="h-8 text-xs" value={state.userName} onChange={(e) => state.setUserName(e.target.value)} placeholder="Filter by teller name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">GL Account</label>
            <Input className="h-8 text-xs" value={state.glAccount} onChange={(e) => state.setGlAccount(e.target.value)} placeholder="e.g. 102001" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Trx Code</label>
            <Input className="h-8 text-xs" value={state.trxCode} onChange={(e) => state.setTrxCode(e.target.value.toUpperCase())} placeholder="SD, SW, GJ…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Voucher / Ref</label>
            <Input className="h-8 text-xs" value={state.voucherNo} onChange={(e) => state.setVoucherNo(e.target.value)} placeholder="Voucher or reference" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Member / Account</label>
            <Input className="h-8 text-xs" value={state.memberSearch} onChange={(e) => state.setMemberSearch(e.target.value)} placeholder="Name or account no." />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <label className="text-xs font-medium">Text / Memo Search</label>
            <Input className="h-8 text-xs" value={state.textSearch} onChange={(e) => state.setTextSearch(e.target.value)} placeholder="Search in description or transaction text" />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <Button size="sm" onClick={state.fetchReport} disabled={state.loading} icon={RefreshCw} iconPosition="left">
              {state.loading ? "Loading…" : "Generate Report"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} icon={Printer} iconPosition="left">
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadFile(exportUrl, "transaction-journal-listing.xlsx")} icon={Download} iconPosition="left">
              Export Excel
            </Button>
          </div>
        </div>
      }
      summary={
        report ? (
          <>
            <ReportSummaryCard title="Rows" value={report.summary.row_count} icon={Table2} />
            <ReportSummaryCard title="Debit Total" value={money(report.summary.total_debit)} icon={Wallet} />
            <ReportSummaryCard title="Credit Total" value={money(report.summary.total_credit)} icon={ArrowLeftRight} />
            <ReportSummaryCard
              title="Balance Check"
              value={report.summary.is_balanced ? "BALANCED" : "UNBALANCED"}
              icon={ArrowLeftRight}
              className={report.summary.is_balanced ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}
            />
            <ReportSummaryCard title="Mobile Txns" value={report.summary.mobile_channel_count} icon={FileText} />
            <ReportSummaryCard title="Supervisor Txns" value={report.summary.supervisor_count} icon={UserCheck} />
          </>
        ) : null
      }
    >
      <div className="w-full min-w-0 p-4 space-y-4">
        {report && (
          <>
            <div className="space-y-0.5 text-center">
              <h2 className="text-lg font-semibold tracking-tight">{report.report_title}</h2>
              <p className="text-xs text-muted-foreground">
                Selected Date Range: {localDateLabel(report.report_meta.from_date)} — {localDateLabel(report.report_meta.to_date)}
                &ensp;&bull;&ensp;Branch: {report.report_meta.branch}
              </p>
            </div>

            <div className="w-full max-w-full overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1360px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">GL A/C</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">A/C No.</th>
                    <th className="px-2 py-2 text-left font-semibold">Name</th>
                    <th className="px-2 py-2 text-left font-semibold">Voucher / Text</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Trx Ref</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Code</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Selected Date</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Trx Date</th>
                    <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Debit</th>
                    <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Credit</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Supervisor</th>
                    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Teller</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((row, index) => (
                    <tr
                      key={`${row.trx_number}-${row.gl_account_no}-${index}`}
                      className={cn("border-b transition-colors", journalRowClass(row, state.activeVoucher), index % 2 === 0 && "bg-background")}
                    >
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">{row.gl_account_no}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{row.account_no}</td>
                      <td className="px-2 py-1.5 max-w-[140px]">
                        <span className="font-medium line-clamp-1" title={row.name}>{row.name}</span>
                      </td>
                      <td className="px-2 py-1.5 max-w-[180px]">
                        <button
                          type="button"
                          className={cn("text-left underline-offset-4 hover:underline w-full", state.activeVoucher === row.voucher_group_id && "font-semibold text-primary")}
                          onClick={() => state.setActiveVoucher((cur) => (cur === row.voucher_group_id ? "" : row.voucher_group_id))}
                          title={row.transaction_text}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="italic">{row.voucher_no}</span>
                            {row.transaction_text && row.transaction_text !== row.voucher_no && (
                              <span className="text-[10px] text-muted-foreground not-italic line-clamp-1">{row.transaction_text}</span>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">{row.trx_number}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{row.trx_code}</Badge>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{localDateLabel(row.session_date)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{localDateLabel(row.trx_date)}</td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        <ReportTableCell muted={row.debit === 0}>{money(row.debit)}</ReportTableCell>
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        <ReportTableCell muted={row.credit === 0}>{money(row.credit)}</ReportTableCell>
                      </td>
                      <td className="px-2 py-1.5">
                        {row.supervisor_name ? (
                          <Badge variant="outline" className="gap-1 text-[10px] px-1 py-0">
                            <UserCheck className="h-2.5 w-2.5" />
                            {row.supervisor_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{row.user_name}</td>
                    </tr>
                  ))}
                  {!report.transactions.length && (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={12}>
                        No journal lines found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/40">
                  <tr className="border-t-2 border-foreground/10 font-semibold text-xs">
                    <td className="px-2 py-2.5" colSpan={8}>
                      {report.summary.row_count} entries &bull; {report.summary.unique_vouchers} vouchers &bull; {report.summary.unique_tellers} tellers
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{money(report.summary.total_debit)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{money(report.summary.total_credit)}</td>
                    <td className="px-2 py-2.5" colSpan={2}>
                      <Badge variant={report.summary.is_balanced ? "default" : "destructive"} className="text-[10px]">
                        {report.summary.is_balanced ? "BALANCED" : `UNBALANCED ${money(Math.abs(report.summary.imbalance_amount))}`}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold">Transaction Code Legend</h3>
              </div>
              <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {report.legend.map((item) => (
                  <div key={item.code} className="rounded border bg-muted/30 px-2 py-1.5 text-[11px]">
                    <div className="font-semibold">{item.code}</div>
                    <div className="text-muted-foreground leading-tight">{item.meaning}</div>
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
