"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ReportHeader } from "./ReportHeader";

interface ReportPageLayoutProps {
  title: string;
  description?: string;
  period?: string;
  generatedAt?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  summaryFirst?: boolean;
  fitContent?: boolean;
  summaryColumns?: 2 | 3 | 4 | 6;
  onPrint?: () => void;
  children: ReactNode;
}

export function ReportPageLayout({
  title,
  description,
  period,
  generatedAt,
  filters,
  actions,
  summary,
  summaryFirst = false,
  summaryColumns = 4,
  onPrint,
  children,
}: ReportPageLayoutProps) {
  const [localGeneratedAt, setLocalGeneratedAt] = useState("");

  useEffect(() => {
    setLocalGeneratedAt(new Date().toLocaleString());
  }, []);

  const displayGeneratedAt = generatedAt || localGeneratedAt;

  const summaryGridClass = cn(
    "grid w-full gap-3",
    summaryColumns === 6 && "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
    summaryColumns === 3 && "grid-cols-2 md:grid-cols-3",
    summaryColumns === 2 && "grid-cols-2",
    summaryColumns === 4 && "grid-cols-2 xl:grid-cols-4",
  );

  return (
    <div className="w-full h-full min-w-0 flex-1 flex-col space-y-4 p-4 md:p-6 md:flex">
      <ReportHeader
        title={title}
        subtitle={description}
        period={period}
        onPrint={onPrint}
        children={actions}
      />
      {(displayGeneratedAt || period) && (
        <div className="flex flex-wrap items-center gap-2 -mt-3 text-xs text-muted-foreground">
          {displayGeneratedAt && <span>Generated at {displayGeneratedAt}</span>}
          {displayGeneratedAt && period && <span>&bull;</span>}
          {period && <span>{period}</span>}
        </div>
      )}

      <div className="w-full min-w-0 space-y-3">
        {summaryFirst ? (
          <>
            {summary && <div className={summaryGridClass}>{summary}</div>}
            {filters && (
              <div className="w-full rounded-lg border bg-muted/50 p-4">
                {filters}
              </div>
            )}
          </>
        ) : (
          <>
            {filters && (
              <div className="w-full rounded-lg border bg-muted/50 p-4">
                {filters}
              </div>
            )}
            {summary && <div className={summaryGridClass}>{summary}</div>}
          </>
        )}

        <Separator className="my-2" />

        <div className="w-full min-w-0 rounded-md border bg-card text-card-foreground shadow-sm">
          <div className="w-full min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
