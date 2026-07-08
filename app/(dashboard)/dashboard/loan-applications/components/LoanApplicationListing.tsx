"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Download,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Users,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Building2,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoanApplicationCreateFormWithTabs from "./LoanApplicationCreateFormWithTabs";
import LoanApplicationDetailsDialog from "./LoanApplicationDetailsDialog";

interface LoanApplication {
  id: string;
  memberId: string;
  memberName?: string;
  memberNumber?: string;
  loanProductId: string;
  loanProduct?: {
    id: string;
    name: string;
    interestRate: number;
    maxAmount: number;
  };
  amountApplied: number;
  amountApproved?: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISBURSED";
  applicationDate: Date;
  approvedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  approvedBy?: string;
  repaymentPeriodMonths?: number;
  monthlyRepayment?: number;
  totalRepayment?: number;
  applicationType?: "MEMBER" | "INSTITUTION";
  organizationName?: string;
  modeOfRepayment?: string;
}

interface Statistics {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalAmountApplied: number;
  totalAmountApproved: number;
  averageApprovalTime?: number;
}

interface LoanApplicationListingProps {
  title: string;
  subtitle: string;
  loanApplications: LoanApplication[];
  statistics: Statistics;
  loanProducts: any[];
  userRole: string;
  currentUserId: string;
}

