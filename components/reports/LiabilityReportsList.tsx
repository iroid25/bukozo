import React from "react";
import { reportCatalog, type ReportItem } from "@/config/report-catalog";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Determines if a report is related to liabilities based on its title or slug.
 * Currently matches common liability reports such as balance sheets, trial balances,
 * and comprehensive statements.
 */
function isLiabilityReport(report: ReportItem): boolean {
  const keywords = [
    "balance sheet",
    "trial balance",
    "liability",
    "current liabilities",
    "non[- ]current liabilities",
    "comprehensive",
  ];
  const lowered = `${report.title} ${report.slug}`.toLowerCase();
  return keywords.some((kw) => lowered.includes(kw));
}

export default function LiabilityReportsList() {
  // Flatten all reports from the catalog
  const allReports = reportCatalog.flatMap((cat) => cat.reports);
  const liabilityReports = allReports.filter(isLiabilityReport);

  if (liabilityReports.length === 0) {
    return <p className="text-sm text-slate-600">No liability reports found.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {liabilityReports.map((report) => (
        <Link
          key={report.slug}
          href={report.href}
          className={cn(
            "group rounded-xl border bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md",
            "border-slate-200 hover:border-slate-400",
          )}
        >
          <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-700">
            {report.title}
          </h3>
          <p className="mt-1 text-xs text-slate-600">{report.description}</p>
        </Link>
      ))}
    </div>
  );
}
