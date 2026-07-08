"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

interface ReportPrintHeaderProps {
  title: string;
  subtitle?: string;
  filters?: string; // e.g. "Branch: Main, Date: 2024-01-01"
}

export function ReportPrintHeader({
  title,
  subtitle,
  filters,
}: ReportPrintHeaderProps) {
  const { data: session } = useSession();
  const [formattedDate, setFormattedDate] = useState("");
  useEffect(() => { setFormattedDate(format(new Date(), "PPP p")); }, []);

  return (
    <div className="hidden print:block mb-6 border-b pb-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-primary">
            BUKONZ EMERGENCY
          </h1>
          <p className="text-sm text-muted-foreground">
            Trusted Financial Partner
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Kampala, Uganda
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground border-t pt-2">
        <div>
          <span>Printed On: {formattedDate || "..."}</span>
          <span className="mx-2">|</span>
          <span>Printed By: {session?.user?.name || "System User"}</span>
        </div>
        {filters && <div>Filters: {filters}</div>}
      </div>
    </div>
  );
}