export default function LoanApplicationListing({
  title,
  subtitle,
  loanApplications,
  statistics,
  loanProducts,
  userRole,
  currentUserId,
}: LoanApplicationListingProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter applications based on search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return loanApplications;

    const query = searchQuery.toLowerCase();
    return loanApplications.filter((app) => {
      const searchableText = [
        app.id,
        app.memberName,
        app.memberNumber,
        app.organizationName,
        app.loanProduct?.name,
        app.status,
        app.purpose,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [loanApplications, searchQuery]);

  // Format currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: {
        variant: "default" as const,
        icon: Clock,
        color: "text-yellow-600",
      },
      APPROVED: {
        variant: "default" as const,
        icon: CheckCircle,
        color: "text-green-600",
      },
      REJECTED: {
        variant: "destructive" as const,
        icon: XCircle,
        color: "text-red-600",
      },
      DISBURSED: {
        variant: "default" as const,
        icon: DollarSign,
        color: "text-blue-600",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status}
      </Badge>
    );
  };

  // Get application type badge
  const getApplicationTypeBadge = (type?: string) => {
    if (type === "INSTITUTION") {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Building2 className="h-3 w-3 text-purple-600" />
          Institution
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Users className="h-3 w-3 text-blue-600" />
        Member
      </Badge>
    );
  };

  // Handle view application
  const handleViewApplication = (application: LoanApplication) => {
    setSelectedApplication(application);
    setIsDetailsDialogOpen(true);
  };

  const handleEditApplication = (application: LoanApplication) => {
    toast.info("Edit functionality coming soon");
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return;

    try {
      const res = await fetch(`/api/v1/loans/applications/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Application deleted successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete application");
    }
  };

  const handleApproveApplication = async (id: string, amountApplied?: number) => {
    try {
      const res = await fetch(`/api/v1/loans/applications/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", amountGranted: amountApplied }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      toast.success("Application approved successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve application");
    }
  };

  const handleRejectApplication = async (id: string, reason?: string) => {
    const rejectionReason = reason ?? prompt("Enter rejection reason:");
    if (!rejectionReason) return;

    try {
      const res = await fetch(`/api/v1/loans/applications/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");
      toast.success("Application rejected successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject application");
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    const exportData = loanApplications.map((app) => ({
      "Application ID": app.id,
      "Member/Organization":
        app.applicationType === "INSTITUTION"
          ? app.organizationName
          : app.memberName || app.memberNumber,
      "Application Type": app.applicationType || "MEMBER",
      "Loan Product": app.loanProduct?.name || "N/A",
      "Amount Applied": app.amountApplied,
      "Amount Approved": app.amountApproved || 0,
      Purpose: app.purpose,
      Status: app.status,
      "Application Date": format(new Date(app.applicationDate), "dd/MM/yyyy"),
      "Approved Date": app.approvedDate
        ? format(new Date(app.approvedDate), "dd/MM/yyyy")
        : "N/A",
      "Repayment Period (Months)": app.repaymentPeriodMonths || "N/A",
      "Monthly Repayment": app.monthlyRepayment || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loan Applications");
    XLSX.writeFile(
      wb,
      `loan-applications-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
    toast.success("Exported successfully");
  };

  // Table columns - FIXED TYPING
  const columns: Column<LoanApplication>[] = [
    {
      header: "Application",
      accessorKey: "id",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-medium">
            {row.applicationType === "INSTITUTION"
              ? row.organizationName
              : row.memberName || row.memberNumber}
          </div>
          <div className="text-xs text-gray-500">ID: {row.id.slice(0, 8)}</div>
          {getApplicationTypeBadge(row.applicationType)}
        </div>
      ),
    },
    {
      header: "Loan Product",
      // Use function accessor for nested properties
      accessorKey: (row: LoanApplication) => row.loanProduct?.name || "N/A",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-medium">{row.loanProduct?.name || "N/A"}</div>
          {row.loanProduct?.interestRate && (
            <div className="text-xs text-gray-500">
              Rate: {row.loanProduct.interestRate}%
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amountApplied",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-semibold text-green-600">
            {fmt(row.amountApplied)}
          </div>
          {row.amountApproved && (
            <div className="text-xs text-gray-500">
              Approved: {fmt(row.amountApproved)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: LoanApplication) => getStatusBadge(row.status),
    },
    {
      header: "Application Date",
      accessorKey: "applicationDate",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div>{format(new Date(row.applicationDate), "dd MMM yyyy")}</div>
          <div className="text-xs text-gray-500">
            {format(new Date(row.applicationDate), "HH:mm")}
          </div>
        </div>
      ),
    },
    {
      header: "Repayment",
      accessorKey: "repaymentPeriodMonths",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          {row.repaymentPeriodMonths && (
            <div className="text-sm font-medium">{row.repaymentPeriodMonths} months</div>
          )}
          {row.modeOfRepayment && (
            <div className="text-xs text-blue-600">
              {
                {
                  BI_WEEKLY: "Bi-weekly",
                  MONTHLY: "Monthly",
                  EVERY_TWO_MONTHS: "Every Two Months",
                  QUARTERLY: "Quarterly",
                  HALF_YEAR: "Half a Year",
                }[row.modeOfRepayment] || row.modeOfRepayment
              }
            </div>
          )}
          {row.monthlyRepayment && (
            <div className="text-xs text-gray-500">
              Monthly: {fmt(row.monthlyRepayment)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: LoanApplication) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleViewApplication(row)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>

            {row.status === "PENDING" &&
              (userRole === "ADMIN" || userRole === "MANAGER") && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleApproveApplication(row.id, row.amountApplied)}
                    className="text-green-600"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRejectApplication(row.id)}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}

            {row.status === "PENDING" && (
              <DropdownMenuItem onClick={() => handleEditApplication(row)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteApplication(row.id)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Statistics cards
  const statsCards = [
    {
      title: "Total Applications",
      value: statistics.totalApplications,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Pending",
      value: statistics.pendingApplications,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Approved",
      value: statistics.approvedApplications,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Rejected",
      value: statistics.rejectedApplications,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Amount Applied",
      value: fmt(statistics.totalAmountApplied),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      isAmount: true,
    },
    {
      title: "Amount Approved",
      value: fmt(statistics.totalAmountApproved),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      isAmount: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.isAmount ? stat.value : stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Applications</CardTitle>
              <CardDescription>
                View and manage all member and institution loan applications
              </CardDescription>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, ID, product, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<LoanApplication>
            title="Applications List"
            columns={columns}
            data={filteredApplications}
            keyField="id"
          />
          {filteredApplications.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No applications found
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your search terms
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog with Tabs */}
      <LoanApplicationCreateFormWithTabs
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        currentUserId={currentUserId}
        loanProducts={loanProducts}
      />

      {/* Details Dialog */}
      {selectedApplication && (
        <LoanApplicationDetailsDialog
          isOpen={isDetailsDialogOpen}
          onClose={() => {
            setIsDetailsDialogOpen(false);
            setSelectedApplication(null);
          }}
          application={selectedApplication}
          onApprove={handleApproveApplication}
          onReject={handleRejectApplication}
          userRole={userRole}
        />
      )}
    </div>
  );
}
