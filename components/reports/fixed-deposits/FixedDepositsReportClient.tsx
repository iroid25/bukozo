"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type BranchOption = { id: string; name: string };

type ConcentrationBand = {
  label: string;
  accountCount: number;
  accountPct: number;
  totalBalance: number;
  balancePct: number;
  averageBalance: number;
};

type ConcentrationSection = {
  productCode: string;
  productName: string;
  bands: ConcentrationBand[];
  total: {
    accountCount: number;
    accountPct: number;
    totalBalance: number;
    balancePct: number;
    averageBalance: number;
  };
};

type ListingRecord = {
  id: string;
  accountNumber: string;
  memberName: string;
  sessionDate: string;
  trxDate: string;
  fdNumber: string;
  depositAmount: number;
  interestAmount: number;
  maturityValue: number;
  maturityDate: string;
  annualRate: number;
  depositPeriod: string;
  atMaturityCode: number;
  atMaturityLabel: string;
};

type WithdrawnRecord = {
  id: string;
  accountNumber: string;
  memberName: string;
  sessionDate: string;
  trxDate: string;
  fdNumber: string;
  depositAmount: number;
  interestPaid: number;
  totalPaid: number;
  maturityDate: string;
  annualRate: number;
  depositPeriod: string;
  isEarlyWithdrawal: boolean;
};

type ListingSection = {
  productCode: string;
  productName: string;
  records: ListingRecord[];
  subtotal: {
    count: number;
    depositAmount: number;
    interestAmount: number;
    maturityValue: number;
  };
};

type WithdrawnSection = {
  productCode: string;
  productName: string;
  records: WithdrawnRecord[];
  subtotal: {
    count: number;
    depositAmount: number;
    interestPaid: number;
    totalPaid: number;
  };
};

type FixedDepositReport =
  | {
      saccoName: string;
      branch: string;
      branchLocation?: string;
      reportTitle: string;
      reportDate: string;
      generatedAt: string;
      sections: ConcentrationSection[];
      grandTotal: ConcentrationSection["total"];
      legend?: string[];
    }
  | {
      saccoName: string;
      branch: string;
      branchLocation?: string;
      reportTitle: string;
      reportDate: string;
      generatedAt: string;
      dateRange: { from: string; to: string };
      sections: ListingSection[] | WithdrawnSection[];
      grandTotal: ListingSection["subtotal"] | WithdrawnSection["subtotal"];
      legend?: string[];
    };

type FixedDepositMode = "concentration" | "listing" | "withdrawn";

type Props = {
  mode: FixedDepositMode;
};

const modeConfig: Record<
  FixedDepositMode,
  {
    title: string;
    description: string;
    endpoint: string;
    exportEndpoint: string;
  }
> = {
  concentration: {
    title: "Fixed Concentration Report",
    description: "Balance concentration bands for fixed deposit accounts.",
    endpoint: "/api/v1/reports/fixed-deposits/concentration",
    exportEndpoint: "/api/v1/reports/fixed-deposits/concentration/export",
  },
  listing: {
    title: "Fixed Deposit Listing",
    description: "Detailed listing of fixed deposits opened in the selected period.",
    endpoint: "/api/v1/reports/fixed-deposits/listing",
    exportEndpoint: "/api/v1/reports/fixed-deposits/listing/export",
  },
  withdrawn: {
    title: "Fixed Deposits Withdrawn Report",
    description: "Withdrawn and matured fixed deposits within the selected period.",
    endpoint: "/api/v1/reports/fixed-deposits/withdrawn",
    exportEndpoint: "/api/v1/reports/fixed-deposits/withdrawn/export",
  },
};

