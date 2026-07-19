"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DataTable, { Column } from "@/components/ui/data-table/data-table";
import { ReportPageLayout } from "./ReportPageLayout";
import { printReport, PrintReportConfig } from "@/lib/reports/print-report";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Printer } from "lucide-react";
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
  searchFields?: string[];
  typeField?: keyof T;
  typeOptions?: { label: string; value: string }[];
  printConfigBuilder?: (data: T[], summary: any, title: string, period: string) => PrintReportConfig;
  exportFileName?: string;
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
  searchFields = [],
  typeField,
  typeOptions = [],
  printConfigBuilder,
  exportFileName,
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
  const [typeFilter, setTypeFilter] = useState("all");
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
        if (typeField && typeFilter !== "all") {
          params.append("type", typeFilter);
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
          type: typeField && typeFilter !== "all" ? typeFilter : undefined,
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
    typeFilter,
    typeField,
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

  const periodLabel = useMemo(() => {
    if (dateRange?.from || dateRange?.to) {
      const from = dateRange?.from ? format(dateRange.from, "dd MMM yyyy") : "Start";
      const to = dateRange?.to ? format(dateRange.to, "dd MMM yyyy") : "Now";
      return `${from} - ${to}`;
    }
    return "";
  }, [dateRange]);

  const filteredData = typeField && typeFilter !== "all"
    ? data.filter((item) => String(item[typeField]) === typeFilter)
    : data;

  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (!typeField || typeFilter === "all") return summary;
    if (filteredData.length === data.length) return summary;

    const rows = filteredData as any[];
    const newSummary: Record<string, any> = {};

    newSummary.count = rows.length;
    newSummary.totalRecords = rows.length;
    newSummary.row_count = rows.length;

    const numericColumns = columns.filter((col) => {
      const key = col.accessorKey as string;
      if (!key || rows.length === 0) return false;
      return typeof rows[0][key] === "number";
    });

    for (const col of numericColumns) {
      const key = col.accessorKey as string;
      const sum = rows.reduce((acc: number, row: any) => acc + (Number(row[key]) || 0), 0);
      newSummary[key] = sum;
      const camelKey = key.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
      if (camelKey !== key) {
        newSummary[camelKey] = sum;
      }
      const pascalKey = key.replace(/(^|_)([a-z])/g, (_: string, __: string, c: string) => c.toUpperCase());
      if (pascalKey !== key && pascalKey !== camelKey) {
        newSummary[pascalKey] = sum;
      }
    }

    for (const sKey of Object.keys(summary)) {
      if (sKey in newSummary) continue;
      if (typeof summary[sKey] === "number") {
        const lower = sKey.toLowerCase();
        if (lower.includes("count") || lower.includes("unique")) continue;
        const matchedCol = numericColumns.find((col) => {
          const colLower = (col.accessorKey as string).toLowerCase();
          return lower.includes(colLower) || colLower.includes(lower.replace("total", ""));
        });
        if (matchedCol) {
          newSummary[sKey] = newSummary[matchedCol.accessorKey as string];
        } else {
          newSummary[sKey] = summary[sKey];
        }
      } else {
        newSummary[sKey] = summary[sKey];
      }
    }

    return newSummary;
  }, [summary, typeFilter, typeField, filteredData, data.length, columns]);

  const handleExport = useCallback(() => {
    if (filteredData.length === 0) {
      toast.error("No data to export. Generate the report first.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredData as any);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
    const fileName = exportFileName || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    toast.success("Excel file exported successfully.");
  }, [filteredData, title, exportFileName]);

  const handlePrint = useCallback(() => {
    if (filteredData.length === 0) {
      toast.error("No data to print. Generate the report first.");
      return;
    }
    if (printConfigBuilder) {
      printReport(printConfigBuilder(filteredData, filteredSummary, title, periodLabel));
      return;
    }
    const allKeys = filteredData.length > 0 ? Object.keys(filteredData[0] as any) : [];
    const headers = columns
      .filter((col) => allKeys.includes(col.accessorKey as string))
      .map((col) => col.header);
    const accessorKeys = columns
      .filter((col) => allKeys.includes(col.accessorKey as string))
      .map((col) => col.accessorKey as string);
    const rows = filteredData.map((item) =>
      accessorKeys.map((key) => {
        const val = (item as any)[key];
        return val === null || val === undefined ? "" : val;
      }),
    );
    printReport({
      title,
      period: periodLabel,
      headers,
      rows,
    });
  }, [filteredData, filteredSummary, columns, title, periodLabel, printConfigBuilder]);

  return (
    <ReportPageLayout
      title={title}
      description={description}
      onPrint={handlePrint}
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
          {typeOptions.length > 0 && (
            <div className="min-w-[180px]">
              <Label className="mb-2 block">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={filteredData.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      }
      summary={filteredSummary && summaryFormatter ? summaryFormatter(filteredSummary) : null}
    >
      <DataTable
        title="Report Data"
        data={filteredData}
        columns={columns}
        keyField={keyField}
        isLoading={loading}
        onRefresh={fetchData}
        filters={{
            searchFields: searchFields,
            enableDateFilter: false,
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
