"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  FileQuestion,
  FileText,
  Home,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPlaceholderPage } from "@/components/reports/ReportPlaceholderPage";
import { reportBySlug, reportCatalog } from "@/config/report-catalog";

export default function MissingReportPage() {
  const params = useParams();
  const reportSlug = params?.reportSlug as string;
  const report = reportBySlug.get(reportSlug);
  const reportCategory = reportCatalog.find((category) =>
    category.reports.some((item) => item.slug === reportSlug),
  );

  if (!report) {
    return (
      <ReportPlaceholderPage
        title="Report not found"
        description="The requested report is not registered in the catalog."
        statusLabel="Not Found"
        routePath={`/dashboard/reports/catalog/${reportSlug}`}
      />
    );
  }

  const isReady = report.status === "ready";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:text-slate-900">
            <Home className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <ArrowRight className="h-3.5 w-3.5" />
          <Link href="/dashboard/reports" className="hover:text-slate-900">
            Reports
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-3 border-b border-slate-200/70 bg-white">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {isReady ? "Ready" : "Coming Soon"}
                </div>
                <CardTitle className="text-2xl">{report.title}</CardTitle>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <FileQuestion className="h-6 w-6" />
              </div>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">{report.description}</p>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Status
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {isReady ? "Existing Page" : "Not Built Yet"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Path
                </div>
                <div className="mt-2 break-all text-sm font-medium text-slate-900">
                  {report.href}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Type
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {report.title.toLowerCase().includes("audit")
                    ? "Compliance"
                    : report.title.toLowerCase().includes("savings")
                      ? "Savings"
                      : report.title.toLowerCase().includes("share")
                        ? "Shares"
                        : report.title.toLowerCase().includes("transaction")
                          ? "Transactions"
                          : "Report"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Sources
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {reportCategory?.sources?.join(" · ") || "Not specified"}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                  {isReady ? "This report already has a destination." : "This report is waiting for its dedicated page."}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    {isReady
                      ? "Open the linked report page or build a dedicated view later if you want a more specific screen."
                      : "The catalog already knows about this report, but the detail page still needs to be built."}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link href={report.href}>
                    Open Report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" asChild className="rounded-full">
                  <Link href="/dashboard/reports">Back to Reports</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
