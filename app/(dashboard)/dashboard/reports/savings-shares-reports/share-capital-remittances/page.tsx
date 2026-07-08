"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Share2, DollarSign, Users, Clock3 } from "lucide-react";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, Column } from "@/components/ui/data-table";
import { TableLoading } from "@/components/ui/data-table";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

interface ShareCapitalRemittanceRecord {
  id: string;
  remittedAt: string;
  memberName: string;
  memberNumber: string;
  shareType: string;
  source: string;
  branch: string;
  amount: number;
}

const columns: Column<ShareCapitalRemittanceRecord>[] = [
  {
    header: "Date",
    accessorKey: "remittedAt",
    cell: (row) =>
      new Date(row.remittedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
  },
  { header: "Member No.", accessorKey: "memberNumber" },
  { header: "Member Name", accessorKey: "memberName" },
  { header: "Share Type", accessorKey: "shareType" },
  { header: "Source", accessorKey: "source" },
  {
    header: "Amount",
    accessorKey: "amount",
    cell: (row) => row.amount.toLocaleString(),
  },
  { header: "Branch", accessorKey: "branch" },
];

export default function ShareCapitalRemittancesPage() {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ShareCapitalRemittanceRecord[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [summary, setSummary] = useState({
    totalRecords: 0,
    totalAmount: 0,
    averageAmount: 0,
    uniqueMembers: 0,
    loanDeductionCount: 0,
  });

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/reports/shares/share-capital-remittances", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load share capital remittances");
      }

      setRecords(result.data?.data || []);
      setSummary(
        result.data?.summary || {
          totalRecords: 0,
          totalAmount: 0,
          averageAmount: 0,
          uniqueMembers: 0,
          loanDeductionCount: 0,
        },
      );
      setGeneratedAt(new Date().toLocaleString());
    } catch (error) {
      console.error("Failed to load share capital remittances:", error);
      toast.error("Failed to load share capital remittances");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport, liveRefreshVersion]);

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Remittances",
        value: summary.totalRecords.toLocaleString(),
        icon: Share2,
        accent: "text-emerald-600",
      },
      {
        title: "Total Amount",
        value: summary.totalAmount.toLocaleString(),
        icon: DollarSign,
        accent: "text-blue-600",
      },
      {
        title: "Unique Members",
        value: summary.uniqueMembers.toLocaleString(),
        icon: Users,
        accent: "text-purple-600",
      },
      {
        title: "Loan Deductions",
        value: summary.loanDeductionCount.toLocaleString(),
        icon: Clock3,
        accent: "text-orange-600",
      },
    ],
    [summary],
  );

  const handleExport = (filteredData: ShareCapitalRemittanceRecord[]) => {
    try {
      const exportData = filteredData.map((item) => ({
        Date: format(new Date(item.remittedAt), "dd/MM/yyyy HH:mm"),
        "Member No.": item.memberNumber,
        "Member Name": item.memberName,
        "Share Type": item.shareType,
        Source: item.source,
        Branch: item.branch,
        Amount: item.amount,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Share Capital Remittances");

      const fileName = `share-capital-remittances-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed");
    }
  };

  return (
    <ReportPageLayout
      title="Share Capital Remittances"
      description="Member share contributions and loan-deduction remittances with name, amount, and remittance date."
      generatedAt={generatedAt || undefined}
      summary={summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {card.title}
                  </p>
                  <p className={`mt-2 text-2xl font-bold ${card.accent}`}>{card.value}</p>
                </div>
                <Icon className={`h-5 w-5 ${card.accent}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
      summaryFirst
    >
      {loading ? (
        <TableLoading />
      ) : (
        <DataTable
          title="Share Capital Remittance Register"
          subtitle="Member names, remitted amounts, dates, and source notes."
        data={records}
        columns={columns}
        keyField="id"
          onRefresh={() => void loadReport()}
          actions={{
            onExport: handleExport,
          }}
          filters={{
            searchFields: ["memberName", "memberNumber", "shareType", "source", "branch"],
            enableDateFilter: true,
            getItemDate: (item) => item.remittedAt,
          }}
          emptyState={
            <div className="text-center py-8 text-muted-foreground">
              No share capital remittances found.
            </div>
          }
        />
      )}
    </ReportPageLayout>
  );
}