function currency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function toDisplayDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd/MM/yyyy");
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function branchName(branches: BranchOption[], branchId: string, fallback: string) {
  if (branchId === "all") return "All Branches";
  return branches.find((branch) => branch.id === branchId)?.name || fallback;
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

export function FixedDepositsReportClient({ mode }: Props) {
  const { data: session } = useSession();
  const config = modeConfig[mode];

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<FixedDepositReport | null>(null);
  const hasLoadedRef = useRef(false);
  const [filters, setFilters] = useState({
    branchId: "all",
    reportDate: todayIso(),
    fromDate: todayIso(),
    toDate: todayIso(),
    memberSearch: "",
  });

  const userRole = String((session?.user as any)?.role || "").toUpperCase();
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";
  const fallbackBranchName = isAdmin ? "All Branches" : "Assigned Branch";
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  const loadBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) return;
      const json = await response.json();
      setBranches(Array.isArray(json?.data) ? json.data.map((branch: any) => ({ id: branch.id, name: branch.name })) : []);
    } catch (error) {
      console.error("Failed to load branches", error);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin ? filters.branchId !== "all" : userBranchId) {
        params.set("branchId", isAdmin ? filters.branchId : String(userBranchId));
      }

      if (mode === "concentration") {
        params.set("reportDate", filters.reportDate);
      } else {
        params.set("fromDate", filters.fromDate);
        params.set("toDate", filters.toDate);
        if (filters.memberSearch.trim()) {
          params.set("memberSearch", filters.memberSearch.trim());
        }
      }

      const response = await fetch(`${config.endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load report");
      }

      setReport(json.data);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, filters.branchId, filters.fromDate, filters.memberSearch, filters.reportDate, filters.toDate, isAdmin, mode, userBranchId]);

  useEffect(() => {
    void loadBranches();
    void loadReport();
  }, [loadBranches, loadReport]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin ? filters.branchId !== "all" : userBranchId) {
        params.set("branchId", isAdmin ? filters.branchId : String(userBranchId));
      }

      if (mode === "concentration") {
        params.set("reportDate", filters.reportDate);
      } else {
        params.set("fromDate", filters.fromDate);
        params.set("toDate", filters.toDate);
        if (filters.memberSearch.trim()) {
          params.set("memberSearch", filters.memberSearch.trim());
        }
      }

      const response = await fetch(`${config.exportEndpoint}?${params.toString()}`, { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to export report");
      }

      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `${mode}-fixed-deposits-${Date.now()}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Excel export failed");
    } finally {
      setExporting(false);
    }
  }, [config.exportEndpoint, filters.branchId, filters.fromDate, filters.memberSearch, filters.reportDate, filters.toDate, isAdmin, mode, userBranchId]);

  const branchLabel = isAdmin
    ? branchName(branches, filters.branchId, fallbackBranchName)
    : branchName(branches, userBranchId || "", fallbackBranchName);

  const generatedAt = report?.generatedAt ? format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm:ss") : undefined;
  const periodLabel =
    mode === "concentration"
      ? `Reporting Date: ${toDisplayDate(filters.reportDate)}`
      : `Reporting Date From: ${toDisplayDate(filters.fromDate)} To: ${toDisplayDate(filters.toDate)}`;

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("No data to print. Generate the report first.");
      return;
    }

    const period = periodLabel;

    if (mode === "concentration") {
      const sections = report.sections as ConcentrationSection[];
      if (sections.length === 0) return;
      const headers = ["Size of Account", "Account (count)", "Account %", "Balance Amount", "Balance %", "Average Balance"];
      const allRows: (string | number)[][] = [];
      for (const section of sections) {
        for (const band of section.bands) {
          allRows.push([
            `${section.productCode} - ${section.productName}`,
            band.label,
            band.accountCount,
            `${band.accountPct.toFixed(2)}%`,
            band.totalBalance,
            `${band.balancePct.toFixed(2)}%`,
            band.averageBalance,
          ]);
        }
      }
      const headersWithProduct = ["Product", ...headers];
      const gt = report.grandTotal as ConcentrationSection["total"];
      const totals = ["GRAND TOTAL", "", "", "", gt.totalBalance, "", gt.averageBalance];
      printReport({ title: config.title, subtitle: config.description, period, headers: headersWithProduct, rows: allRows, totals });
      return;
    }

    const allRows: (string | number)[][] = [];
    for (const section of report.sections) {
      if (mode === "listing") {
        const s = section as ListingSection;
        for (const r of s.records) {
          allRows.push([
            r.accountNumber,
            r.memberName,
            toDisplayDate(r.sessionDate),
            toDisplayDate(r.trxDate),
            r.fdNumber,
            r.depositAmount,
            r.interestAmount,
            r.maturityValue,
            toDisplayDate(r.maturityDate),
            `${r.annualRate.toFixed(2)}%`,
            r.depositPeriod,
            r.atMaturityLabel,
          ]);
        }
      } else {
        const s = section as WithdrawnSection;
        for (const r of s.records) {
          allRows.push([
            r.accountNumber,
            r.memberName,
            toDisplayDate(r.sessionDate),
            toDisplayDate(r.trxDate),
            r.fdNumber,
            r.depositAmount,
            r.interestPaid,
            r.totalPaid,
            toDisplayDate(r.maturityDate),
            `${r.annualRate.toFixed(2)}%`,
            r.depositPeriod,
          ]);
        }
      }
    }

    if (mode === "listing") {
      const gt = report.grandTotal as ListingSection["subtotal"];
      const headers = ["A/C No.", "Name", "Session Date", "Trx Date", "Fixed Deposit No.", "Deposit Amount", "Interest Amount", "Maturity Value", "Maturity Date", "Annual Int. Rate (%)", "Deposit Period", "Maturity Code"];
      const totals = ["GRAND TOTAL", "", "", "", "", gt.depositAmount, gt.interestAmount, gt.maturityValue, "", `${gt.count} records`];
      printReport({ title: config.title, subtitle: config.description, period, headers, rows: allRows, totals });
    } else {
      const gt = report.grandTotal as WithdrawnSection["subtotal"];
      const headers = ["A/C No.", "Name", "Session Date", "Trx Date", "Fixed Deposit No.", "Deposit Amount", "Interest Paid", "Total Paid", "Maturity Date", "Annual Int. Rate %", "Deposit Period"];
      const totals = ["GRAND TOTAL", "", "", "", "", gt.depositAmount, gt.interestPaid, gt.totalPaid, "", `${gt.count} records`];
      printReport({ title: config.title, subtitle: config.description, period, headers, rows: allRows, totals });
    }
  }, [config.title, config.description, mode, report, periodLabel]);

  const summary = useMemo(() => {
    if (!report) return null;

    if (mode === "concentration") {
      const gt = report.grandTotal as ConcentrationSection["total"];
      const totalBands = (report.sections as ConcentrationSection[]).reduce((sum, s) => sum + s.bands.length, 0);
      return (
        <>
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{Number(gt.accountCount || 0).toLocaleString()}</CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">UGX {currency(gt.totalBalance || 0)}</CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Balance</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">UGX {currency(gt.averageBalance || 0)}</CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bands</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{Number(totalBands).toLocaleString()}</CardContent>
          </Card>
        </>
      );
    }

    const grandTotal = report.grandTotal as ListingSection["subtotal"] | WithdrawnSection["subtotal"];
    const isWithdrawn = mode === "withdrawn";
    return (
      <>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{Number(grandTotal.count || 0).toLocaleString()}</CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposit Amount</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">UGX {currency(grandTotal.depositAmount || 0)}</CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isWithdrawn ? "Interest Paid" : "Interest Amount"}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            UGX {currency(isWithdrawn ? Number((grandTotal as WithdrawnSection["subtotal"]).interestPaid || 0) : Number((grandTotal as ListingSection["subtotal"]).interestAmount || 0))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isWithdrawn ? "Total Paid" : "Maturity Value"}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            UGX {currency(isWithdrawn ? Number((grandTotal as WithdrawnSection["subtotal"]).totalPaid || 0) : Number((grandTotal as ListingSection["subtotal"]).maturityValue || 0))}
          </CardContent>
        </Card>
      </>
    );
  }, [mode, report]);

  const filtersNode = (
    <div className="grid w-full gap-4 lg:grid-cols-6">
      {isAdmin ? (
        <div className="space-y-2 lg:col-span-2">
          <Label>Branch</Label>
          <Select value={filters.branchId} onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}>
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
        <div className="space-y-2 lg:col-span-2">
          <Label>Branch</Label>
          <Input value={branchLabel} disabled />
        </div>
      )}

      {mode === "concentration" ? (
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="reportDate">Reporting Date</Label>
          <Input
            id="reportDate"
            type="date"
            value={filters.reportDate}
            onChange={(e) => setFilters((current) => ({ ...current, reportDate: e.target.value }))}
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="fromDate">From</Label>
            <Input
              id="fromDate"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((current) => ({ ...current, fromDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toDate">To</Label>
            <Input
              id="toDate"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((current) => ({ ...current, toDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="memberSearch">Member / Account</Label>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                id="memberSearch"
                value={filters.memberSearch}
                onChange={(e) => setFilters((current) => ({ ...current, memberSearch: e.target.value }))}
                placeholder="Search member name or account"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-end gap-2 lg:col-span-2">
        <Button variant="outline" className="flex-1" onClick={() => void loadReport()} disabled={loading}>
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Generate
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => void exportExcel()} disabled={exporting || !report}>
          {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Excel
        </Button>
        <Button variant="outline" className="flex-1" onClick={handlePrint} disabled={!report}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || !report}>
        {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Export
      </Button>
      <Button variant="outline" onClick={handlePrint} disabled={!report}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );

  const pageTitle = config.title;

  return (
    <ReportPageLayout
      title={pageTitle}
      description={config.description}
      period={periodLabel}
      generatedAt={generatedAt}
      summaryFirst
      fitContent
      filters={filtersNode}
      actions={actions}
      summary={summary}
    >
      <div className="space-y-6 p-4 md:p-6">
        <SaccoReportHeader
          title={pageTitle}
          subtitle={config.description}
          branchLabel={report?.branch || branchLabel}
          periodLabel={periodLabel}
          generatedAt={generatedAt}
        />

        {!report && !loading ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
            Generate the report to view results.
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border bg-muted/30 p-8 text-center text-muted-foreground">
            Loading report...
          </div>
        ) : null}

        {report && mode === "concentration" ? (
          <div className="space-y-4">
            {(report.sections as ConcentrationSection[]).map((section) => (
              <details key={section.productCode} open className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Product</div>
                    <div className="text-lg font-bold text-slate-950">
                      {section.productCode} - {section.productName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">Accounts {Number(section.total.accountCount).toLocaleString()}</Badge>
                    <Badge variant="secondary">Balance UGX {currency(section.total.totalBalance)}</Badge>
                  </div>
                </summary>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full border-collapse text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        {[
                          "Size of Account",
                          "Account (count)",
                          "Account %",
                          "Balance Amount",
                          "Balance %",
                          "Average Balance",
                        ].map((header) => (
                          <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.bands.map((band) => (
                        <tr key={band.label} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{band.label}</td>
                          <td className="px-4 py-3 tabular-nums">{Number(band.accountCount).toLocaleString()}</td>
                          <td className="px-4 py-3 tabular-nums">{percent(band.accountPct)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(band.totalBalance)}</td>
                          <td className="px-4 py-3 tabular-nums">{percent(band.balancePct)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(band.averageBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-100 font-bold">
                        <td className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 tabular-nums">{Number(section.total.accountCount).toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums">100.00%</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.total.totalBalance)}</td>
                        <td className="px-4 py-3 tabular-nums">100.00%</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.total.averageBalance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ))}
          </div>
        ) : null}

        {report && mode === "listing" ? (
          <div className="space-y-4">
            {(report.sections as ListingSection[]).map((section) => (
              <details key={section.productCode} open className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Product</div>
                    <div className="text-lg font-bold text-slate-950">
                      {section.productCode} - {section.productName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">Records {Number(section.subtotal.count).toLocaleString()}</Badge>
                    <Badge variant="secondary">Deposit UGX {currency(section.subtotal.depositAmount)}</Badge>
                    <Badge variant="secondary">Maturity UGX {currency(section.subtotal.maturityValue)}</Badge>
                  </div>
                </summary>
                <div className="overflow-x-auto">
                  <table className="min-w-[1380px] w-full border-collapse text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        {[
                          "A/C No.",
                          "Name",
                          "Session Date",
                          "Trx Date",
                          "Fixed Deposit No.",
                          "Deposit Amount",
                          "Interest Amount",
                          "Maturity Value",
                          "Maturity Date",
                          "Annual Int. Rate (%)",
                          "Deposit Period",
                          "Transaction at Maturity",
                        ].map((header) => (
                          <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.records.map((record) => (
                        <tr key={record.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{record.accountNumber}</td>
                          <td className="px-4 py-3 max-w-[260px] truncate" title={record.memberName}>
                            {record.memberName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{toDisplayDate(record.sessionDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toDisplayDate(record.trxDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{record.fdNumber}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.depositAmount)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.interestAmount)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.maturityValue)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toDisplayDate(record.maturityDate)}</td>
                          <td className="px-4 py-3 tabular-nums">{Number(record.annualRate).toFixed(2)}%</td>
                          <td className="px-4 py-3 whitespace-nowrap">{record.depositPeriod}</td>
                          <td className="px-4 py-3">{record.atMaturityCode} <span className="text-xs text-muted-foreground">{record.atMaturityLabel}</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-100 font-bold">
                        <td className="px-4 py-3" colSpan={5}>SUBTOTAL</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.depositAmount)}</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.interestAmount)}</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.maturityValue)}</td>
                        <td className="px-4 py-3" colSpan={4}>
                          {Number(section.subtotal.count).toLocaleString()} records
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ))}

            <div className="rounded-2xl border bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              GRAND TOTAL: {Number((report.grandTotal as ListingSection["subtotal"]).count || 0).toLocaleString()} records | Deposit UGX {currency((report.grandTotal as ListingSection["subtotal"]).depositAmount || 0)} | Interest UGX {currency((report.grandTotal as ListingSection["subtotal"]).interestAmount || 0)} | Maturity UGX {currency((report.grandTotal as ListingSection["subtotal"]).maturityValue || 0)}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transaction at Maturity Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(report.legend || []).map((item: string) => (
                  <div key={item} className="rounded-lg border bg-muted/30 px-3 py-2">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {report && mode === "withdrawn" ? (
          <div className="space-y-4">
            {(report.sections as WithdrawnSection[]).map((section) => (
              <details key={section.productCode} open className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Product</div>
                    <div className="text-lg font-bold text-slate-950">
                      {section.productCode} - {section.productName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">Records {Number(section.subtotal.count).toLocaleString()}</Badge>
                    <Badge variant="secondary">Deposit UGX {currency(section.subtotal.depositAmount)}</Badge>
                    <Badge variant="secondary">Total Paid UGX {currency(section.subtotal.totalPaid)}</Badge>
                  </div>
                </summary>
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full border-collapse text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        {[
                          "A/C No.",
                          "Name",
                          "Session Date",
                          "Trx Date",
                          "Fixed Deposit No.",
                          "Deposit Amount",
                          "Interest Paid",
                          "Total Paid",
                          "Maturity Date",
                          "Annual Int. Rate %",
                          "Deposit Period",
                        ].map((header) => (
                          <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.records.map((record) => (
                        <tr
                          key={record.id}
                          className={`border-b last:border-0 ${record.isEarlyWithdrawal ? "bg-rose-50" : ""}`}
                        >
                          <td className="px-4 py-3 font-medium">{record.accountNumber}</td>
                          <td className="px-4 py-3 max-w-[260px] truncate" title={record.memberName}>
                            {record.memberName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{toDisplayDate(record.sessionDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="space-y-1">
                              <div>{toDisplayDate(record.trxDate)}</div>
                              {record.isEarlyWithdrawal ? <Badge variant="destructive" className="w-fit">Early</Badge> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{record.fdNumber}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.depositAmount)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.interestPaid)}</td>
                          <td className="px-4 py-3 tabular-nums">UGX {currency(record.totalPaid)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toDisplayDate(record.maturityDate)}</td>
                          <td className="px-4 py-3 tabular-nums">{Number(record.annualRate).toFixed(2)}%</td>
                          <td className="px-4 py-3 whitespace-nowrap">{record.depositPeriod}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-100 font-bold">
                        <td className="px-4 py-3" colSpan={5}>SUBTOTAL</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.depositAmount)}</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.interestPaid)}</td>
                        <td className="px-4 py-3 tabular-nums">UGX {currency(section.subtotal.totalPaid)}</td>
                        <td className="px-4 py-3" colSpan={3}>
                          {Number(section.subtotal.count).toLocaleString()} records
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ))}

            <div className="rounded-2xl border bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              GRAND TOTAL: {Number((report.grandTotal as WithdrawnSection["subtotal"]).count || 0).toLocaleString()} records | Deposit UGX {currency((report.grandTotal as WithdrawnSection["subtotal"]).depositAmount || 0)} | Interest UGX {currency((report.grandTotal as WithdrawnSection["subtotal"]).interestPaid || 0)} | Total Paid UGX {currency((report.grandTotal as WithdrawnSection["subtotal"]).totalPaid || 0)}
            </div>
          </div>
        ) : null}
      </div>
    </ReportPageLayout>
  );
}
