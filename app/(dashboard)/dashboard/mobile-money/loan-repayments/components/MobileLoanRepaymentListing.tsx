"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Repeat,
  User,
  DollarSign,
  Phone,
  Calendar,
  Smartphone,
  Plus,
  CreditCard,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import {
  MobileMoneyLoanRepayment,
  MobileMoneyStatistics,
  getLoanRepaymentOwnerEmail,
  getLoanRepaymentOwnerPhone,
} from "@/types/mobileMoney";
import MobileLoanRepaymentCreateForm from "./MobileLoanRepaymentCreateForm";

export default function MobileLoanRepaymentListing({
  repayments,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  repayments: MobileMoneyLoanRepayment[];
  title: string;
  subtitle: string;
  statistics: MobileMoneyStatistics;
  userRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<MobileMoneyLoanRepayment>[] = [
    {
      accessorKey: "repaymentDate",
      header: "Repayment Details",
      cell: (row) => {
        const repayment = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">Loan Repayment</span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Mobile Money
                </Badge>
              </div>
              <span className="text-sm text-gray-500">
                {formatISODate(repayment.repaymentDate)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "member",
      header: "Member Info",
      cell: (row) => {
        const repayment = row;
        const member = repayment.member;
        const user = member.user;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>#{member.memberNumber}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "loan",
      header: "Loan Details",
      cell: (row) => {
        const repayment = row;
        const loan = repayment.loan;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {loan.loanApplication.loanProduct.name}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Loan Amount: {formatCurrency(loan.amountGranted)}
            </div>
            <div className="text-sm text-gray-500">
              Outstanding: {formatCurrency(loan.outstandingBalance)}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Repayment Amount",
      cell: (row) => {
        const repayment = row;

        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-600" />
            <div className="flex flex-col">
              <span className="font-medium text-purple-700 text-lg">
                {formatCurrency(repayment.amount)}
              </span>
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {repayment.mobileMoneyRef || "N/A"}
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  const handleAddNew = () => {
    setModalOpen(true);
  };

  // Export to Excel
  const handleExport = async (
    filteredRepayments: MobileMoneyLoanRepayment[]
  ) => {
    try {
      // Prepare data for export
      const exportData = filteredRepayments.map((repayment) => ({
        "Member Name": repayment.member.user.name,
        "Member Number": repayment.member.memberNumber,
        "Loan Product": repayment.loan.loanApplication.loanProduct.name,
        "Loan Amount": repayment.loan.amountGranted,
        "Outstanding Balance": repayment.loan.outstandingBalance,
        "Repayment Amount": repayment.amount,
        "Mobile Money Ref": repayment.mobileMoneyRef || "N/A",
        "Processed By": repayment.handler.name,
        "Handler Role": repayment.handler.role,
        "Repayment Date": formatISODate(repayment.repaymentDate),
        "Member Email": getLoanRepaymentOwnerEmail(repayment) || "N/A",
        "Member Phone": getLoanRepaymentOwnerPhone(repayment) || "N/A",
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Mobile Loan Repayments"
      );

      // Generate filename with current date
      const fileName = `Mobile_Loan_Repayments_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Mobile loan repayments exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Mobile Repayments
            </CardTitle>
            <Smartphone className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(statistics.today.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.today.count} repayments today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(statistics.thisMonth.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.thisMonth.count} repayments this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Mobile Repayments
            </CardTitle>
            <Repeat className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.total.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.total.count} total repayments
            </p>
          </CardContent>
        </Card>
      </div>

      <MobileLoanRepaymentCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
      />

      <DataTable<MobileMoneyLoanRepayment>
        title={title}
        subtitle={subtitle}
        data={repayments}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: ["ADMIN", "MANAGER", "TELLER"].includes(userRole)
            ? handleAddNew
            : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "member.user.name",
            "member.memberNumber",
            "loan.loanApplication.loanProduct.name",
            "mobileMoneyRef",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.repaymentDate,
        }}
      />
    </div>
  );
}
