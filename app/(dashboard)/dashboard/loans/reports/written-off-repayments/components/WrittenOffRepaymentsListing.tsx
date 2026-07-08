"use client";

import { useState, useEffect } from "react";

import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Printer } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface WrittenOffRepayment {
  repaymentId: string;
  loanId: string;
  memberName: string;
  memberNumber: string;
  memberPhone: string;
  loanProduct: string;
  amount: number;
  repaymentDate: Date;
  channel: string;
  reference: string;
  loanOfficer: string;
  branch: string;
}

interface WrittenOffRepaymentsListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function WrittenOffRepaymentsListing({
  title,
  subtitle,
  initialRole,
}: WrittenOffRepaymentsListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/written-off-repayment${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch data");
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("An error occurred while fetching data");
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch officers for filter
  useEffect(() => {
    const fetchFilterOfficers = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching filter officers:", error);
      }
    };
    fetchFilterOfficers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: Column<WrittenOffRepayment>[] = [
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
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row) => <span className="text-xs">{row.loanProduct}</span>,
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: (row) => (
        <span className="font-bold text-green-600">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "repaymentDate",
      cell: (row) => (
        <span className="text-sm">
          {format(new Date(row.repaymentDate), "dd/MM/yyyy")}
        </span>
      ),
    },
    {
      header: "Channel",
      accessorKey: "channel",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.channel}</span>,
    },
    {
      header: "Reference",
      accessorKey: "reference",
      cell: (row) => <span className="text-xs font-mono">{row.reference || "N/A"}</span>,
    },
    {
      header: "Loan ID",
      accessorKey: "loanId",
      cell: (row) => (
        <span className="font-mono text-[10px]">{row.loanId?.substring(0, 8) || "N/A"}</span>
      ),
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

  const handleExport = async (filteredData: WrittenOffRepayment[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item) => ({
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        Date: format(new Date(item.repaymentDate), "dd/MM/yyyy HH:mm"),
        Amount: item.amount,
        Channel: item.channel,
        Reference: item.reference,
        "Loan ID": item.loanId,
        Officer: item.loanOfficer,
        Branch: item.branch,
      }));

      // Add summary row
      exportData.push({
        "Member Name": "SUMMARY",
        "Member Number": "",
        Date: `Total Payments: ${filteredData.length}`,
        Amount: filteredData.reduce((sum, item) => sum + item.amount, 0),
        Channel: "",
        Reference: "",
        "Loan ID": "",
        Officer: "",
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Written Off Repayments");
      const fileName = `written-off-repayments-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(data?.repayments || [])}
        disableExport={!data?.repayments?.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
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
            {filterOfficers.map((officer) => (
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 bg-card shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Total Repayments</p>
          <p className="text-2xl font-bold">{data?.summary?.totalRepayments || 0}</p>
        </div>
        <div className="rounded-lg border p-4 bg-card shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Total Amount Received</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(data?.summary?.totalAmount || 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <DataTable
          title="Repayment Details"
          subtitle="List of all payments made towards written off loans"
          data={data?.repayments || []}
          columns={columns}
          keyField="repaymentId"
          isLoading={loading}
          onRefresh={fetchData}
          actions={{
            onExport: handleExport,
          }}
          filters={{
            searchFields: ["memberName", "memberNumber", "loanId", "reference"],
            enableDateFilter: true,
          }}
        />
      </div>
    </div>
  );
}
