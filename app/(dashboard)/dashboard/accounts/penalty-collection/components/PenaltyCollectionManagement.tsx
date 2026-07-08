"use client";

import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, AlertTriangle, RefreshCw, DollarSign, CheckCircle, Clock } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateCompoundingPenalty, calculateSimplePenaltyEstimation, PenaltyTier } from "@/lib/penalty-calculations";

interface PenaltyCollectionManagementProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

interface LoanWithPenalty {
  id: string;
  memberName: string;
  memberNumber: string;
  loanProduct: string;
  amountGranted: number;
  outstandingBalance: number;
  penaltyCharged: number;
  penaltyPaid: number;
  penaltyOutstanding: number;
  dueDate: string;
  status: string;
  daysOverdue: number;
  collectionRate: number;
}

const DEFAULT_PENALTY_TIERS: PenaltyTier[] = [
  { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
  { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
  { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
  { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
  { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
  { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
  { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
];

export default function PenaltyCollectionManagement({
  title,
  subtitle,
  initialRole,
}: PenaltyCollectionManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanWithPenalty | null>(null);
  const [calculatingPenalty, setCalculatingPenalty] = useState(false);
  const [reversingPenalty, setReversingPenalty] = useState(false);
  const [reversalAmount, setReversalAmount] = useState<string>("");
  const [reversalReason, setReversalReason] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/penalty-collection${queryString ? `?${queryString}` : ""}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch penalty data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleApplyPenalty = async (loanId: string) => {
    setCalculatingPenalty(true);
    try {
      const response = await fetch(`/api/v1/loans/${loanId}/penalty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success("Penalty applied successfully");
        fetchData();
      } else {
        toast.error(result.error || "Failed to apply penalty");
      }
    } catch (error) {
      console.error("Apply penalty error:", error);
      toast.error("Failed to apply penalty");
    } finally {
      setCalculatingPenalty(false);
    }
  };

  const handleReversePenalty = async () => {
    if (!selectedLoan || !reversalAmount || parseFloat(reversalAmount) <= 0) {
      toast.error("Please enter a valid reversal amount");
      return;
    }

    const amount = parseFloat(reversalAmount);
    if (amount > (selectedLoan.penaltyOutstanding || 0)) {
      toast.error("Reversal amount cannot exceed outstanding penalty");
      return;
    }

    setReversingPenalty(true);
    try {
      const response = await fetch(
        `/api/v1/loans/${selectedLoan.id}/penalty/reverse?amount=${amount}&reason=${encodeURIComponent(reversalReason || "Manual reversal")}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      
      if (result.success) {
        toast.success("Penalty reversed successfully", {
          description: `Amount: ${formatCurrency(amount)} - Refunded to account`
        });
        setSelectedLoan(null);
        setReversalAmount("");
        setReversalReason("");
        fetchData();
      } else {
        toast.error(result.error || "Failed to reverse penalty");
      }
    } catch (error) {
      console.error("Reverse penalty error:", error);
      toast.error("Failed to reverse penalty");
    } finally {
      setReversingPenalty(false);
    }
  };

  const records = data?.records || [];
  
  const filteredRecords = activeTab === "overdue" 
    ? records.filter((r: any) => r.penaltyOutstanding > 0)
    : records;

  const columns: Column<any>[] = [
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div>
          <div className="font-semibold">{row.memberName}</div>
          <div className="text-xs text-muted-foreground">{row.memberNumber}</div>
        </div>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => <span className="text-sm">{row.loanProduct}</span>,
    },
    {
      header: "Outstanding",
      accessorKey: "outstandingBalance",
      cell: (row: any) => (
        <span className="font-medium">{formatCurrency(row.outstandingBalance || 0)}</span>
      ),
    },
    {
      header: "Days Overdue",
      accessorKey: "daysOverdue",
      cell: (row: any) => {
        const days = row.daysOverdue || 0;
        const colorClass = days > 90 ? "text-red-600" : days > 30 ? "text-orange-600" : "text-green-600";
        return <span className={`font-bold ${colorClass}`}>{days}</span>;
      },
    },
    {
      header: "Penalty Charged",
      accessorKey: "penaltyCharged",
      cell: (row: any) => (
        <span className="font-bold text-amber-600">{formatCurrency(row.penaltyCharged || 0)}</span>
      ),
    },
    {
      header: "Penalty Paid",
      accessorKey: "penaltyPaid",
      cell: (row: any) => (
        <span className="font-bold text-green-600">{formatCurrency(row.penaltyPaid || 0)}</span>
      ),
    },
    {
      header: "Outstanding",
      accessorKey: "penaltyOutstanding",
      cell: (row: any) => {
        const outstanding = row.penaltyOutstanding || 0;
        return (
          <span className={`font-bold ${outstanding > 0 ? "text-red-600" : "text-gray-500"}`}>
            {formatCurrency(outstanding)}
          </span>
        );
      },
    },
    {
      accessorKey: "collectionRate",
      header: "Collection Rate",
      cell: (row: any) => {
        const rate = row.collectionRate || 0;
        const colorClass = rate >= 80 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600";
        return (
          <Badge className={`${colorClass} bg-opacity-10`} variant="outline">
            {rate.toFixed(1)}%
          </Badge>
        );
      },
    },
  ];

  const renderRowActions = (row: any) => (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setSelectedLoan(row)}
    >
      View Details
    </Button>
  );

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        Member: item.memberName,
        "Member Number": item.memberNumber,
        Product: item.loanProduct,
        "Outstanding Balance": item.outstandingBalance || 0,
        "Days Overdue": item.daysOverdue || 0,
        "Penalty Charged": item.penaltyCharged || 0,
        "Penalty Paid": item.penaltyPaid || 0,
        "Penalty Outstanding": item.penaltyOutstanding || 0,
        "Collection Rate": `${(item.collectionRate || 0).toFixed(2)}%`,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Penalty Collections");
      const fileName = `penalty-collections-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(filteredRecords)}
        disableExport={!filteredRecords.length}
      />

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => handleFilterChange("branchId", v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-red-700">Total Penalty Charged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">
              {formatCurrency(data?.summary?.totalPenaltyCharged || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-green-700">Total Penalty Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(data?.summary?.totalPenaltyPaid || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-orange-700">Outstanding Penalty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-700">
              {formatCurrency(data?.summary?.totalPenaltyOutstanding || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-purple-700">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-700">
              {(data?.summary?.overallCollectionRate || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-blue-700">Loans with Penalties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">
              {data?.summary?.totalLoans || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Loans</TabsTrigger>
          <TabsTrigger value="overdue">With Outstanding Penalty</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <div className="flex-1 overflow-hidden rounded-lg border bg-card">
            <DataTable
              title="Penalty Collections"
              subtitle={`${filteredRecords.length} records`}
              data={filteredRecords}
              columns={columns}
              keyField="loanId"
              isLoading={loading}
              onRefresh={fetchData}
              renderRowActions={renderRowActions}
            />
          </div>
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <div className="flex-1 overflow-hidden rounded-lg border bg-card">
            <DataTable
              title="Outstanding Penalties"
              subtitle={`${filteredRecords.filter((r: any) => r.penaltyOutstanding > 0).length} records`}
              data={filteredRecords.filter((r: any) => r.penaltyOutstanding > 0)}
              columns={columns}
              keyField="loanId"
              isLoading={loading}
              onRefresh={fetchData}
              renderRowActions={renderRowActions}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Penalty Details - {selectedLoan?.memberName}</DialogTitle>
            <DialogDescription>
              Loan: {selectedLoan?.loanProduct} | Due: {selectedLoan?.dueDate ? format(new Date(selectedLoan.dueDate), "dd/MM/yyyy") : "N/A"}
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedLoan.outstandingBalance)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Days Overdue</p>
                  <p className="text-xl font-bold text-red-600">{selectedLoan.daysOverdue}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-700">Penalty Charged</p>
                  <p className="text-xl font-bold text-amber-700">{formatCurrency(selectedLoan.penaltyCharged)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">Penalty Paid</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(selectedLoan.penaltyPaid)}</p>
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-700 mb-2">Penalty Rate Tiers (Escalating)</p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PENALTY_TIERS.map((tier, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tier.minDays}-{tier.maxDays === 9999 ? "∞" : tier.maxDays}d: {(tier.penaltyRate * 100).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Penalty Reversal Section */}
              {(selectedLoan.penaltyOutstanding || 0) > 0 && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                  <p className="text-xs font-bold text-orange-700 uppercase">Penalty Reversal</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder="Enter reversal amount"
                        value={reversalAmount}
                        onChange={(e) => setReversalAmount(e.target.value)}
                        className="w-full p-2 border border-orange-200 rounded-lg text-sm"
                        max={selectedLoan.penaltyOutstanding}
                      />
                      <p className="text-xs text-orange-600 mt-1">
                        Max: {formatCurrency(selectedLoan.penaltyOutstanding || 0)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={reversalReason}
                        onChange={(e) => setReversalReason(e.target.value)}
                        className="w-full p-2 border border-orange-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2 flex-wrap">
                <Button variant="outline" onClick={() => {
                  setSelectedLoan(null);
                  setReversalAmount("");
                  setReversalReason("");
                }}>
                  Close
                </Button>
                <div className="flex gap-2">
                  {(selectedLoan.penaltyOutstanding || 0) > 0 && (
                    <Button 
                      variant="destructive"
                      onClick={handleReversePenalty}
                      disabled={reversingPenalty || !reversalAmount || parseFloat(reversalAmount) <= 0}
                    >
                      {reversingPenalty ? "Reversing..." : "Reverse Penalty"}
                    </Button>
                  )}
                  <Button 
                    variant="default"
                    onClick={() => handleApplyPenalty(selectedLoan.id)}
                    disabled={calculatingPenalty}
                  >
                    {calculatingPenalty ? "Calculating..." : "Apply/Update Penalty"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}