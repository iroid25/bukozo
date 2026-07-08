// app/dashboard/expenditure/components/ExpenditureListings.tsx
"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Plus,
  DollarSign,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";

import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ExpenditureRecordForm from "../new/ExpenditureRecordForm";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface ExpenditureRecord {
  id: string;
  amount: number;
  recordDate: string | Date;
  payee: string | null;
  paymentMethod: string;
  status: string;
  category?: {
    id: string;
    name: string;
    code: string | null;
    parentId: string | null;
  } | null;
  budgetCategory?: {
    id: string;
    name: string;
    code: string | null;
    parentId: string | null;
  } | null;
  branch?: {
    id: string;
    name: string;
    location: string;
  } | null;
  submittedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  approvedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  period?: {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
  } | null;
  approvedAt?: string | Date | null;
  description?: string | null;
  voucherNo?: string | null;
}

interface Statistics {
  totalExpenditure: number;
  todayExpenditure: number;
  thisMonthExpenditure: number;
  pendingExpenditure: number;
  pendingCount: number;
  totalRecords: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    amount: number;
  }>;
  branchBreakdown: Array<{
    branchId: string | null;
    branchName: string;
    count: number;
    amount: number;
  }>;
}

interface ExpenditureListingProps {
  title: string;
  subtitle: string;
  expenditureRecords: ExpenditureRecord[];
  statistics: Statistics;
  userRole: string;
  userId: string;
  userBranchId?: string;
  categories: Category[];
  branches: Branch[];
}

