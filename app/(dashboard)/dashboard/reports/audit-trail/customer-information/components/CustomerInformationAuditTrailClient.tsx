"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Shield,
  User,
  Building,
  FileText,
  Clock3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type Snapshot = {
  snapshotType: "BEFORE" | "AFTER";
  fullName: string | null;
  dateOfBirth: string | Date | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  idCardNumber: string | null;
  refNumber: string | null;
  registrationDate: string | Date | null;
  groupCode: string | null;
  groupName: string | null;
};

type AuditEvent = {
  auditEventId: string;
  actionType: string;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  changedBy: string | null;
  changedByUserId: string | null;
  changedAt: string;
  customerId: string;
  before: Snapshot | null;
  after: Snapshot | null;
  changedFields: string[];
};

type Stats = {
  totalEvents: number;
  totalSnapshots: number;
  beforeSnapshots: number;
  afterSnapshots: number;
  customersAffected: number;
  branchesAffected: number;
  createdEvents: number;
  editedEvents: number;
  deletedEvents: number;
  activatedEvents: number;
  deactivatedEvents: number;
};

type BranchOption = {
  id: string;
  name: string;
  code?: string | null;
};

const EMPTY_STATS: Stats = {
  totalEvents: 0,
  totalSnapshots: 0,
  beforeSnapshots: 0,
  afterSnapshots: 0,
  customersAffected: 0,
  branchesAffected: 0,
  createdEvents: 0,
  editedEvents: 0,
  deletedEvents: 0,
  activatedEvents: 0,
  deactivatedEvents: 0,
};

const FIELD_DEFS = [
  { key: "fullName", label: "Name" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "sex", label: "Sex" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile Number" },
  { key: "idCardNumber", label: "ID Card" },
  { key: "refNumber", label: "Ref. No." },
  { key: "registrationDate", label: "Registration Date" },
  { key: "groupCode", label: "Group Code/No." },
  { key: "groupName", label: "Group Name" },
] as const;

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    dateStyle: "medium",
  }).format(date);
}

function formatFieldValue(field: keyof Snapshot, snapshot: Snapshot | null) {
  if (!snapshot) return "-";
  const value = snapshot[field];
  if (!value) return "-";
  if (field === "dateOfBirth" || field === "registrationDate") {
    return formatDateOnly(value);
  }
  return String(value);
}

function branchLabel(event: AuditEvent) {
  const code = event.branchCode || event.branchId || "N/A";
  const name = event.branchName || "Unknown Branch";
  return `${code} - ${name}`;
}

function buildExportRows(events: AuditEvent[]) {
  return events.flatMap((event) => {
    const eventMeta = {
      "Audit Event": event.auditEventId,
      Action: event.actionType,
      Branch: branchLabel(event),
      Operator: event.changedBy || "-",
      "Changed At": formatDateTime(event.changedAt),
      "Changed Fields": event.changedFields.join(", ") || "-",
      "Customer Id": event.customerId,
    };

    return (["BEFORE", "AFTER"] as const).map((snapshotType) => {
      const snapshot = snapshotType === "BEFORE" ? event.before : event.after;
      return {
        ...eventMeta,
        "Client Status": snapshotType,
        Name: snapshot?.fullName || "-",
        "Date of Birth": formatDateOnly(snapshot?.dateOfBirth || null),
        Sex: snapshot?.sex || "-",
        Address: snapshot?.address || "-",
        Phone: snapshot?.phone || "-",
        "Mobile Number": snapshot?.mobile || "-",
        "ID Card": snapshot?.idCardNumber || "-",
        "Ref. No.": snapshot?.refNumber || "-",
        "Registration Date": formatDateOnly(snapshot?.registrationDate || null),
        "Group Code/No.": snapshot?.groupCode || "-",
        "Group Name": snapshot?.groupName || "-",
      };
    });
  });
}

