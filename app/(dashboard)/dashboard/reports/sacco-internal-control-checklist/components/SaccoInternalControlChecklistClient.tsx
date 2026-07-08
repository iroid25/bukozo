"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { renderSaccoPdfFooter, renderSaccoPdfHeader } from "@/lib/reports/report-pdf";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import type {
  SaccoChecklistStatus,
  SaccoInternalControlChecklistRecord,
  SaccoInternalControlChecklistSummary,
} from "@/lib/reports/sacco-internal-control-checklist-types";

type BranchOption = {
  id: string;
  name: string;
  location: string;
};

type EditableChecklistRecord = SaccoInternalControlChecklistRecord;

function statusTone(status: SaccoChecklistStatus) {
  switch (status) {
    case "PASS":
      return "default";
    case "FAIL":
      return "destructive";
    case "PARTIAL":
      return "secondary";
    case "NA":
      return "outline";
    default:
      return "outline";
  }
}

export default function SaccoInternalControlChecklistClient(props: {
  userRole: string;
  userBranchId: string | null;
  userBranchName: string | null;
  userId: string | null;
}) {
  const isAdmin = props.userRole === "ADMIN";
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<string>(isAdmin ? "all" : props.userBranchId || "all");
  const [periodKey, setPeriodKey] = useState<string>(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<EditableChecklistRecord[]>([]);
  const [summary, setSummary] = useState<SaccoInternalControlChecklistSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  useEffect(() => {
    const loadBranches = async () => {
      if (!isAdmin) return;
      const response = await fetch("/api/v1/lookups/branches", { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBranchOptions(
        rows.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          location: branch.location,
        })),
      );
    };
    void loadBranches();
  }, [isAdmin]);

  const branchLabel = useMemo(() => {
    if (!isAdmin) return props.userBranchName || "Current Branch";
    if (branchId === "all") return "All Branches";
    return branchOptions.find((branch) => branch.id === branchId)?.name || "Selected Branch";
  }, [branchId, branchOptions, isAdmin, props.userBranchName]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (!query) return true;
      return [
        record.itemCode,
        record.itemLabel,
        record.controlArea,
        record.remarks,
        record.evidence,
        record.branchName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [records, search]);

  const branchParam = useMemo(() => {
    if (!isAdmin) return props.userBranchId || undefined;
    return branchId === "all" ? undefined : branchId;
  }, [branchId, isAdmin, props.userBranchId]);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchParam) params.set("branchId", branchParam);
      if (periodKey) params.set("periodKey", periodKey);

      const response = await fetch(`/api/v1/reports/sacco-internal-control-checklist?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch checklist");
      }

      const payload = await response.json();
      setRecords(Array.isArray(payload?.data) ? payload.data : []);
      setSummary(payload?.summary || null);
      setGeneratedAt(new Date().toLocaleString());
      setHasLoadedOnce(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load checklist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChecklist();
  }, [branchParam, periodKey]);

  useEffect(() => {
    if (!hasLoadedOnce) return;
    void fetchChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const updateRecord = (index: number, patch: Partial<EditableChecklistRecord>) => {
    setRecords((current) =>
      current.map((record, currentIndex) =>
        currentIndex === index ? { ...record, ...patch } : record,
      ),
    );
  };

  const saveChecklist = async () => {
    if (!branchParam) {
      toast.error("Select a single branch before saving.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/v1/reports/sacco-internal-control-checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          branchId: branchParam,
          periodKey,
          items: records.map((record) => ({
            itemCode: record.itemCode,
            itemLabel: record.itemLabel,
            controlArea: record.controlArea,
            status: record.status,
            remarks: record.remarks,
            evidence: record.evidence,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save checklist");
      }

      const payload = await response.json();
      setRecords(Array.isArray(payload?.data) ? payload.data : []);
      setSummary(payload?.summary || null);
      setGeneratedAt(new Date().toLocaleString());
      toast.success("Checklist saved");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save checklist");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const payload = filteredRecords.map((record) => ({
      Branch: record.branchName,
      Period: record.periodKey,
      "Control Area": record.controlArea,
      Code: record.itemCode,
      Item: record.itemLabel,
      Status: record.status,
      Remarks: record.remarks,
      Evidence: record.evidence,
      "Reviewed By": record.reviewedByName || "N/A",
      "Reviewed At": record.reviewedAt ? format(new Date(record.reviewedAt), "yyyy-MM-dd HH:mm") : "N/A",
    }));
    const worksheet = XLSX.utils.json_to_sheet(payload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Checklist");
    const fileName = `Sacco_Internal_Control_Checklist_${branchLabel.replace(/\s+/g, "_")}_${periodKey}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel export ready");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const generated = generatedAt || new Date().toLocaleString();

    renderSaccoPdfHeader(doc, {
      title: "SACCO Internal Control Checklist",
      subtitle: `Period ${periodKey}`,
      branchLabel,
      generatedAt: generated,
    });

    autoTable(doc, {
      startY: 38,
      head: [[
        "Control Area",
        "Code",
        "Checklist Item",
        "Status",
        "Remarks",
        "Evidence",
      ]],
      body: filteredRecords.map((record) => [
        record.controlArea,
        record.itemCode,
        record.itemLabel,
        record.status,
        record.remarks || "-",
        record.evidence || "-",
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [3, 22, 53], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 38, left: 12, right: 12, bottom: 16 },
      didDrawPage: () => renderSaccoPdfFooter(doc),
    });

    doc.save(`Sacco_Internal_Control_Checklist_${branchLabel.replace(/\s+/g, "_")}_${periodKey}.pdf`);
    toast.success("PDF export ready");
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_32%),linear-gradient(to_bottom,_#f8fafc,_#ffffff_45%,_#f7f9fb)] px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <Card className="border-slate-200/80 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <CardHeader className="space-y-4 border-b border-slate-200/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SACCO Audit & Controls
                </div>
                <CardTitle className="text-2xl md:text-3xl">SACCO Internal Control Checklist</CardTitle>
                <p className="max-w-3xl text-sm text-slate-600">
                  Editable branch control checklist with save, PDF, and Excel export. Admins can review all branches,
                  while branch users are limited to their own branch.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {branchLabel}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {periodKey}
                </Badge>
                {generatedAt && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Updated {generatedAt}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Items" value={summary?.totalItems || 0} />
              <MetricCard title="Pass" value={summary?.passCount || 0} />
              <MetricCard title="Partial" value={summary?.partialCount || 0} />
              <MetricCard title="Fail" value={summary?.failCount || 0} />
              <MetricCard title="N/A" value={summary?.naCount || 0} />
              <MetricCard title="Completion" value={`${summary?.completionRate?.toFixed(0) || 0}%`} />
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch</label>
                  <Select value={branchId} onValueChange={setBranchId} disabled={!isAdmin}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="all">All Branches</SelectItem>}
                      {!isAdmin ? (
                        <SelectItem value={props.userBranchId || "all"}>
                          {props.userBranchName || "Current Branch"}
                        </SelectItem>
                      ) : (
                        branchOptions.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Period</label>
                  <Input
                    value={periodKey}
                    onChange={(event) => setPeriodKey(event.target.value)}
                    placeholder="YYYY-MM"
                    className="w-44"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search control item..."
                    className="w-80"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={fetchChecklist} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
                <Button variant="outline" onClick={saveChecklist} disabled={saving || loading || !branchParam}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={exportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button onClick={exportPdf}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Area</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Checklist Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Reviewed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record, index) => (
                      <TableRow key={`${record.branchId}-${record.itemCode}`}>
                        <TableCell className="align-top">{record.controlArea}</TableCell>
                        <TableCell className="align-top">{record.itemCode}</TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="font-medium">{record.itemLabel}</div>
                            <div className="text-xs text-slate-500">{record.guidance}</div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={record.status}
                            onValueChange={(value) => updateRecord(index, { status: value as SaccoChecklistStatus })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="PASS">Pass</SelectItem>
                              <SelectItem value="FAIL">Fail</SelectItem>
                              <SelectItem value="PARTIAL">Partial</SelectItem>
                              <SelectItem value="NA">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="mt-2">
                            <Badge variant={statusTone(record.status)}>{record.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={record.remarks}
                            onChange={(event) => updateRecord(index, { remarks: event.target.value })}
                            placeholder="Add remarks"
                            className="min-h-20"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={record.evidence}
                            onChange={(event) => updateRecord(index, { evidence: event.target.value })}
                            placeholder="Evidence, file name, or reference"
                            className="min-h-20"
                          />
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-600">
                          <div>{record.reviewedByName || "N/A"}</div>
                          {record.reviewedAt && (
                            <div className="text-xs text-slate-500">{format(new Date(record.reviewedAt), "yyyy-MM-dd HH:mm")}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        No checklist rows available for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
