"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
 
interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  onPrint?: () => void;
  onExport?: () => void;
  disableExport?: boolean;
  children?: React.ReactNode;
}
 
export function ReportHeader({
  title,
  subtitle,
  period,
  onPrint,
  onExport,
  disableExport = false,
  children,
}: ReportHeaderProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };
 
  return (
    <div className="flex flex-col space-y-6 mb-6">
      {/* Print Only Header */}
      <div className="hidden print:block text-center border-b-2 border-neutral-900 pb-6 mb-4">
        <h1 className="text-4xl font-black uppercase tracking-widest text-[#1e1b4b]">
          {REPORT_HEADER_DETAILS.institutionName}
        </h1>
        <div className="mt-4 space-y-2">
          <h2 className="text-2xl font-bold text-neutral-800 uppercase tracking-tight">
            {title}
          </h2>
          {period && (
            <p className="text-lg font-semibold text-neutral-700">
              REPORTING PERIOD: {period}
            </p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm text-neutral-500 font-medium">
            {isMounted && (
              <>
                <span>Generated: {format(new Date(), "PPpp")}</span>
                <span>•</span>
              </>
            )}
            <span>Official System Report</span>
          </div>
        </div>
      </div>
 
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <img
            src={REPORT_HEADER_DETAILS.logoPath}
            alt="SACCO logo"
            className="h-12 w-12 rounded-full object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {children}
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {onExport && (
            <Button
              onClick={onExport}
              variant="outline"
              size="sm"
              disabled={disableExport}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