export default function CustomerInformationAuditTrailClient({
  currentUserBranchId,
  currentUserBranchName,
  userRole,
  title,
  subtitle,
}: {
  currentUserBranchId?: string | null;
  currentUserBranchName?: string | null;
  userRole: string;
  title: string;
  subtitle: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(
    isAdmin ? "all" : currentUserBranchId || "all",
  );
  const [actionType, setActionType] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 20000,
  });

  const selectedBranchLabel = useMemo(() => {
    if (selectedBranchId === "all") return "All Branches";
    if (!isAdmin) return currentUserBranchName || "Current Branch";
    return branchOptions.find((branch) => branch.id === selectedBranchId)?.name || "Selected Branch";
  }, [branchOptions, currentUserBranchName, isAdmin, selectedBranchId]);

  const groupedEvents = useMemo(() => {
    const buckets = new Map<string, AuditEvent[]>();
    events.forEach((event) => {
      const key = branchLabel(event);
      const list = buckets.get(key) || [];
      list.push(event);
      buckets.set(key, list);
    });
    return Array.from(buckets.entries());
  }, [events]);

  const loadBranches = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/v1/branches", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBranchOptions(
        rows.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code || branch.id,
        })),
      );
    } catch {
      // Non-fatal.
    }
  };

  const fetchData = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", "200");
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      } else if (!isAdmin && currentUserBranchId) {
        params.set("branchId", currentUserBranchId);
      }
      if (actionType !== "all") params.set("actionType", actionType);
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const [eventsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/reports/audit-trail/customer-information?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(
          `/api/v1/reports/audit-trail/customer-information/statistics${
            isAdmin && selectedBranchId !== "all"
              ? `?branchId=${encodeURIComponent(selectedBranchId)}`
              : !isAdmin && currentUserBranchId
                ? `?branchId=${encodeURIComponent(currentUserBranchId)}`
                : ""
          }`,
          {
            cache: "no-store",
            credentials: "include",
          },
        ),
      ]);

      if (!eventsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch audit trail data");
      }

      const eventsPayload = await eventsRes.json();
      const statsPayload = await statsRes.json();
      setEvents(Array.isArray(eventsPayload?.data?.events) ? eventsPayload.data.events : []);
      setStats(statsPayload?.data || EMPTY_STATS);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error("Error loading customer audit trail:", err);
      setError(err instanceof Error ? err.message : "Failed to load report");
      toast.error("Failed to load audit trail report");
      setEvents([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      void loadBranches();
      void fetchData(true);
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!hasLoadedOnce || status !== "authenticated") return;
    void fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const highlightClass = (event: AuditEvent, fieldKey: string) =>
    event.changedFields.includes(fieldKey)
      ? "bg-amber-50 border-amber-200"
      : "bg-white border-slate-200";

  const handleRefresh = () => {
    void fetchData(false);
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");
      const exportData = buildExportRows(events);
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Audit Trail");
      XLSX.writeFile(
        workbook,
        `Customer_Audit_Trail_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      );
      toast.success("Excel export ready");
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    try {
      setExporting(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const generatedAt = new Intl.DateTimeFormat("en-UG", {
        timeZone: "Africa/Kampala",
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());

      doc.setFillColor(3, 22, 53);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(REPORT_HEADER_DETAILS.institutionName, 12, 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(REPORT_HEADER_DETAILS.registrationNumber, 12, 17);
      doc.text(
        `${REPORT_HEADER_DETAILS.postalAddress.join(", ")} | ${REPORT_HEADER_DETAILS.contacts.join(" / ")} | ${REPORT_HEADER_DETAILS.email}`,
        12,
        22,
      );

      doc.setTextColor(3, 22, 53);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(title, pageWidth - 12, 12, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Branch: ${selectedBranchLabel}`, pageWidth - 12, 17, { align: "right" });
      doc.text(`Generated: ${generatedAt}`, pageWidth - 12, 22, { align: "right" });

      autoTable(doc, {
        startY: 32,
        head: [[
          "Branch",
          "Action",
          "Client Status",
          "Name",
          "DOB",
          "Sex",
          "Address",
          "Phone",
          "Mobile",
          "ID Card",
          "Ref No.",
          "Reg. Date",
          "Group Code/No.",
          "Group Name",
          "Operator",
          "Changed At",
        ]],
        body: buildExportRows(events).map((row) => [
          row.Branch,
          row.Action,
          row["Client Status"],
          row.Name,
          row["Date of Birth"],
          row.Sex,
          row.Address,
          row.Phone,
          row["Mobile Number"],
          row["ID Card"],
          row["Ref. No."],
          row["Registration Date"],
          row["Group Code/No."],
          row["Group Name"],
          row.Operator,
          row["Changed At"],
        ]),
        styles: { fontSize: 6.5, cellPadding: 1.6, overflow: "linebreak" },
        headStyles: { fillColor: [3, 22, 53], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 34, left: 10, right: 10, bottom: 14 },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          const footerY = pageHeight - 8;
          doc.text(
            "This report is system generated by Bukonzo United Teachers SACCO.",
            10,
            footerY,
          );
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 10, pageHeight - 4, {
          align: "right",
        });
      }

      doc.save(`Customer_Audit_Trail_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF export ready");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-10 w-10 animate-spin text-slate-700" />
          <p className="text-slate-600">Loading customer audit trail...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card className="mb-6 border-slate-200 shadow-sm">
        <CardHeader className="space-y-4 border-b bg-slate-50/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  {REPORT_HEADER_DETAILS.institutionName}
                </span>
              </div>
              <CardTitle className="text-2xl text-slate-900">{title}</CardTitle>
              <p className="max-w-3xl text-sm text-slate-600">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {selectedBranchLabel}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {stats.totalEvents} events
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { title: "Total Events", value: stats.totalEvents, icon: FileText },
              { title: "Customers", value: stats.customersAffected, icon: User },
              { title: "Branches", value: stats.branchesAffected, icon: Building },
              { title: "Before Rows", value: stats.beforeSnapshots, icon: Calendar },
              { title: "After Rows", value: stats.afterSnapshots, icon: Clock3 },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {card.title}
                    </div>
                    <Icon className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select
                  value={selectedBranchId}
                  onValueChange={(value) => setSelectedBranchId(value)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="all">All Branches</SelectItem>}
                    {!isAdmin ? (
                      <SelectItem value={currentUserBranchId || "all"}>
                        {currentUserBranchName || "Current Branch"}
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
                <label className="text-sm font-medium">Action Type</label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="Created">Created</SelectItem>
                    <SelectItem value="Edited">Edited</SelectItem>
                    <SelectItem value="Deleted">Deleted</SelectItem>
                    <SelectItem value="Activated">Activated</SelectItem>
                    <SelectItem value="Deactivated">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Search</label>
              <Input
                className="w-full xl:w-[28rem]"
                placeholder="Search by member name or reference number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing || exporting}>
                <Filter className="mr-2 h-4 w-4" />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button onClick={handleExportPdf} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
            Showing audit events for <span className="font-semibold text-slate-900">{selectedBranchLabel}</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5">
            <p className="text-red-800">{error}</p>
            <Button className="mt-3" variant="outline" onClick={() => void fetchData(false)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedEvents.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-slate-500">
                No customer audit events found for the selected filters.
              </CardContent>
            </Card>
          ) : (
            groupedEvents.map(([groupName, branchEvents]) => (
              <Card key={groupName} className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-slate-50/70">
                  <CardTitle className="text-lg">{groupName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {branchEvents.map((event) => (
                    <div key={event.auditEventId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="default">{event.actionType}</Badge>
                            <span className="text-sm font-medium text-slate-700">
                              {event.changedBy || "System"}
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatDateTime(event.changedAt)}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500">
                            Customer ref: <span className="font-semibold text-slate-900">{event.before?.refNumber || event.after?.refNumber || event.customerId}</span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-500">
                          Changed fields: <span className="font-semibold text-slate-800">{event.changedFields.join(", ") || "None detected"}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {(["BEFORE", "AFTER"] as const).map((snapshotType) => {
                          const snapshot = snapshotType === "BEFORE" ? event.before : event.after;
                          return (
                            <div
                              key={`${event.auditEventId}-${snapshotType}`}
                              className={`rounded-2xl border p-4 ${
                                snapshotType === "BEFORE"
                                  ? "border-slate-200 bg-slate-50/60"
                                  : "border-emerald-200 bg-emerald-50/40"
                              }`}
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                                  {snapshotType.toLowerCase()} state
                                </h4>
                                <Badge variant={snapshotType === "BEFORE" ? "secondary" : "default"}>
                                  {snapshotType === "BEFORE" ? "Before" : "After"}
                                </Badge>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {FIELD_DEFS.map((field) => (
                                  <div
                                    key={field.key}
                                    className={`rounded-xl border p-3 ${highlightClass(event, field.key)}`}
                                  >
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                      {field.label}
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-slate-900">
                                      {formatFieldValue(field.key, snapshot)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
