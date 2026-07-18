"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { cn } from "@/lib/utils";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type AccountRow = {
  rank: number;
  account_no: string;
  member_id: string;
  member_name: string;
  address: string;
  bvn_tin: string;
  phone: string;
  ref_no: number | null;
  balance: number;
  product_code: string;
  product_name: string;
  rank_display: string;
  phone_anomaly: boolean;
};

type ReportProduct = {
  product_code: string;
  product_name: string;
  accounts: AccountRow[];
  subtotal: {
    count: number;
    total_balance: number;
  };
};

type TopBottomReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    report_date: string;
    start_date: string;
    end_date: string;
    account_category: "savings" | "shares";
    mode: "top" | "bottom";
    n: number | null;
    exclude_zero: boolean;
  };
  products: ReportProduct[];
  summary: {
    top_account: { name: string; balance: number; account_no: string } | null;
    bottom_account: { name: string; balance: number; account_no: string } | null;
    list_total: number;
    list_average: number;
    portfolio_coverage_pct: number;
    zero_balance_count: number;
    standard_share_value?: number;
    members_at_standard?: number;
    members_above_standard?: number;
    members_below_standard?: number;
    zero_shareholders?: number;
  };
  grand_total: {
    count: number;
    total_balance: number;
  };
};

type Props = {
  accountCategory: "savings" | "shares";
  title: string;
  description: string;
  switchHref: string;
  switchLabel: string;
  defaultN?: number | null;
};

const today = new Date().toISOString().slice(0, 10);

