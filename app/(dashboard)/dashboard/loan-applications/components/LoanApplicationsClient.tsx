// app/(dashboard)/dashboard/loan-applications/components/LoanApplicationsClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Eye,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Column, DataTable } from "@/components/ui/data-table";
import { Separator } from "@/components/ui/separator";

import LoanApplicationCreateFormWithTabs from "./LoanApplicationCreateFormWithTabs";
import LoanApplicationDetailsDialog from "./LoanApplicationDetailsDialog";

interface LoanApplication {
  id: string;
  applicationDate: Date;
  amountApplied: number;
  purpose: string | null;
  status: string;
  approvalDate: Date | null;
  rejectionReason: string | null;
  loanProduct: {
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number;
    interestRate: number;
    repaymentPeriodDays: number;
  };
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
    };
    account: {
      id: string;
      accountNumber: string;
      balance: number;
    } | null;
  };
  applicant: {
    id: string;
    name: string;
    role: string;
  } | null;
  approver: {
    id: string;
    name: string;
    role: string;
  } | null;
  loan: {
    id: string;
    amountGranted: number;
    totalAmountDue: number;
    outstandingBalance: number;
    disbursementDate: Date | null;
    dueDate: Date;
  } | null;
  applyLoanProcessingFee?: boolean;
  loanProcessingFeePercentage?: number | null;
  applyLoanInsurance?: boolean;
  loanInsurancePercentage?: number | null;
  applyShareDeduction?: boolean;
  shareAmount?: number | null;
  hasExistingLoanWithSacco?: boolean;
  existingLoanBalance?: number | null;
  loanOfficer?: {
    id: string;
    name: string;
    role?: string | null;
  } | null;
  allocatedTeller?: {
    id: string;
    name: string;
  } | null;
}

interface Statistics {
  pending: number;
  approved: number;
  rejected: number;
  disbursed: number;
  totalAmount: number;
}

interface LoanApplicationsClientProps {
  initialApplications: LoanApplication[];
  loanProducts: any[];
  statistics: Statistics;
  currentUserId: string;
  currentUserRole: string;
}

export default function LoanApplicationsClient({
  initialApplications,
  loanProducts,
  statistics,
  currentUserId,
  currentUserRole,
}: LoanApplicationsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch applications via API for real-time updates and caching
  const { data: applicationsData, isLoading: isAppsLoading } = useQuery({
    queryKey: ["loan-applications"],
    queryFn: async () => {
      const response = await axios.get("/api/v1/loans/applications?limit=100");
      return response.data.data as LoanApplication[];
    },
    initialData: initialApplications,
  });

  // Fetch statistics via API
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["loan-application-statistics"],
    queryFn: async () => {
      const response = await axios.get("/api/v1/loans/applications/statistics");
      return response.data as Statistics;
    },
    initialData: statistics,
  });

  // Use query data
  const applications = applicationsData || initialApplications;
  const currentStatistics = statsData || statistics;

  // Format currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: {
        variant: "secondary" as const,
        label: "Pending",
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
        icon: Clock,
      },
      APPROVED: {
        variant: "default" as const,
        label: "Approved",
        color: "text-green-600 bg-green-50 border-green-200",
        icon: CheckCircle,
      },
      REJECTED: {
        variant: "destructive" as const,
        label: "Rejected",
        color: "text-red-600 bg-red-50 border-red-200",
        icon: XCircle,
      },
      DISBURSED: {
        variant: "outline" as const,
        label: "Disbursed",
        color: "text-purple-600 bg-purple-50 border-purple-200",
        icon: DollarSign,
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "secondary" as const,
      label: status,
      color: "text-gray-600 bg-gray-50 border-gray-200",
      icon: FileText,
    };

    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Filter applications based on search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applications;

    const query = searchQuery.toLowerCase();
    return applications.filter(
      (app) =>
        app.id.toLowerCase().includes(query) ||
        app.member.user.name.toLowerCase().includes(query) ||
        app.member.memberNumber.toLowerCase().includes(query) ||
        app.loanProduct.name.toLowerCase().includes(query) ||
        app.status.toLowerCase().includes(query) ||
        app.purpose?.toLowerCase().includes(query)
    );
  }, [applications, searchQuery]);

  // Handle view details
  const handleViewDetails = (app: LoanApplication) => {
    setSelectedApplication(app);
    setShowDetailsDialog(true);
  };

  const handleApprove = (id: string) => {
    toast.info("Approval functionality is managed in the process tracking dashboard.");
  };

  const handleReject = (id: string) => {
    toast.info("Rejection functionality is managed in the process tracking dashboard.");
  };

  // Define table columns
  const columns: Column<LoanApplication>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: (row: LoanApplication & { isInstitution?: boolean }) => (
        <div className="flex flex-col">
          <span className="text-xs font-mono text-muted-foreground uppercase">
            {row.id.substring(0, 8)}
          </span>
          {row.isInstitution && (
            <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 mt-1 bg-blue-50 text-blue-700 border-blue-200">
              INSTITUTION
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "applicationDate",
      header: "Date",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {format(new Date(row.applicationDate), "MMM dd, yyyy")}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(row.applicationDate), "HH:mm")}
          </div>
        </div>
      ),
    },
    {
      accessorKey: (row: LoanApplication) => row.member.memberNumber,
      header: "Member / Institution",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-medium">{row.member.user.name}</div>
          <div className="text-xs text-gray-500">{row.member.memberNumber}</div>
        </div>
      ),
    },
    {
      accessorKey: (row: LoanApplication) => row.loanProduct.name,
      header: "Loan Product",
      cell: (row: LoanApplication) => (
        <div>
          <p className="font-medium">{row.loanProduct.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.loanProduct.interestRate}% interest
          </p>
        </div>
      ),
    },
    {
      accessorKey: (row: LoanApplication) => row.loanOfficer?.name || "Unassigned",
      header: "Loan Officer",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-medium">
            {row.loanOfficer?.name || "Unassigned"}
          </div>
          {row.loanOfficer?.role && (
            <div className="text-xs text-gray-500">
              {row.loanOfficer.role}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "amountApplied",
      header: "Amount",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-semibold text-green-600">
            {fmt(row.amountApplied)}
          </div>
          {row.loan && (
            <div className="text-xs text-gray-500">
              Granted: {fmt(row.loan.amountGranted)}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          {getStatusBadge(row.status)}
          {row.loanOfficer && (
            <div className="text-xs text-gray-500">
              By: {row.loanOfficer.name}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row: LoanApplication) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetails(row)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Applications
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStatistics.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStatistics.approved}</div>
            <p className="text-xs text-muted-foreground">
              Ready for disbursement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disbursed</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStatistics.disbursed}</div>
            <p className="text-xs text-muted-foreground">Active loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStatistics.rejected}</div>
            <p className="text-xs text-muted-foreground">
              Declined applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursed
            </CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(currentStatistics.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Loan Applications</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Application
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredApplications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                No applications found
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Get started by creating a new loan application"}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <DataTable<LoanApplication>
              title="Applications List"
              columns={columns}
              data={filteredApplications}
              keyField="id"
            />
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedApplication && (
        <LoanApplicationDetailsDialog
          isOpen={showDetailsDialog}
          onClose={() => setShowDetailsDialog(false)}
          application={selectedApplication as any}
          onApprove={handleApprove}
          onReject={handleReject}
          userRole={currentUserRole}
        />
      )}

      {/* Create Application Dialog */}
      <LoanApplicationCreateFormWithTabs
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        currentUserId={currentUserId}
        loanProducts={loanProducts}
      />
    </>
  );
}
