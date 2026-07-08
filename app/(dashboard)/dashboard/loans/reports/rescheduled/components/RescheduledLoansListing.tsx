// @ts-nocheck
"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search, Filter } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface RescheduledListingProps {
  title: string;
  subtitle: string;
  role: string;
  initialBranchId?: string;
}

export default function RescheduledListing({
  title,
  subtitle,
  role,
  initialBranchId,
}: RescheduledListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [loans, setLoans] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Server-side filters (from URL)
  const branchFilter = searchParams.get("branchId") || "all";
  const officerFilter = searchParams.get("officerId") || "all";

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== "all") params.set("branchId", branchFilter);
      if (officerFilter !== "all") params.set("officerId", officerFilter);

      const queryString = params.toString();
      
      const [loansRes, officersRes] = await Promise.all([
        fetch(`/api/v1/reports/loans/rescheduled${queryString ? `?${queryString}` : ""}`, {
          cache: "no-store",
        }),
        fetch(`/api/v1/users?role=LOANOFFICER`, {
          cache: "no-store",
        })
      ]);

      const loansResult = await loansRes.json();
      const officersResult = await officersRes.json();

      if (loansResult.success) {
         setLoans(loansResult.data);
      } else {
         toast.error("Failed to fetch rescheduled loans");
      }

      if (officersResult.success) {
        setOfficers(officersResult.data);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchFilter, officerFilter]);

  const columns: Column<any>[] = [
    {
      header: "Member Name",
      accessorKey: "memberName",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.memberName}</span>
          <span className="text-[10px] text-muted-foreground">
            {row.memberNumber} | {row.memberPhone}
          </span>
        </div>
      ),
    },
    { header: "Product", accessorKey: "loanProduct" },
    {
      header: "Original Amount",
      accessorKey: "originalAmount",
      cell: (row) => formatCurrency(row.originalAmount),
    },
    {
      header: "Rescheduled Amount",
      accessorKey: "rescheduledAmount",
      cell: (row) => (
        <span className="font-bold text-blue-600">
          {formatCurrency(row.rescheduledAmount)}
        </span>
      ),
    },
    {
      header: "New Period",
      accessorKey: "rescheduledPeriod",
      cell: (row) => <span className="text-xs">{row.rescheduledPeriod} days</span>,
    },
    {
      header: "Officer",
      accessorKey: "loanOfficer",
      cell: (row) => <span className="text-xs">{row.loanOfficer}</span>,
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row) => <span className="text-xs">{row.branch}</span>,
    },
  ];

  // Calculate summary
  const summary = useMemo(() => {
    return {
      totalRescheduledLoans: loans.length,
      totalOriginalAmount: loans.reduce(
        (sum: number, loan: any) => sum + (loan.originalAmount || 0),
        0
      ),
      totalRescheduledAmount: loans.reduce(
        (sum: number, loan: any) => sum + (loan.rescheduledAmount || 0),
        0
      ),
    };
  }, [loans]);

  const handleExport = () => {
    const dataToExport = loans; // Export all currently fetched (filtered by API)
    try {
      if (!dataToExport.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = dataToExport.map((item: any) => ({
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        Product: item.loanProduct,
        "Loan ID": item.loanId,
        "Original Amount": item.originalAmount,
        "Rescheduled Amount": item.rescheduledAmount,
        "New Period": item.rescheduledPeriod || "N/A",
        Officer: item.loanOfficer,
        Branch: item.branch,
      }));

      // Add summary row
      exportData.push({
        "Member Name": "SUMMARY",
        "Member Number": "",
        Product: "",
        "Loan ID": "",
        "Original Amount": summary.totalOriginalAmount,
        "Rescheduled Amount": summary.totalRescheduledAmount,
        "New Period": "",
        Officer: `Total Loans: ${summary.totalRescheduledLoans}`,
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rescheduled Loans");
      XLSX.writeFile(wb, `rescheduled-loans-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!loans.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(role) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => updateFilter("branchId", v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {/* Note: In a real app we'd fetch branches too, assuming Main Branch for now or passed prop if needed */}
            </SelectContent>
          </Select>
        )}

        <Select
          value={searchParams.get("officerId") || "all"}
          onValueChange={(v) => updateFilter("officerId", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Officers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {officers.map((officer) => (
              <SelectItem key={officer.id} value={officer.id}>
                {officer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchParams.get("branchId") || searchParams.get("officerId")) && (
          <Button
            variant="ghost"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("branchId");
              params.delete("officerId");
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4 shadow-sm bg-card">
          <p className="text-sm text-muted-foreground font-medium">
            Total Rescheduled Loans
          </p>
          <p className="text-2xl font-bold">{summary.totalRescheduledLoans}</p>
        </div>
        <div className="rounded-lg border p-4 shadow-sm bg-card">
          <p className="text-sm text-muted-foreground font-medium">Original Amount</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalOriginalAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-4 shadow-sm bg-card">
          <p className="text-sm text-muted-foreground font-medium">Rescheduled Amount</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.totalRescheduledAmount)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <DataTable
          title=""
          subtitle=""
          data={loans}
          columns={columns}
          isLoading={loading}
          keyField="loanId"
          filters={{
            searchFields: ["memberName", "memberNumber", "loanId"],
          }}
          actions={{
             onExport: handleExport,
          }}
        />
      </div>
    </div>
  );
}
