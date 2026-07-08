"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useSearchParams, useRouter } from "next/navigation";
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

import { useState, useEffect } from "react";

interface ApplicationsListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function ApplicationsListing({
  title,
  subtitle,
  initialRole,
}: ApplicationsListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [filterBranches, setFilterBranches] = useState<any[]>([]);
  const [filterProducts, setFilterProducts] = useState<any[]>([]);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/applications${queryString ? `?${queryString}` : ""}`, {
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

  // Fetch filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [officersRes, branchesRes] = await Promise.all([
          fetch("/api/v1/users?role=LOANOFFICER", { cache: "no-store" }),
          fetch("/api/v1/branches", { cache: "no-store" }),
        ]);
        const [officers, branches, products] = await Promise.all([
          officersRes.json(),
          branchesRes.json(),
          fetch("/api/v1/loans/products", { cache: "no-store" }).then((res) => res.json()),
        ]);
        if (officers.success) setFilterOfficers(officers.data);
        if (branches.success) setFilterBranches(branches.data);
        if (Array.isArray(products)) {
          setFilterProducts(products);
        } else if (products.success) {
          setFilterProducts(products.data);
        }
      } catch (error) {
        console.error("Error fetching filters:", error);
      }
    };
    fetchFilters();
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
    router.push(`?${params.toString()}`);
  };

  const columns: Column<any>[] = [
    {
      header: "Application ID",
      accessorKey: "applicationId",
      cell: (row: any) => (
        <span className="font-mono text-xs">{row.applicationId}</span>
      ),
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.memberName}</span>
          {row.memberNumber && (
            <span className="text-xs text-muted-foreground">
              {row.memberNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => (
        <span className="font-medium">{row.loanProduct}</span>
      ),
    },
    {
      header: "Branch",
      accessorKey: "branch",
    },
    {
      header: "Application Date",
      accessorKey: "applicationDate",
      cell: (row: any) => (
        <span className="text-sm">
          {row.applicationDate
            ? format(new Date(row.applicationDate), "dd/MM/yyyy")
            : "N/A"}
        </span>
      ),
    },
    {
      header: "Requested Amount",
      accessorKey: "amountApplied",
      cell: (row: any) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(row.amountApplied || 0)}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => {
        const statusColors: Record<string, string> = {
          PENDING: "bg-yellow-100 text-yellow-800",
          APPROVED: "bg-green-100 text-green-800",
          REJECTED: "bg-red-100 text-red-800",
          UNDER_REVIEW: "bg-blue-100 text-blue-800",
          DISBURSED: "bg-purple-100 text-purple-800",
        };
        return (
          <Badge className={`text-[10px] ${statusColors[row.status] || ""}`}>
            {row.status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      header: "Loan Officer",
      accessorKey: "loanOfficer",
      cell: (row: any) => (
        <span className="text-sm text-muted-foreground">
          {row.loanOfficer || "N/A"}
        </span>
      ),
    },
  ];

  // Safe access to data
  const applications = data?.applications || [];
  const summary = data?.summary || {
    totalApplications: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmountApplied: 0,
    totalAmountApproved: 0,
    approvalRate: 0,
  };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Application ID": item.applicationId,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber || "N/A",
        Product: item.loanProduct,
        Branch: item.branch,
        "Application Date": item.applicationDate
          ? format(new Date(item.applicationDate), "dd/MM/yyyy")
          : "N/A",
        "Requested Amount": item.amountApplied,
        Status: item.status,
        "Loan Officer": item.loanOfficer || "N/A",
      }));

      // Add summary row
      exportData.push({
        "Application ID": "SUMMARY",
        "Member Name": `Total Apps: ${filteredData.length}`,
        "Member Number": "",
        Product: "",
        Branch: "",
        "Application Date": "",
        "Requested Amount": summary.totalAmountApplied,
        Status: `Approved: ${summary.approved}`,
        "Loan Officer": "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Applications");
      const fileName = `loan-applications-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful");
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
        onExport={() => handleExport(applications)}
        disableExport={!applications.length}
      />

      {/* Filters */}
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
              {filterBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
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

        <Select
          value={searchParams.get("productId") || "all"}
          onValueChange={(v) => updateFilter("productId", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {filterProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(v) => updateFilter("status", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DISBURSED">Disbursed</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
          </SelectContent>
        </Select>

        {(searchParams.get("branchId") ||
          searchParams.get("officerId") ||
          searchParams.get("productId") ||
          searchParams.get("status")) && (
          <Button
            variant="ghost"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("branchId");
              params.delete("officerId");
              params.delete("productId");
              params.delete("status");
              router.push(`?${params.toString()}`);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Apps</p>
          <p className="text-xl font-bold">{summary.totalApplications}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Pending</p>
          <p className="text-xl font-bold text-orange-600">{summary.pending}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Approved</p>
          <p className="text-xl font-bold text-green-600">{summary.approved}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Rejected</p>
          <p className="text-xl font-bold text-red-600">{summary.rejected}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Applied</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(summary.totalAmountApplied)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Approved Amt</p>
          <p className="text-xl font-bold text-emerald-600">
            {formatCurrency(summary.totalAmountApproved)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Approval Rate</p>
          <p className="text-xl font-bold text-indigo-600">
            {Math.round(summary.approvalRate)}%
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <DataTable
          title="Application Details"
          subtitle={`Showing ${applications.length} loan applications`}
          data={applications}
          columns={columns}
          keyField="applicationId"
          isLoading={loading}
          onRefresh={fetchData}
          actions={{
            onExport: handleExport,
          }}
          filters={{
            enableDateFilter: true,
            getItemDate: (item) => item.applicationDate,
            searchFields: [
              "applicationId",
              "memberNumber",
              "loanProduct",
              "loanOfficer",
              "status",
              "branch",
            ],
          }}
        />
      </div>
    </div>
  );
}
