"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Column,
  ConfirmationDialog,
  DataTable,
  TableActions,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  Percent,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  CreditCard,
  Clock,
  TrendingUp,
} from "lucide-react";

import { LoanProduct, getRepaymentPeriodDisplay } from "@/types/loanProduct";

import { formatISODate } from "@/lib/utils";
// import {
//   deleteLoanProduct,
//   toggleLoanProductStatus,
// } from "@/actions/loanProduct";
import LoanProductCreateForm from "./LoanProductCreateForm";

export default function LoanProductListing({
  loanProducts,
  title,
  subtitle,
  userRole,
}: {
  loanProducts: LoanProduct[];
  title: string;
  subtitle: string;
  userRole: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<LoanProduct | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<LoanProduct>[] = [
    {
      accessorKey: "name",
      header: "Loan Product",
      cell: (row) => {
        const loanProduct = row;

        return (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                loanProduct.isActive
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{loanProduct.name}</span>
                {/* <Badge
                  variant={loanProduct.isActive ? "default" : "secondary"}
                  className={
                    loanProduct.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }
                >
                  {loanProduct.isActive ? "Active" : "Inactive"}
                </Badge> */}
              </div>
              <span className="text-sm text-gray-500">
                {loanProduct._count?.loanApplications || 0} applications
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "repaymentPeriodDays",
      header: "Loan Range",
      cell: (row) => {
        const loanProduct = row;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">Min:</span>
              <span className="font-medium">
                {formatCurrency(loanProduct.minAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">Max:</span>
              <span className="font-medium">
                {formatCurrency(loanProduct.maxAmount)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "interestRate",
      header: "Interest Rate",
      cell: (row) => {
        const loanProduct = row;
        return (
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-700">
              {loanProduct.interestRate}% {loanProduct.interestPeriod === "ANNUAL" ? "p.a." : "p.m."}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "repaymentPeriodDays",
      header: "Repayment Period",
      cell: (row) => {
        const loanProduct = row;
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="font-medium">
              {getRepaymentPeriodDisplay(loanProduct.repaymentPeriodDays)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: (row) => {
        const loanProduct = row;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={loanProduct.isActive}
              onCheckedChange={(checked) =>
                handleToggleStatus(loanProduct.id, checked)
              }
              disabled={userRole !== "ADMIN"}
            />
          </div>
        );
      },
    },
    // {
    //   accessorKey: "createdAt",
    //   header: "Date Created",
    //   cell: (row) => {
    //     const loanProduct = row;
    //     return (
    //       <div className="flex flex-col">
    //         <span className="font-medium">
    //           {formatISODate(loanProduct.createdAt)}
    //         </span>
    //         <span className="text-sm text-gray-500">
    //           Updated: {formatISODate(loanProduct.updatedAt)}
    //         </span>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const loanProduct = row;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/loan-products/${loanProduct.id}`)
            }
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        );
      },
    },
  ];

  const handleAddNew = () => {
    setModalOpen(true);
  };

  // Handle status toggle
  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/v1/loan-products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error("Failed to update status", {
          description: result.error || "Failed to update status",
        });
        // Revert change in UI if needed, but we rely on router.refresh() 
        // to re-fetch data. For better UX, we could use optimistic update.
      } else {
        toast.success(
          `Loan product ${isActive ? "activated" : "deactivated"} successfully`
        );
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update status", {
        description: "An unexpected error occurred",
      });
    }
  };

  // Export to Excel
  const handleExport = async (filteredLoanProducts: LoanProduct[]) => {
    try {
      // Prepare data for export
      const exportData = filteredLoanProducts.map((loanProduct) => ({
        ID: loanProduct.id,
        Name: loanProduct.name,
        "Minimum Amount": loanProduct.minAmount,
        "Maximum Amount": loanProduct.maxAmount,
        "Interest Rate (%)": loanProduct.interestRate,
        "Repayment Period": getRepaymentPeriodDisplay(
          loanProduct.repaymentPeriodDays
        ),
        "Repayment Days": loanProduct.repaymentPeriodDays,
        Description: loanProduct.description || "N/A",
        Status: loanProduct.isActive ? "Active" : "Inactive",
        "Total Applications": loanProduct._count?.loanApplications || 0,
        "Date Created": formatISODate(loanProduct.createdAt),
        "Last Updated": formatISODate(loanProduct.updatedAt),
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Loan Products");

      // Generate filename with current date
      const fileName = `Loan_Products_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Loan products exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Handle edit click
  const handleEditClick = (loanProduct: LoanProduct) => {
    router.push(`/dashboard/loan-products/${loanProduct.id}`);
  };

  // Handle delete click
  const handleDeleteClick = (loanProduct: LoanProduct) => {
    setDeleteItem(loanProduct);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/loan-products/${deleteItem.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
         const result = await response.json();
         toast.error("Delete failed", {
          description: result.error || "Delete failed",
        });
      } else {
        toast.success("Loan product deleted successfully");
        setDeleteDialogOpen(false);
        setDeleteItem(null);
        router.refresh();
      }
    } catch (error) {
      toast.error("Delete failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <LoanProductCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <DataTable<LoanProduct>
        title={title}
        subtitle={subtitle}
        data={loanProducts}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: userRole === "ADMIN" ? handleAddNew : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["name", "description"],
          enableDateFilter: true,
          getItemDate: (item) => item.createdAt,
        }}
        renderRowActions={(item) => (
          <TableActions.RowActions
            onEdit={
              userRole === "ADMIN" ? () => handleEditClick(item) : undefined
            }
            onDelete={
              userRole === "ADMIN" ? () => handleDeleteClick(item) : undefined
            }
          />
        )}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Loan Product"
        description={
          deleteItem ? (
            <>
              Are you sure you want to delete <strong>{deleteItem.name}</strong>
              ? This action cannot be undone and will fail if the loan product
              has associated loan applications.
            </>
          ) : (
            "Are you sure you want to delete this loan product?"
          )
        }
        onConfirm={handleConfirmDelete}
        isConfirming={isDeleting}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
