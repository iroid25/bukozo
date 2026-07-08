"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import DataTable, { Column } from "@/components/ui/data-table/data-table";
import { Users, ArrowUpRight, ArrowDownRight, Wallet, Download } from "lucide-react";
import { DateRange } from "react-day-picker";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

interface AgentPerformanceRow {
  id: string;
  agentName: string;
  branch: string;
  rank: number;
  transactionsCount: number;
  transactionAmount: number;
  depositCount: number;
  depositAmount: number;
  withdrawalCount: number;
  withdrawalAmount: number;
  floatTransactionsCount: number;
  floatBalance: number;
  netCashFlow: number;
}

const columns: Column<AgentPerformanceRow>[] = [
  { header: "Rank", accessorKey: "rank" },
  { header: "Agent", accessorKey: "agentName" },
  { header: "Branch", accessorKey: "branch" },
  { header: "Txns", accessorKey: "transactionsCount" },
  {
    header: "Deposits",
    accessorKey: "depositAmount",
    cell: (row) => formatCurrency(row.depositAmount),
  },
  {
    header: "Withdrawals",
    accessorKey: "withdrawalAmount",
    cell: (row) => formatCurrency(row.withdrawalAmount),
  },
  {
    header: "Net Cash Flow",
    accessorKey: "netCashFlow",
    cell: (row) => formatCurrency(row.netCashFlow),
  },
  {
    header: "Float",
    accessorKey: "floatBalance",
    cell: (row) => formatCurrency(row.floatBalance),
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export default function AgentPerformanceReportPage() {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [reportPeriod, setReportPeriod] = useState<string>("");
  const [records, setRecords] = useState<AgentPerformanceRow[]>([]);
  const [summary, setSummary] = useState({
    totalAgents: 0,
    totalTransactions: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalFloatBalance: 0,
    totalNetCashFlow: 0,
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));

      const res = await fetch(`/api/v1/reports/agent-performance?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to load agent performance");
      }

      setRecords(result.data?.agents || []);
      setSummary(result.data?.summary || {
        totalAgents: 0,
        totalTransactions: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalFloatBalance: 0,
        totalNetCashFlow: 0,
      });
      setGeneratedAt(result.data?.generatedAt ? new Date(result.data.generatedAt).toLocaleString() : new Date().toLocaleString());
      if (result.data?.period?.startDate && result.data?.period?.endDate) {
        setReportPeriod(
          `${format(new Date(result.data.period.startDate), "dd MMM yyyy")} - ${format(new Date(result.data.period.endDate), "dd MMM yyyy")}`,
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load agent performance report");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => {
    loadReport();
  }, [loadReport, liveRefreshVersion]);

  const handleExport = (rows: AgentPerformanceRow[]) => {
    try {
      const exportRows = rows.map((row) => ({
        Rank: row.rank,
        Agent: row.agentName,
        Branch: row.branch,
        Transactions: row.transactionsCount,
        Deposits: row.depositAmount,
        Withdrawals: row.withdrawalAmount,
        "Net Cash Flow": row.netCashFlow,
        Float: row.floatBalance,
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Agent Performance");
      XLSX.writeFile(wb, `agent-performance-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Export successful");
    } catch (error) {
      console.error(error);
      toast.error("Export failed");
    }
  };

  const summaryCards = useMemo(
    () => [
      { title: "Total Agents", value: summary.totalAgents, icon: Users },
      { title: "Total Transactions", value: summary.totalTransactions, icon: Wallet },
      { title: "Total Deposits", value: formatCurrency(summary.totalDeposits), icon: ArrowDownRight },
      { title: "Total Withdrawals", value: formatCurrency(summary.totalWithdrawals), icon: ArrowUpRight },
    ],
    [summary],
  );

  return (
    <ReportPageLayout
      title="Agent Performance Report"
      description="Compare agent activity, deposits, withdrawals, float position, and net cash flow."
      period={
        reportPeriod ||
        (dateRange?.from && dateRange?.to
          ? `${format(dateRange.from, "dd MMM yyyy")} - ${format(dateRange.to, "dd MMM yyyy")}`
          : undefined)
      }
      generatedAt={generatedAt || undefined}
      filters={
        <div className="flex flex-wrap items-center gap-4">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          <Button onClick={loadReport} disabled={loading}>
            {loading ? "Loading..." : "Generate"}
          </Button>
        </div>
      }
      summary={
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <ReportSummaryCard key={card.title} title={card.title} value={card.value as any} icon={card.icon} />
          ))}
        </div>
      }
      actions={
        <Button variant="outline" onClick={() => handleExport(records)}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      }
      summaryFirst
    >
      <DataTable
        title="Agent Performance"
        subtitle="Ranked by transaction activity and cash movement."
        data={records}
        columns={columns}
        keyField="id"
        isLoading={loading}
        onRefresh={loadReport}
        actions={{ onExport: () => handleExport(records) }}
        filters={{
          searchFields: ["agentName", "branch"],
          enableDateFilter: false,
        }}
        emptyState={<div className="text-center py-8 text-muted-foreground">No agent performance data found.</div>}
      />
    </ReportPageLayout>
  );
}
