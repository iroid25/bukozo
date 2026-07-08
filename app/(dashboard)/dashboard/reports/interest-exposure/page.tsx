"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { cn } from "@/lib/utils";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type DepositRow = {
  accountNumber: string;
  memberName: string;
  trxDate: string;
  fdNumber: string;
  depositAmount: number;
  accruedDays: number;
  accruedInterest: number;
  interestAtMaturity: number;
  maturityValue: number;
  maturityDate: string;
  annualRate: number;
  depositPeriodLabel: string;
  daysToMaturity: number;
  isOverdue: boolean;
  currentLiabilityProgress: number;
};

type InterestExposureReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    report_date: string;
    header_label: string;
  };
  products: Array<{
    product_code: string;
    product_name: string;
    deposits: DepositRow[];
    subtotal: {
      count: number;
      total_principal: number;
      total_accrued_interest: number;
      total_interest_at_maturity: number;
      total_maturity_value: number;
    };
  }>;
  grand_total: {
    count: number;
    total_principal: number;
    total_accrued_interest: number;
    total_interest_at_maturity: number;
    total_maturity_value: number;
  };
  exposure_summary: {
    current_liability: number;
    full_liability: number;
    unexpired_interest: number;
    liability_coverage_pct: number;
    overdue_count: number;
    overdue_principal: number;
    overdue_accrued_interest: number;
    total_principal_at_risk: number;
  };
};

const today = new Date().toISOString().slice(0, 10);

