"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface WrittenOffLoan {
  loanId: string;
  memberName: string;
  memberNumber: string;
  memberPhone: string;
  loanProduct: string;
  principalAmount: number;
  totalAmountDue: number;
  amountPaid: number;
  writtenOffAmount: number;
  disbursementDate: Date;
  writeOffDate: Date;
  reason: string;
  loanOfficer: string;
  branch: string;
}

interface WrittenOffListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function WrittenOffLoansListing({
  title,
  subtitle,
  initialRole,
}: WrittenOffListingProps) {
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
      const url = `/api/v1/reports/loans/written-off${queryString ? `?${queryString}` : ""}`;
      console.log("[WrittenOff UI] Fetching from:", url);
      const response = await fetch(url, {
        cache: "no-store",
      });
      const result = await response.json();
      console.log("[WrittenOff UI] API response:", result);
      if (result.success) {
        setData(result.data);
        console.log("[WrittenOff UI] Data set:", result.data);
      } else {
        setError(result.error || "Failed to fetch data");
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("[WrittenOff UI] Fetch error:", error);
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

  const columns: Column<WrittenOffLoan>[] = [
    {
      header: "Loan ID",
      accessorKey: "loanId",
      cell: (row) => (
        <span className="font-mono text-xs">{row.loanId?.substring(0, 8) || "N/A"}</span>
      ),
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.memberName}</span>
          <span className="text-[10px] text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "memberPhone",
      cell: (row) => <span className="text-xs">{row.memberPhone}</span>,
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px]">
          {row.loanProduct}
        </Badge>
      ),
    },
    {
      header: "Disbursed",
      accessorKey: "principalAmount",
      cell: (row) => (
        <span className="text-xs">{formatCurrency(row.principalAmount)}</span>
      ),
    },
    {
      header: "Written Off",
      accessorKey: "writtenOffAmount",
      cell: (row) => (
        <span className="font-bold text-xs text-red-600">
          {formatCurrency(row.writtenOffAmount)}
        </span>
      ),
    },
    {
      header: "Reason",
      accessorKey: "reason",
      cell: (row) => (
        <span className="text-[10px] text-muted-foreground truncate max-w-[150px] inline-block">
          {row.reason}
        </span>
      ),
    },
    {
      header: "Officer",
      accessorKey: "loanOfficer",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.loanOfficer}</span>
      ),
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row) => <span className="text-xs">{row.branch}</span>,
    },
  ];

  const handleExport = async (filteredData: WrittenOffLoan[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item) => ({
        "Loan ID": item.loanId,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Member Phone": item.memberPhone,
        Product: item.loanProduct,
        Disbursed: item.principalAmount,
        "Written Off Amount": item.writtenOffAmount,
        Date: format(new Date(item.writeOffDate), "dd/MM/yyyy"),
        Reason: item.reason,
        Officer: item.loanOfficer,
        Branch: item.branch,
      }));

      // Add summary row
      const totalWrittenOff = filteredData.reduce((sum, item) => sum + item.writtenOffAmount, 0);
      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        Product: "",
        Disbursed: filteredData.reduce((sum, item) => sum + item.principalAmount, 0),
        "Written Off Amount": totalWrittenOff,
        Date: `Total Loans: ${filteredData.length}`,
        Reason: "",
        Officer: "",
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Written Off Loans");
      const fileName = `written-off-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Written off loans exported to ${fileName}`,
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
        onExport={() => handleExport(data?.loans || [])}
        disableExport={!data?.loans?.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-3 sm:p-4 bg-card shadow-sm">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Loans</p>
          <p className="text-xl font-bold sm:text-2xl">{data?.summary?.totalLoans || 0}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card shadow-sm">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Principal</p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPrincipal || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card shadow-sm">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Written Off</p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalAmountWrittenOff || 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Written Off Loans Details"
            subtitle="Historical record of written off debt"
            data={data?.loans || []}
            columns={columns}
            keyField="loanId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: ["memberName", "memberNumber", "loanProduct", "loanOfficer"],
              enableDateFilter: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
