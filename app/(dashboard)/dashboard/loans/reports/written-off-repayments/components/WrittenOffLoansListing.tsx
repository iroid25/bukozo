"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface WrittenOffListingProps {
  title: string;
  subtitle: string;
  data: any;
  branchId: string;
  role: string;
}

export default function WrittenOffListing({
  title,
  subtitle,
  data,
  branchId,
  role,
}: WrittenOffListingProps) {
  const columns: Column<any>[] = [
    { header: "Loan ID", accessorKey: "loanId" },
    { header: "Member Name", accessorKey: "memberName" },
    { header: "Member Number", accessorKey: "memberNumber" },
    { header: "Member Phone", accessorKey: "memberPhone" },
    { header: "Loan Product", accessorKey: "loanProduct" },
    { header: "Principal Amount", accessorKey: "principalAmountFormatted" },
    { header: "Written Off Amount", accessorKey: "writtenOffAmountFormatted" },
    { header: "Disbursement Date", accessorKey: "disbursementDateFormatted" },
    { header: "Write-off Date", accessorKey: "writeOffDateFormatted" },
    { header: "Reason", accessorKey: "reason" },
    { header: "Loan Officer", accessorKey: "loanOfficer" },
    { header: "Branch", accessorKey: "branch" },
  ];

  // ✅ Add safety check for data
  const loans = data?.loans || [];
  const summary = data?.summary || {
    totalWrittenOffLoans: 0,
    totalPrincipalAmount: 0,
    totalWrittenOffAmount: 0,
    averageWriteOffAmount: 0,
  };

  // Format the data
  const formattedData = loans.map((item: any) => ({
    ...item,
    principalAmountFormatted: formatCurrency(item.principalAmount || 0),
    writtenOffAmountFormatted: formatCurrency(item.writtenOffAmount || 0),
    disbursementDateFormatted: item.disbursementDate
      ? format(new Date(item.disbursementDate), "dd/MM/yyyy")
      : "N/A",
    writeOffDateFormatted: item.writeOffDate
      ? format(new Date(item.writeOffDate), "dd/MM/yyyy")
      : "N/A",
  }));

  const handleExport = () => {
    try {
      if (!loans.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = loans.map((item: any) => ({
        "Loan ID": item.loanId,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Member Phone": item.memberPhone,
        "Loan Product": item.loanProduct,
        "Principal Amount": item.principalAmount,
        "Written Off Amount": item.writtenOffAmount,
        "Disbursement Date": item.disbursementDate
          ? format(new Date(item.disbursementDate), "dd/MM/yyyy")
          : "N/A",
        "Write-off Date": item.writeOffDate
          ? format(new Date(item.writeOffDate), "dd/MM/yyyy")
          : "N/A",
        Reason: item.reason,
        "Loan Officer": item.loanOfficer,
        Branch: item.branch,
      }));

      // Add summary row
      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        "Loan Product": "",
        "Principal Amount": summary.totalPrincipalAmount,
        "Written Off Amount": summary.totalWrittenOffAmount,
        "Disbursement Date": "",
        "Write-off Date": "",
        Reason: "",
        "Loan Officer": `Total Loans: ${summary.totalWrittenOffLoans}`,
        Branch: `Avg: ${summary.averageWriteOffAmount}`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Written Off Loans");
      XLSX.writeFile(wb, `written-off-loans-${formatISODate(new Date())}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!loans.length}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Total Written Off Loans
          </p>
          <p className="text-2xl font-bold">{summary.totalWrittenOffLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Total Principal Amount
          </p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalPrincipalAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Written Off</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalWrittenOffAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Average Write-off</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.averageWriteOffAmount)}
          </p>
        </div>
      </div>

      <DataTable
        title=""
        subtitle=""
        data={formattedData}
        columns={columns}
        keyField="loanId"
      />
    </div>
  );
}