function formatMoney(value: number) {
  return `UGX ${Math.round(value || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

function colorForRank(mode: "top" | "bottom", rank: number, total: number) {
  const safeTotal = Math.max(total, 1);
  const progress = (rank - 1) / Math.max(safeTotal - 1, 1);
  const lightness = mode === "top" ? 82 - progress * 36 : 82 - progress * 32;
  const hue = mode === "top" ? 142 : 0;
  return {
    backgroundColor: `hsl(${hue} 60% ${lightness}%)`,
  };
}

export default function TopBottomAccountsReportClient({
  accountCategory,
  title,
  description,
  switchHref,
  switchLabel,
  defaultN = null,
}: Props) {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [mode, setMode] = useState<"top" | "bottom">("top");
  const [n, setN] = useState(defaultN ?? (accountCategory === "shares" ? 0 : 40));
  const [customN, setCustomN] = useState("");
  const [productId, setProductId] = useState("all");
  const [excludeZero, setExcludeZero] = useState(accountCategory === "shares" ? false : false);
  const [areaCode, setAreaCode] = useState("");
  const [memberType, setMemberType] = useState("all");
  const [report, setReport] = useState<TopBottomReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const hasLoadedRef = useRef(false);

  const nValue = useMemo(() => {
    if (accountCategory === "shares" && defaultN == null && !customN && n === 0) return null;
    const parsed = Number(customN || n);
    if (accountCategory === "shares" && !customN && (n === 0 || n == null)) return null;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : accountCategory === "shares" ? null : 40;
  }, [accountCategory, customN, defaultN, n]);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      params.set("mode", mode);
      if (nValue != null) params.set("n", String(nValue));
      params.set("accountCategory", accountCategory);
      if (productId !== "all") params.set("productId", productId);
      if (excludeZero) params.set("excludeZero", "true");
      if (areaCode.trim()) params.set("areaCode", areaCode.trim());
      if (memberType !== "all") params.set("memberType", memberType);

      const response = await fetch(`/api/v1/reports/member-ledger/top-bottom-savers?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json?.error || "Failed to load report");
      }
      setReport(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      params.set("mode", mode);
      params.set("accountCategory", accountCategory);
      if (nValue != null) params.set("n", String(nValue));
      if (productId !== "all") params.set("productId", productId);
      if (excludeZero) params.set("excludeZero", "true");
      if (areaCode.trim()) params.set("areaCode", areaCode.trim());
      if (memberType !== "all") params.set("memberType", memberType);
      params.set("format", "xlsx");

      const response = await fetch(`/api/v1/reports/member-ledger/top-bottom-savers?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${accountCategory === "shares" ? "top-bottom-share-holders" : "top-bottom-savers"}-${startDate}-to-${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export report");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
    }

    void loadReport();
  }, [liveRefreshVersion]);

  const summaryCards = useMemo(() => {
    if (!report) return [];
    const cards = [
      { label: "Highest balance", value: report.summary.top_account ? `${formatMoney(report.summary.top_account.balance)} - ${report.summary.top_account.name}` : "-" },
      { label: "Lowest in list", value: report.summary.bottom_account ? `${formatMoney(report.summary.bottom_account.balance)} - ${report.summary.bottom_account.name}` : "-" },
      { label: "Total balance represented", value: formatMoney(report.summary.list_total) },
      { label: "Average balance in list", value: formatMoney(report.summary.list_average) },
      { label: "% of total portfolio", value: `${report.summary.portfolio_coverage_pct.toFixed(2)}%` },
      { label: "Zero balance accounts", value: report.summary.zero_balance_count.toLocaleString() },
    ];
    if (accountCategory === "shares") {
      cards.push(
        { label: "Standard share value", value: formatMoney(report.summary.standard_share_value || 0) },
        { label: "At standard", value: report.summary.members_at_standard?.toLocaleString() || "0" },
        { label: "Above standard", value: report.summary.members_above_standard?.toLocaleString() || "0" },
        { label: "Below standard", value: report.summary.members_below_standard?.toLocaleString() || "0" },
      );
    }
    return cards;
  }, [accountCategory, report]);

  const products = report?.products || [];

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("No report data to print");
      return;
    }

    const categoryLabel = accountCategory === "shares" ? "Shareholders" : "Savers";

    const groupBy = report.products.map((product, index) => ({
      key: index,
      label: product.product_name,
      subHeaders: ["Rank", "A/C No.", "Member", "Phone", "Balance"],
      subRows: product.accounts.map((account) => [
        account.rank,
        account.account_no,
        account.member_name,
        account.phone,
        formatMoney(account.balance),
      ]),
      subTotals: ["Subtotal", String(product.subtotal.count), "", "", formatMoney(product.subtotal.total_balance)],
    }));

    printReport({
      title: `Top & Bottom ${categoryLabel}`,
      subtitle: mode === "top" ? "Top Accounts" : "Bottom Accounts",
      period: `${report.report_meta.start_date} to ${report.report_meta.end_date}`,
      headers: [],
      rows: [],
      groupBy,
      totals: ["Grand Total", String(report.grand_total.count), "", "", formatMoney(report.grand_total.total_balance)],
    });
  }, [report, accountCategory, mode]);

  return (
    <ReportPageLayout
      title={title}
      description={description}
      period={report ? `Period: ${report.report_meta.start_date} to ${report.report_meta.end_date}` : undefined}
      generatedAt={report?.report_meta.generated_at}
      summary={
        report ? (
          <>
            {summaryCards.map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-bold text-slate-900">{item.value}</CardContent>
              </Card>
            ))}
          </>
        ) : null
      }
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-6">
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <div className="flex rounded-xl border bg-white p-1">
              <button
                type="button"
                onClick={() => setMode("top")}
                className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition", mode === "top" ? "bg-slate-900 text-white" : "text-slate-600")}
              >
                Top N
              </button>
              <button
                type="button"
                onClick={() => setMode("bottom")}
                className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition", mode === "bottom" ? "bg-slate-900 text-white" : "text-slate-600")}
              >
                Bottom N
              </button>
            </div>
          </div>
          <div>
            <Label>N</Label>
            <div className="flex flex-wrap gap-2">
              {(accountCategory === "shares" ? [10, 20, 40, 50, 100] : [10, 20, 40, 50, 100]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setN(value);
                    setCustomN("");
                  }}
                  className={cn("rounded-full border px-3 py-2 text-sm font-semibold transition", nValue === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}
                >
                  {value}
                </button>
              ))}
            </div>
            <Input
              className="mt-2"
              value={customN}
              onChange={(e) => {
                setCustomN(e.target.value);
                if (e.target.value.trim()) setN(Number(e.target.value));
              }}
              placeholder={accountCategory === "shares" ? "Leave blank for all" : "Custom N"}
            />
          </div>
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {accountCategory === "shares" ? (
                  <>
                    <SelectItem value="300501">300501 - Affiliate Members</SelectItem>
                    <SelectItem value="300502">300502 - Ordinary Members</SelectItem>
                    <SelectItem value="300503">300503 - Associate Members</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="201001">201001 - Fixed Deposit Savings</SelectItem>
                    <SelectItem value="201002">201002 - Junior Savings A/C</SelectItem>
                    <SelectItem value="201003">201003 - Voluntary Savings</SelectItem>
                    <SelectItem value="201004">201004 - Compulsory Savings</SelectItem>
                    <SelectItem value="200600">200600 - Loan Insurance</SelectItem>
                    <SelectItem value="200800">200800 - Target Savings</SelectItem>
                    <SelectItem value="200810">200810 - School Fees Savings</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Area Code</Label>
            <Input value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Member Type</Label>
            <Select value={memberType} onValueChange={setMemberType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Affiliate">Affiliate</SelectItem>
                <SelectItem value="Ordinary">Ordinary</SelectItem>
                <SelectItem value="Associate">Associate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
              <Checkbox id="excludeZero" checked={excludeZero} onCheckedChange={(checked) => setExcludeZero(checked === true)} />
              <Label htmlFor="excludeZero" className="cursor-pointer">
                Exclude Zero Balance
              </Label>
            </div>
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={switchHref}>{switchLabel}</Link>
          </Button>
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || loading}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Excel"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={() => void loadReport()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate Report
          </Button>
        </div>
      }
      fitContent
    >
      <div className="space-y-6 p-4 md:p-6">
        {!loading && !report && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">
            Adjust the filters and generate the report.
          </div>
        )}

        {products.map((product) => (
          <section key={product.product_code} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b bg-slate-50 px-4 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Product</div>
                <div className="mt-1 text-lg font-bold text-slate-950">
                  Product: {product.product_code} - {product.product_name}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Total: {product.subtotal.count}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{formatMoney(product.subtotal.total_balance)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1220px] w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">A/C No.</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Physical/Postal Address</th>
                    <th className="px-4 py-3">Bank Verification No./TIN</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Ref. No.</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {product.accounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No accounts matched the selected filters.
                      </td>
                    </tr>
                  ) : (
                    product.accounts.map((row, index) => (
                      <tr
                        key={`${row.account_no}-${row.member_id}`}
                        className="border-b transition hover:bg-slate-50"
                        style={colorForRank(mode, index + 1, product.accounts.length)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{row.account_no}</td>
                        <td className="px-4 py-3">
                          <div title={row.member_name} className="inline-block max-w-[260px] truncate align-middle">
                            {row.rank_display}
                          </div>
                          {row.phone_anomaly && (
                            <span title="Non-standard phone format" className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              Phone
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span title={row.address} className="inline-block max-w-[280px] truncate align-middle">
                            {row.address || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.bvn_tin || ""}</td>
                        <td className="px-4 py-3">{row.phone || ""}</td>
                        <td className="px-4 py-3">{row.ref_no ?? ""}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(row.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-100 font-bold">
                    <td className="px-4 py-3" colSpan={6}>
                      Total: {product.subtotal.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(product.subtotal.total_balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        ))}

        {report && (
          <Card className="border-slate-200 bg-slate-950 text-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-[0.28em] text-slate-300">Grand Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryTile label="Accounts Shown" value={report.grand_total.count.toLocaleString()} />
                <SummaryTile label="List Total" value={formatMoney(report.grand_total.total_balance)} accent="text-emerald-300" />
                <SummaryTile label="Coverage" value={`${report.summary.portfolio_coverage_pct.toFixed(2)}%`} accent="text-cyan-300" />
                <SummaryTile label="Zero Balances" value={report.summary.zero_balance_count.toLocaleString()} accent="text-amber-300" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ReportPageLayout>
  );
}

function SummaryTile({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", accent)}>{value}</div>
    </div>
  );
}