function money(value: number) {
  return `UGX ${Math.round(value || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

function badgeClass(daysToMaturity: number, isOverdue: boolean) {
  if (isOverdue) return "border-red-200 bg-red-50 text-red-700";
  if (daysToMaturity <= 7) return "border-orange-200 bg-orange-50 text-orange-700";
  if (daysToMaturity <= 30) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function rowClass(daysToMaturity: number, isOverdue: boolean) {
  if (isOverdue) return "bg-red-50/70";
  if (daysToMaturity <= 7) return "bg-orange-50/70";
  if (daysToMaturity <= 30) return "bg-amber-50/70";
  return "bg-white";
}

export default function InterestExposurePage() {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [reportDate, setReportDate] = useState(today);
  const [productId, setProductId] = useState("201001");
  const [memberSearch, setMemberSearch] = useState("");
  const [depositPeriod, setDepositPeriod] = useState("all");
  const [maturityFrom, setMaturityFrom] = useState("");
  const [maturityTo, setMaturityTo] = useState("");
  const [report, setReport] = useState<InterestExposureReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("reportDate", reportDate);
      if (productId) params.set("productId", productId);
      if (memberSearch.trim()) params.set("memberSearch", memberSearch.trim());
      if (depositPeriod !== "all") params.set("depositPeriod", depositPeriod);
      if (maturityFrom) params.set("maturityFrom", maturityFrom);
      if (maturityTo) params.set("maturityTo", maturityTo);

      const response = await fetch(`/api/v1/reports/fixed-deposits/interest-exposure?${params.toString()}`, {
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
  }, [depositPeriod, memberSearch, maturityFrom, maturityTo, productId, reportDate]);

  async function exportExcel() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set("reportDate", reportDate);
      params.set("format", "xlsx");
      if (productId) params.set("productId", productId);
      if (memberSearch.trim()) params.set("memberSearch", memberSearch.trim());
      if (depositPeriod !== "all") params.set("depositPeriod", depositPeriod);
      if (maturityFrom) params.set("maturityFrom", maturityFrom);
      if (maturityTo) params.set("maturityTo", maturityTo);

      const response = await fetch(`/api/v1/reports/fixed-deposits/interest-exposure?${params.toString()}`, {
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
      link.download = `interest-exposure-${reportDate}.xlsx`;
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
    void loadReport();
  }, [liveRefreshVersion, loadReport]);

  const products = report?.products || [];
  const deposits = useMemo(() => products.flatMap((product) => product.deposits), [products]);

  const summaryCards = useMemo(() => {
    if (!report) return [];
    return [
      { label: "Current Interest Liability", value: money(report.exposure_summary.current_liability) },
      { label: "Full Maturity Liability", value: money(report.exposure_summary.full_liability) },
      { label: "Unexpired Interest Remaining", value: money(report.exposure_summary.unexpired_interest) },
      { label: "Coverage %", value: `${report.exposure_summary.liability_coverage_pct.toFixed(2)}%` },
      { label: "Overdue FDs", value: report.exposure_summary.overdue_count.toLocaleString() },
      { label: "Principal at Risk", value: money(report.exposure_summary.total_principal_at_risk) },
    ];
  }, [report]);

  return (
    <ReportPageLayout
      title="Interest Exposure Report"
      description="Fixed-deposit interest liability snapshot as of a reporting date."
      period={report ? report.report_meta.header_label : undefined}
      generatedAt={report?.report_meta.generated_at}
      summary={
        report ? (
          <>
            {summaryCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-bold text-slate-900">{card.value}</CardContent>
              </Card>
            ))}
          </>
        ) : null
      }
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-6">
          <div>
            <Label>Reporting Date</Label>
            <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="201001">201001 - Fixed Deposit Savings</SelectItem>
                <SelectItem value="all">All Products</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Member Search</Label>
            <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Name / A/C No." />
          </div>
          <div>
            <Label>Deposit Period</Label>
            <Select value={depositPeriod} onValueChange={setDepositPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="9">9 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Maturity From</Label>
            <Input type="date" value={maturityFrom} onChange={(e) => setMaturityFrom(e.target.value)} />
          </div>
          <div>
            <Label>Maturity To</Label>
            <Input type="date" value={maturityTo} onChange={(e) => setMaturityTo(e.target.value)} />
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || loading}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Excel"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
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
            Generate the report to view fixed-deposit interest exposure.
          </div>
        )}

        {report && (
          <div className="space-y-6">
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
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      Total: {product.subtotal.count}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      {money(product.subtotal.total_maturity_value)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1280px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-4 py-3">A/C No.</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Trx Date</th>
                        <th className="px-4 py-3">Deposit No.</th>
                        <th className="px-4 py-3 text-right">Deposit Amount</th>
                        <th className="px-4 py-3">Accrued Days</th>
                        <th className="px-4 py-3 text-right">Accrued Interest</th>
                        <th className="px-4 py-3 text-right">Interest at Maturity</th>
                        <th className="px-4 py-3 text-right">Maturity Value</th>
                        <th className="px-4 py-3">Maturity Date</th>
                        <th className="px-4 py-3">Annual Int. Rate (%)</th>
                        <th className="px-4 py-3">Deposit Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.deposits.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                            No deposits matched the selected filters.
                          </td>
                        </tr>
                      ) : (
                        product.deposits.map((row) => (
                          <tr
                            key={`${row.accountNumber}-${row.fdNumber}`}
                            className={cn("border-b transition hover:bg-slate-50", rowClass(row.daysToMaturity, row.isOverdue))}
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">{row.accountNumber}</td>
                            <td className="px-4 py-3">
                              <div title={row.memberName} className="max-w-[260px] truncate font-medium text-slate-900">
                                {row.memberName}
                              </div>
                              <div className={cn("mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em]", badgeClass(row.daysToMaturity, row.isOverdue))}>
                                {row.isOverdue ? "Overdue" : row.daysToMaturity <= 7 ? "Due 7 Days" : row.daysToMaturity <= 30 ? "Due 30 Days" : "Healthy"}
                              </div>
                            </td>
                            <td className="px-4 py-3">{row.trxDate}</td>
                            <td className="px-4 py-3 font-mono text-sm font-semibold tracking-[0.08em]">{row.fdNumber}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{money(row.depositAmount)}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.accruedDays} Days</div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(row.currentLiabilityProgress * 100, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{money(row.accruedInterest)}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{money(row.interestAtMaturity)}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{money(row.maturityValue)}</td>
                            <td className="px-4 py-3">{row.maturityDate}</td>
                            <td className="px-4 py-3">{row.annualRate.toFixed(1)}</td>
                            <td className="px-4 py-3">{row.depositPeriodLabel}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-100 font-bold">
                        <td className="px-4 py-3" colSpan={4}>
                          Total: {product.subtotal.count}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(product.subtotal.total_principal)}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right tabular-nums">{money(product.subtotal.total_accrued_interest)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(product.subtotal.total_interest_at_maturity)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(product.subtotal.total_maturity_value)}</td>
                        <td className="px-4 py-3" colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))}

            <Card className="border-slate-200 bg-slate-950 text-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-[0.28em] text-slate-300">Exposure Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryTile label="Current Liability" value={money(report.exposure_summary.current_liability)} />
                  <SummaryTile label="Full Liability" value={money(report.exposure_summary.full_liability)} />
                  <SummaryTile label="Unexpired Interest" value={money(report.exposure_summary.unexpired_interest)} />
                  <SummaryTile label="Coverage" value={`${report.exposure_summary.liability_coverage_pct.toFixed(2)}%`} />
                  <SummaryTile label="Overdue Count" value={report.exposure_summary.overdue_count.toLocaleString()} />
                  <SummaryTile label="Overdue Principal" value={money(report.exposure_summary.overdue_principal)} />
                  <SummaryTile label="Overdue Accrued Interest" value={money(report.exposure_summary.overdue_accrued_interest)} />
                  <SummaryTile label="Principal at Risk" value={money(report.exposure_summary.total_principal_at_risk)} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ReportPageLayout>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
