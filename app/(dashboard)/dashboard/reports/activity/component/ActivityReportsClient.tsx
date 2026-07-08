"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Calendar,
  Download,
  FileText,
  Filter,
  Shield,
  TrendingUp,
  User,
  DollarSign,
} from "lucide-react";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import type { ActivityRecord, ActivityStats } from "@/lib/reports/activity-types";

type BranchOption = {
  id: string;
  name: string;
  location: string;
};

interface ActivityReportsClientProps {
  activities: ActivityRecord[];
  statistics: ActivityStats;
  userRole: string;
  currentUserId: string;
  currentUserBranchId?: string | null;
  currentUserBranchName?: string | null;
  title: string;
  subtitle: string;
  reportEndpoint?: string;
  statisticsEndpoint?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export default function ActivityReportsClient({
  activities,
  statistics,
  userRole,
  currentUserBranchId,
  currentUserBranchName,
  title,
  subtitle,
  reportEndpoint = "/api/v1/reports/activity",
  statisticsEndpoint = "/api/v1/reports/activity/statistics",
}: ActivityReportsClientProps) {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });

  const isAdmin = userRole === "ADMIN";
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isAdmin ? "all" : currentUserBranchId || "all",
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [records, setRecords] = useState<ActivityRecord[]>(activities);
  const [stats, setStats] = useState<ActivityStats>(statistics);
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  useEffect(() => {
    setRecords(activities);
    setStats(statistics);
  }, [activities, statistics]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadBranches = async () => {
      try {
        setBranchesLoading(true);
        const response = await fetch("/api/v1/branches", {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const branchRows = Array.isArray(payload?.data) ? payload.data : [];
        setBranchOptions(
          branchRows.map((branch: any) => ({
            id: branch.id,
            name: branch.name,
            location: branch.location,
          })),
        );
      } finally {
        setBranchesLoading(false);
      }
    };

    void loadBranches();
  }, [isAdmin]);

  const branchLabel = useMemo(() => {
    if (selectedBranchId === "all") return "All Branches";
    if (!isAdmin) {
      return currentUserBranchName || "Current Branch";
    }
    return (
      branchOptions.find((branch) => branch.id === selectedBranchId)?.name ||
      "Selected Branch"
    );
  }, [branchOptions, currentUserBranchId, currentUserBranchName, isAdmin, selectedBranchId]);

  const filteredActivities = useMemo(() => {
    return records.filter((activity) => {
      const matchesType = typeFilter === "all" || activity.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || activity.status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [records, typeFilter, statusFilter]);

  const selectedBranchForRequest = useMemo(() => {
    if (!isAdmin) {
      return currentUserBranchId || undefined;
    }
    return selectedBranchId === "all" ? undefined : selectedBranchId;
  }, [currentUserBranchId, isAdmin, selectedBranchId]);

  const fetchActivityData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("orderBy", "createdAt");
      params.set("orderDirection", "desc");
      if (selectedBranchForRequest) {
        params.set("branchId", selectedBranchForRequest);
      }

      const [activitiesRes, statsRes] = await Promise.all([
        fetch(`${reportEndpoint}?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(
          `${statisticsEndpoint}${
            selectedBranchForRequest ? `?branchId=${encodeURIComponent(selectedBranchForRequest)}` : ""
          }`,
          {
            cache: "no-store",
            credentials: "include",
          },
        ),
      ]);

      if (!activitiesRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch activity data");
      }

      const activitiesData = await activitiesRes.json();
      const statsData = await statsRes.json();

      setRecords(Array.isArray(activitiesData.data) ? activitiesData.data : []);
      setStats(statsData.data || statistics);
      setGeneratedAt(new Date().toLocaleString());
    } catch (error) {
      console.error("Error fetching activity reports:", error);
      toast.error("Failed to load activity reports");
    } finally {
      setLoading(false);
    }
  }, [reportEndpoint, selectedBranchForRequest, statistics, statisticsEndpoint]);

  useEffect(() => {
    void fetchActivityData();
  }, [fetchActivityData, liveRefreshVersion]);

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = filteredActivities.map((activity) => ({
        "Activity Type": activity.type.replace(/_/g, " "),
        Action: activity.action,
        Description: activity.description,
        User: activity.user,
        Branch: activity.branchName || branchLabel,
        Member: activity.member || "N/A",
        Status: activity.status,
        Amount: activity.amount || 0,
        Reference: activity.reference || "N/A",
        Channel: activity.channel || "N/A",
        "IP Address": activity.ipAddress || "N/A",
        "Date & Time": format(new Date(activity.createdAt), "yyyy-MM-dd HH:mm:ss"),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Reports");

      const fileName = `Activity_Reports_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Activity reports exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const generatedOn = generatedAt || new Date().toLocaleString();
      const reportTitle = `${title} - Customer Information`;

      const renderHeader = () => {
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
        doc.text(reportTitle, pageWidth - 12, 12, { align: "right" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Branch: ${branchLabel}`, pageWidth - 12, 17, {
          align: "right",
        });
        doc.text(`Generated: ${generatedOn}`, pageWidth - 12, 22, {
          align: "right",
        });
      };

      const summaryStartY = 34;
      const summaryCards = [
        { label: "Total Activities", value: stats.totalActivities },
        { label: "Today", value: stats.todayActivities },
        { label: "This Month", value: stats.thisMonthActivities },
        { label: "Unique Users", value: stats.uniqueUsers },
        { label: "Transaction Value", value: formatCurrency(stats.totalTransactionValue) },
      ];

      const cardWidth = (pageWidth - 24 - 8 * (summaryCards.length - 1)) / summaryCards.length;
      summaryCards.forEach((card, index) => {
        const x = 12 + index * (cardWidth + 8);
        doc.setFillColor(247, 249, 251);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, summaryStartY, cardWidth, 18, 3, 3, "FD");
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + 3, summaryStartY + 6);
        doc.setTextColor(3, 22, 53);
        doc.setFontSize(11);
        doc.text(String(card.value), x + 3, summaryStartY + 13);
      });

      const rows = filteredActivities.map((activity) => [
        format(new Date(activity.createdAt), "dd MMM yyyy HH:mm"),
        activity.type.replace(/_/g, " "),
        activity.action,
        activity.user,
        activity.branchName || branchLabel,
        activity.member || "-",
        activity.status,
        activity.amount ? formatCurrency(activity.amount) : "-",
        activity.reference || "-",
      ]);

      autoTable(doc, {
        startY: 58,
        head: [[
          "Date & Time",
          "Type",
          "Action",
          "User",
          "Branch",
          "Member",
          "Status",
          "Amount",
          "Reference",
        ]],
        body: rows,
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [3, 22, 53],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 58, left: 12, right: 12, bottom: 16 },
        didDrawPage: () => {
          renderHeader();
          const footerY = pageHeight - 10;
          doc.setDrawColor(203, 213, 225);
          doc.line(12, footerY - 4, pageWidth - 12, footerY - 4);
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(
            "This report is system generated by Bukonzo United Teachers SACCO.",
            12,
            footerY,
          );
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 6, {
          align: "right",
        });
      }

      const fileName = `Audit_Trail_${branchLabel.replace(/\s+/g, "_")}_${format(
        new Date(),
        "yyyy-MM-dd",
      )}.pdf`;
      doc.save(fileName);
      toast.success("PDF export ready", {
        description: `Saved ${fileName}`,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("PDF export failed");
    }
  };

  const columns: Column<ActivityRecord>[] = [
    {
      accessorKey: "action",
      header: "Activity Details",
      cell: (row) => {
        const activity = row;
        const colorClass =
          activity.type === "DEPOSIT"
            ? "text-green-600 bg-green-100"
            : activity.type === "WITHDRAWAL"
              ? "text-red-600 bg-red-100"
              : activity.type === "LOAN"
                ? "text-blue-600 bg-blue-100"
                : activity.type === "LOAN_REPAYMENT"
                  ? "text-purple-600 bg-purple-100"
                  : activity.type === "USER_MANAGEMENT"
                    ? "text-orange-600 bg-orange-100"
                    : "text-slate-600 bg-slate-100";

        return (
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium capitalize">{activity.action}</span>
              <span className="text-sm text-gray-500">
                {activity.type.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "user",
      header: "User",
      cell: (row) => {
        const activity = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{activity.user}</span>
              {activity.branchName && (
                <span className="text-xs text-gray-500">{activity.branchName}</span>
              )}
              {activity.member && (
                <span className="text-sm text-gray-500">Member: {activity.member}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (row) => {
        const activity = row;

        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{activity.description}</span>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {activity.reference && <span>Ref: {activity.reference}</span>}
              {activity.channel && (
                <Badge variant="outline" className="text-xs">
                  {activity.channel}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const activity = row;

        return (
          <div className="flex items-center gap-2">
            {activity.amount ? (
              <>
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700">
                  {formatCurrency(activity.amount)}
                </span>
              </>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => {
        const activity = row;
        const tone =
          activity.status === "COMPLETED" || activity.status === "APPROVED"
            ? "default"
            : activity.status === "PENDING"
              ? "secondary"
              : activity.status === "FAILED"
                ? "destructive"
                : "outline";

        return <Badge variant={tone as any}>{activity.status}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date & Time",
      cell: (row) => {
        const activity = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {format(new Date(activity.createdAt), "MMM dd, yyyy")}
            </span>
            <span className="text-sm text-gray-500">
              {format(new Date(activity.createdAt), "HH:mm:ss")}
            </span>
          </div>
        );
      },
    },
  ];

  const statsCards = [
    {
      title: "Today's Activities",
      value: stats.todayActivities,
      icon: TrendingUp,
      tone: "text-green-700",
    },
    {
      title: "This Month",
      value: stats.thisMonthActivities,
      icon: Calendar,
      tone: "text-blue-700",
    },
    {
      title: "Total Activities",
      value: stats.totalActivities,
      icon: FileText,
      tone: "text-purple-700",
    },
    {
      title: "Unique Users",
      value: stats.uniqueUsers,
      icon: Shield,
      tone: "text-orange-700",
    },
  ];

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
                {branchLabel}
              </Badge>
              {generatedAt && (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Updated {generatedAt}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statsCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {card.title}
                    </div>
                    <Icon className={`h-4 w-4 ${card.tone}`} />
                  </div>
                  <div className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</div>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select
                  value={selectedBranchId}
                  onValueChange={setSelectedBranchId}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue
                      placeholder={branchesLoading ? "Loading branches..." : "Select branch"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && (
                      <SelectItem value="all">All Branches</SelectItem>
                    )}
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
                <label className="text-sm font-medium">Activity Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select activity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="DEPOSIT">Deposits</SelectItem>
                    <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
                    <SelectItem value="LOAN">Loans</SelectItem>
                    <SelectItem value="LOAN_REPAYMENT">Loan Repayments</SelectItem>
                    <SelectItem value="USER_MANAGEMENT">User Management</SelectItem>
                    <SelectItem value="ACCOUNT_MANAGEMENT">Account Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchActivityData} disabled={loading}>
                <Filter className="mr-2 h-4 w-4" />
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button onClick={handleExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
            Showing activity for <span className="font-semibold text-slate-900">{branchLabel}</span>
          </div>
        </CardContent>
      </Card>

      <DataTable<ActivityRecord>
        title={title}
        subtitle={subtitle}
        data={filteredActivities}
        columns={columns}
        keyField="id"
        isLoading={loading}
        onRefresh={fetchActivityData}
        actions={{
          onExport: handleExportExcel,
        }}
        filters={{
          searchFields: ["user", "branchName", "member", "action", "description", "reference"],
          enableDateFilter: true,
          getItemDate: (item) => item.createdAt,
        }}
        renderRowActions={() => <TableActions.RowActions />}
      />
    </div>
  );
}
