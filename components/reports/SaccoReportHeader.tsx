"use client";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

type SaccoReportHeaderProps = {
  title: string;
  subtitle?: string;
  branchLabel?: string;
  periodLabel?: string;
  generatedAt?: string;
  className?: string;
};

function joinNonEmpty(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" / ");
}

export function SaccoReportHeader({
  title,
  subtitle,
  branchLabel,
  periodLabel,
  generatedAt,
  className = "",
}: SaccoReportHeaderProps) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white/95 shadow-sm ${className}`}>
      <div className="grid gap-4 border-b border-slate-100 p-5 md:grid-cols-[96px_minmax(0,1fr)_220px] md:items-center">
        <div className="flex justify-center md:justify-start">
          <img
            src={REPORT_HEADER_DETAILS.logoPath}
            alt="SACCO logo"
            className="h-20 w-20 object-contain"
          />
        </div>

        <div className="text-center md:text-left">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            SACCO Reports
          </div>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-950 md:text-3xl">
            {REPORT_HEADER_DETAILS.institutionName}
          </h1>
          <div className="mt-2 space-y-0.5 text-sm font-medium text-slate-700">
            <div>{REPORT_HEADER_DETAILS.registrationNumber}</div>
            <div>{REPORT_HEADER_DETAILS.postalAddress.join(", ")}</div>
            <div>{joinNonEmpty([REPORT_HEADER_DETAILS.contacts.join(" / "), REPORT_HEADER_DETAILS.email])}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Report Context
          </div>
          <div className="mt-2 space-y-1">
            <div className="font-semibold text-slate-950">{title}</div>
            {subtitle && <div>{subtitle}</div>}
            {branchLabel && <div>Branch: {branchLabel}</div>}
            {periodLabel && <div>Period: {periodLabel}</div>}
            {generatedAt && <div>Generated: {generatedAt}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
