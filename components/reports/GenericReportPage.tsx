"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import DataTable, { Column } from "@/components/ui/data-table/data-table";
import { ReportPageLayout } from "./ReportPageLayout";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";


interface GenericReportPageProps<T> {
  title: string;
  description?: string;
  endpoint: string;
  columns: Column<T>[];
  keyField: keyof T;
  summaryFormatter?: (summary: any) => React.ReactNode;
  defaultDateRange?: DateRange;
  method?: "GET" | "POST";
  extraParams?: Record<string, any>;
  refreshIntervalMs?: number;
}

export function GenericReportPage<T>({
  title,
  description,
  endpoint,
  columns,
  keyField,
  summaryFormatter,
  defaultDateRange,
  method = "GET",
  extraParams = {},
  refreshIntervalMs = 15000,
}: GenericReportPageProps<T>) {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: refreshIntervalMs,
  });
  const [data, setData] = useState<T[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [branchId, setBranchId] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    defaultDateRange || {
      from: addDays(new Date(), -30),
      to: new Date(),
    }
  );

  const hasLoadedRef = useRef(false);
  const extraParamsRef = useRef(extraParams);
  useEffect(() => { extraParamsRef.current = extraParams; });

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setBranches((result.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })));
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    try {
      let url = endpoint;
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      };

      if (method === "GET") {
        const params = new URLSearchParams();
        if (dateRange?.from) {
          params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
        }
        if (dateRange?.to) {
          params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
        }
        if (isAdmin ? branchId !== "all" : userBranchId) {
          params.append("branchId", String(isAdmin ? branchId : userBranchId));
        }

        Object.entries(extraParamsRef.current).forEach(([key, value]) => {
          params.append(key, String(value));
        });

        url = `${endpoint}?${params.toString()}`;
      } else {
        options.body = JSON.stringify({
          startDate: dateRange?.from
            ? format(dateRange.from, "yyyy-MM-dd")
            : undefined,
          endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
          branchId: isAdmin
            ? branchId === "all"
              ? undefined
              : branchId
            : userBranchId,
          ...extraParamsRef.current,
        });
      }

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error("Failed to fetch report data");
      }

      const result = await response.json();
      const reportData = result.data;

      if (Array.isArray(reportData)) {
        setData(reportData);
        setSummary(result.summary || null);
      } else {
        const innerData = reportData?.data;
        if (Array.isArray(innerData)) {
          setData(innerData);
        } else if (innerData && typeof innerData === "object") {
          const arrayKeys = Object.keys(innerData).filter((key) =>
            Array.isArray((innerData as any)[key]),
          );
          const preferredKey =
            arrayKeys.find((key) => key.toLowerCase().includes("detailed")) ||
            arrayKeys.find((key) => key.toLowerCase().includes("records")) ||
            arrayKeys.find((key) => key.toLowerCase().includes("rows")) ||
            arrayKeys.find((key) => key.toLowerCase().includes("items")) ||
            arrayKeys.find(
              (key) =>
                key.toLowerCase().includes("member") ||
                key.toLowerCase().includes("transaction") ||
                key.toLowerCase().includes("account"),
            ) ||
            arrayKeys[0];

          if (preferredKey) {
            setData((innerData as any)[preferredKey]);
          } else {
            setData([]);
          }
        } else {
          setData([]);
        }

        setSummary(reportData?.summary || null);
      }

      setGeneratedAt(new Date().toLocaleString());
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Report fetch error:", error);
      if (!hasLoadedRef.current) {
        toast.error("Failed to load report data");
      }
    } finally {
      setLoading(false);
    }
  }, [
    branchId,
    endpoint,
    dateRange,
    isAdmin,
    liveRefreshVersion,
    method,
    userBranchId,
  ]);

  // Initial fetch
  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [fetchBranches, fetchData]);

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId]);

  const handleExport = () => {
    // Basic CSV export logic could go here, or trigger api export
    toast.info("Exporting data...");
    // TODO: Implement actual export
  };

  return (
    <ReportPageLayout
      title={title}
      description={description}
      period={
        dateRange?.from || dateRange?.to
          ? `${dateRange?.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} - ${dateRange?.to ? format(dateRange.to, "dd MMM yyyy") : "Now"}`
          : undefined
      }
      generatedAt={generatedAt || undefined}
      filters={
        <div className="flex w-full flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <Label className="mb-2 block">Branch</Label>
            {isAdmin ? (
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
            ) : (
              <Input value={branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch"} disabled />
            )}
          </div>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Button onClick={fetchData} disabled={loading}>
            {loading ? "Loading..." : "Generate Report"}
          </Button>
        </div>
      }
      actions={
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      }
      summary={summary && summaryFormatter ? summaryFormatter(summary) : null}
    >
      <DataTable
        title="Report Data"
        data={data}
        columns={columns}
        keyField={keyField}
        isLoading={loading}
        onRefresh={fetchData}
        filters={{
            searchFields: [], // Can be passed as prop if needed
            enableDateFilter: false, // We handle date filtering externally
        }}
        emptyState={
             <div className="text-center py-8 text-muted-foreground">
                No records found for the selected period.
             </div>
        }
      />
    </ReportPageLayout>
  );
}
