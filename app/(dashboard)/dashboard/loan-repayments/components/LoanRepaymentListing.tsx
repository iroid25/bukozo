// FILE: app/dashboard/loan-repayments/components/LoanRepaymentListing.tsx
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  DollarSign,
  User,
  CreditCard,
  Calendar,
  TrendingDown,
  Wallet,
  Plus,
  Send,
  Printer,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import LoanRepaymentCreateForm from "./LoanRepaymentCreateForm";
type LoanRepaymentWithDetails = any;
type LoanRepaymentStatistics = any;

export default function LoanRepaymentListing({
  loanRepayments,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  loanRepayments: LoanRepaymentWithDetails[];
  title: string;
  subtitle: string;
  statistics: LoanRepaymentStatistics;
  userRole: any;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  // Permission check - AGENT can create repayments
  const canCreateRepayment = [
    "ADMIN",
    "BRANCHMANAGER",
    "TELLER",
    "LOANOFFICER",
    "AGENT",
    "ACCOUNTANT",
  ].includes(userRole);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get channel badge color
  const getChannelColor = (channel: string) => {
    const colors: { [key: string]: string } = {
      "Mobile Money": "bg-purple-100 text-purple-800",
      Cash: "bg-green-100 text-green-800",
      "Bank Transfer": "bg-blue-100 text-blue-800",
      Cheque: "bg-orange-100 text-orange-800",
    };
    return colors[channel] || "bg-gray-100 text-gray-800";
  };

  const columns: Column<LoanRepaymentWithDetails>[] = [
    {
      accessorKey: "id",
      header: "Repayment Details",
      cell: (row) => {
        const repayment = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">#{repayment.id.slice(0, 8)}</span>
                <Badge className={getChannelColor(repayment.channel)}>
                  {repayment.channel}
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
      accessorKey: "memberId",
      header: "Member Info",
      cell: (row) => {
        const repayment = row;
        const member = repayment.loan.member;
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
              <span className="text-sm text-gray-500">
                #{member.memberNumber}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "loanId",
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
            <span className="text-sm text-gray-500">
              Outstanding: {formatCurrency(loan.outstandingBalance)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const repayment = row;

        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 text-lg">
              {formatCurrency(repayment.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "handlerUserId",
      header: "Processed By",
      cell: (row) => {
        const repayment = row;
        const handler = repayment.handler;

        return (
          <div className="flex flex-col">
            <span className="font-medium">{handler.name}</span>
            <Badge variant="outline" className="text-xs w-fit">
              {handler.role}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "repaymentDate",
      header: "Actions",
      cell: (row) => {
        const repayment = row;

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/loan-repayments/${repayment.id}`)
              }
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {repayment.transactionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/v1/transactions/${repayment.transactionId}/receipt`, '_blank')}
                className="bg-green-50 hover:bg-green-100 border-green-200"
              >
                <Printer className="h-4 w-4 mr-1" />
                Receipt
              </Button>
            )}
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
    filteredRepayments: LoanRepaymentWithDetails[]
  ) => {
    try {
      const exportData = filteredRepayments.map((repayment) => ({
        "Repayment ID": repayment.id,
        "Member Name": repayment.loan.member.user.name,
        "Member Number": repayment.loan.member.memberNumber,
        "Loan Product": repayment.loan.loanApplication.loanProduct.name,
        Amount: repayment.amount,
        Channel: repayment.channel,
        "Mobile Money Ref": repayment.mobileMoneyRef || "N/A",
        "Outstanding Balance": repayment.loan.outstandingBalance,
        "Loan Status": repayment.loan.status,
        Branch: repayment.loan.branch?.name || "N/A",
        "Processed By": repayment.handler.name,
        "Handler Role": repayment.handler.role,
        "Repayment Date": formatISODate(repayment.repaymentDate),
        "Member Email": repayment.loan.member.user.email,
        "Member Phone": repayment.loan.member.user.phone || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Loan Repayments");

      const fileName = `Loan_Repayments_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Loan repayments exported to ${fileName}`,
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
              {userRole === "AGENT"
                ? "My Today's Repayments"
                : "Today's Repayments"}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics?.todayAmount || 0)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics?.todayRepayments || 0} payments today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === "AGENT" ? "My This Month" : "This Month"}
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(
                statistics?.thisMonthAmount || statistics?.totalAmount || 0
              )}
            </div>
            <p className="text-xs text-gray-500">
              {statistics?.thisMonthRepayments || 0} payments this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === "AGENT"
                ? "My Total Repayments"
                : "Total Repayments"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(statistics?.totalAmount || 0)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics?.totalRepayments || 0} total payments
            </p>
          </CardContent>
        </Card>
      </div>

      <LoanRepaymentCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
        userRole={userRole}
      />

      {/* AGENT sees only buttons and title */}
      {userRole === "AGENT" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-gray-500">{subtitle}</p>
            </div>
            <div className="flex gap-2">
              {["LOANOFFICER", "ADMIN", "BRANCHMANAGER"].includes(userRole) && (
                <Link href="/dashboard/loan-repayments/initiate">
                  <Button variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Initiate from Account
                  </Button>
                </Link>
              )}
              {["TELLER", "ADMIN", "BRANCHMANAGER", "AGENT"].includes(userRole) && (
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Process Repayment
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  Use the buttons above to process loan repayments
                </p>
                <p className="text-sm mt-2">
                  Choose "Initiate from Account" for member approval or "Process
                  Repayment" for direct payment
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Custom Header with Both Buttons */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
            {canCreateRepayment && (
              <div className="flex gap-2">
                {["LOANOFFICER", "ADMIN", "BRANCHMANAGER"].includes(userRole) && (
                  <Link href="/dashboard/loan-repayments/initiate">
                    <Button variant="outline">
                      <Send className="h-4 w-4 mr-2" />
                      Initiate from Account
                    </Button>
                  </Link>
                )}
                {["TELLER", "ADMIN", "BRANCHMANAGER", "AGENT"].includes(userRole) && (
                  <Button onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Process Repayment
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* DataTable */}
          <DataTable<LoanRepaymentWithDetails>
            title=""
            subtitle=""
            data={loanRepayments}
            columns={columns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: [
                "id",
                "loan.member.user.name",
                "loan.member.memberNumber",
                "loan.loanApplication.loanProduct.name",
                "mobileMoneyRef",
                "handler.name",
                "loan.institution.institutionName",
              ],
              enableDateFilter: true,
              getItemDate: (item) => item.repaymentDate,
            }}
            renderRowActions={(item) => <TableActions.RowActions />}
          />
        </>
      )}
    </div>
  );
}