export function ExpenditureListing({
  title,
  subtitle,
  expenditureRecords,
  statistics,
  userRole,
  userId,
  userBranchId,
  categories,
  branches,
}: ExpenditureListingProps) {
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<ExpenditureRecord | null>(null);
  const router = useRouter();

  const handleViewDetails = (record: ExpenditureRecord) => {
    router.push(`/dashboard/accounts/expenditures/${record.id}`);
  };

  const handleEdit = (record: ExpenditureRecord) => {
    setEditData(record);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditData(null);
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/expenditure/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error("Failed to approve expenditure", {
          description: result.error || "Unknown error",
        });
      } else {
        toast.success("Expenditure approved successfully!");
        router.refresh();
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const response = await fetch(`/api/v1/expenditure/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FAILED", rejectionReason: reason }),
      });
      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error("Failed to reject expenditure", {
          description: result.error || "Unknown error",
        });
      } else {
        toast.success("Expenditure rejected!");
        router.refresh();
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: "bg-green-100 text-green-800",
          label: "Approved",
        };
      case "PENDING":
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-yellow-100 text-yellow-800",
          label: "Pending",
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-100 text-red-800",
          label: "Rejected",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-gray-100 text-gray-800",
          label: status,
        };
    }
  };

  // Helper function to get parent category name
  const getParentCategoryName = (categoryId: string): string => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category || !category.parentId) return "";

    const parentCategory = categories.find((c) => c.id === category.parentId);
    return parentCategory?.name || "";
  };

  const columns: Column<ExpenditureRecord>[] = [
    {
      header: "Date",
      accessorKey: "recordDate",
      cell: (row: ExpenditureRecord) => {
        const date = row.recordDate;
        return (
          <div className="font-medium">
            {new Date(date).toLocaleDateString("en-UG", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        );
      },
    },
    {
      header: "Category",
      accessorKey: "category",
      cell: (row: ExpenditureRecord) => {
        const category = row.budgetCategory || row.category;

        if (!category) {
          return <span className="text-muted-foreground">—</span>;
        }

        // If this category has a parent, we need to show the parent's name
        if (category.parentId) {
          const parentName = getParentCategoryName(category.id);
          return (
            <div>
              <div className="font-medium">{parentName}</div>
              <div className="text-xs text-muted-foreground">
                Account Group
              </div>
            </div>
          );
        }

        // If no parent, this is already a parent category
        return (
          <div>
            <div className="font-medium">{category.name}</div>
            {category.code && (
              <div className="text-xs text-muted-foreground">
                {category.code}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "Item",
      accessorKey: "category",
      cell: (row: ExpenditureRecord) => {
        const category = row.budgetCategory || row.category;
        
        if (!category) return <span className="text-muted-foreground">—</span>;

        // If the category has a parentId, it means this category IS the item/subcategory
        if (category.parentId) {
          return (
            <div>
              <div className="font-medium text-sm">{category.name}</div>
              {category.code && (
                <div className="text-xs text-muted-foreground">
                  {category.code}
                </div>
              )}
            </div>
          );
        }
        // If no parentId, this is a parent category with no item selected
        return <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: (row: ExpenditureRecord) => {
        const amount =
          typeof row.amount === "number"
            ? row.amount
            : parseFloat(String(row.amount));
        const formatted = new Intl.NumberFormat("en-UG", {
          style: "currency",
          currency: "UGX",
          minimumFractionDigits: 0,
        }).format(amount);
        return <div className="font-semibold text-red-600">{formatted}</div>;
      },
    },
    {
      header: "Payee",
      accessorKey: "payee",
      cell: (row: ExpenditureRecord) => {
        const payee = row.payee;
        if (!payee) {
          return <span className="text-muted-foreground">—</span>;
        }
        return <div className="font-medium">{payee}</div>;
      },
    },
    {
      header: "Method",
      accessorKey: "paymentMethod",
      cell: (row: ExpenditureRecord) => {
        const method = row.paymentMethod;
        const methodLabel =
          method === "CASH"
            ? "Cash"
            : method === "BANK"
              ? "Bank"
              : method === "MOBILE_MONEY"
                ? "Mobile Money"
                : method;
        return (
          <Badge variant="outline" className="text-xs">
            {methodLabel}
          </Badge>
        );
      },
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row: ExpenditureRecord) => {
        const branch = row.branch;
        if (!branch) {
          return <span className="text-muted-foreground">—</span>;
        }
        return <div className="text-sm font-medium">{branch.name}</div>;
      },
    },
    {
      header: "Submitted By",
      accessorKey: "submittedBy",
      cell: (row: ExpenditureRecord) => {
        const user = row.submittedBy;
        if (!user) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{user.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{user.role}</span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: ExpenditureRecord) => {
        const statusInfo = getStatusInfo(row.status);
        return (
          <Badge
            className={`${statusInfo.color} flex w-fit items-center gap-1`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: ExpenditureRecord) => {
        const canApprove =
          (userRole === "ADMIN" ||
            userRole === "ACCOUNTANT" ||
            userRole === "BRANCHMANAGER") &&
          row.status === "PENDING";

        return (
          <div className="flex items-center justify-end gap-2">
            {canApprove && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => handleApprove(row.id)}
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    const reason = prompt("Reason for rejection:");
                    if (reason) handleReject(row.id, reason);
                  }}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(row.id)}
                >
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleViewDetails(row)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {row.status === "PENDING" &&
                  (userRole === "ADMIN" ||
                    userRole === "ACCOUNTANT" ||
                    userRole === "BRANCHMANAGER") && (
                    <DropdownMenuItem onClick={() => handleEdit(row)}>
                      Edit Record
                    </DropdownMenuItem>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {Boolean(userRole) && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Record Expenditure
          </Button>
        )}
        {Boolean(userRole) && (
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard/settings/expenditure-categories")}
            className="ml-2 gap-2"
          >
            Manage Categories
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenditure
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-UG", {
                style: "currency",
                currency: "UGX",
                minimumFractionDigits: 0,
              }).format(statistics.totalExpenditure)}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics.totalRecords} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Expenditure
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-UG", {
                style: "currency",
                currency: "UGX",
                minimumFractionDigits: 0,
              }).format(statistics.todayExpenditure)}
            </div>
            <p className="text-xs text-muted-foreground">
              Today's transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-UG", {
                style: "currency",
                currency: "UGX",
                minimumFractionDigits: 0,
              }).format(statistics.thisMonthExpenditure)}
            </div>
            <p className="text-xs text-muted-foreground">Month to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-UG", {
                style: "currency",
                currency: "UGX",
                minimumFractionDigits: 0,
              }).format(statistics.pendingExpenditure)}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics.pendingCount} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable<ExpenditureRecord>
            title="Expenditure Records"
            subtitle="View and manage all expenditure transactions"
            columns={columns}
            data={expenditureRecords || []}
            keyField="id"
          />
        </CardContent>
      </Card>

      {/* Expenditure Form */}
      <ExpenditureRecordForm
        isOpen={showForm}
        onClose={handleCloseForm}
        categories={categories}
        branches={branches}
        userId={userId}
        userRole={userRole as any}
        userBranchId={userBranchId}
        editData={
          editData
            ? {
                id: editData.id,
                categoryId: editData.budgetCategory?.id ?? editData.category?.id ?? "",
                amount: editData.amount,
                recordDate:
                  typeof editData.recordDate === "string"
                    ? editData.recordDate
                    : editData.recordDate.toISOString().slice(0, 10),
                description: editData.description ?? "",
                payee: editData.payee ?? "",
                paymentMethod: editData.paymentMethod as any,
                branchId: editData.branch?.id,
                voucherNo: editData.voucherNo ?? "",
                externalRef: undefined,
              }
            : null
        }
        isEditMode={!!editData}
      />
    </div>
  );
}
