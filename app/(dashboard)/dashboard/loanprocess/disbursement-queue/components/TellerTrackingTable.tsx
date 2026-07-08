"use client";

import { Column, DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import DisburseLoanForm from "@/app/(dashboard)/dashboard/teller/loans-to-disburse/components/DisburseLoanForm";

interface TellerTrackingTableProps {
  loans: any[];
  currentReserve: number;
}

export default function TellerTrackingTable({ loans, currentReserve }: TellerTrackingTableProps) {
  const columns: Column<any>[] = [
    {
      header: "Member",
      accessorKey: "member.user.name",
      cell: (row: any) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.member?.user?.name || "Unknown member"}</span>
            {row.isInstitution && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 border-blue-200">
                Institution
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            #{row.member?.memberNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Loan Product",
      accessorKey: "loanApplication.loanProduct.name",
      cell: (row) => (
        <Badge variant="outline">{row.loanApplication?.loanProduct?.name || "Loan"}</Badge>
      ),
    },
    {
      header: "Approved Amount",
      accessorKey: "amountGranted",
      cell: (row) => (
        <span className="font-bold text-green-600">
          {formatCurrency(row.amountGranted)}
        </span>
      ),
    },
    {
      header: "Approval Date",
      accessorKey: "loanApplication.approvalDate",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
           {row.loanApplication?.approvalDate ? format(new Date(row.loanApplication.approvalDate), "PPP") : "N/A"}
        </span>
      ),
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: (row) => (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
            {row.status}
          </Badge>
        ),
      },
    {
      header: "Action",
      accessorKey: "id",
      cell: (row) => (
        <div className="flex items-center gap-2">
           {/* DisburseLoanForm expects 'loan' prop */}
           <DisburseLoanForm loan={row} currentReserve={currentReserve} />
        </div>
      ),
    },
  ];

    return (
    <DataTable
      title="Disbursement Queue"
      subtitle="Complete pending disbursements assigned for processing"
      data={loans}
      columns={columns}
      keyField="id"
      filters={{
        searchFields: ["member.user.name", "loanApplication.loanProduct.name", "status"] as string[]
      }}
    />
  );
}
