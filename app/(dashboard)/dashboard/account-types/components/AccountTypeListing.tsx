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
import {
  Eye,
  Percent,
  DollarSign,
  CreditCard,
  CheckCircle,
  XCircle,
  Wallet,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import { AccountType, getAccountTypeDisplayName } from "@/types/accountTypes";
import AccountTypeCreateForm from "./AccountTypeCreateForm";

export default function AccountTypeListing({
  accountTypes,
  title,
  subtitle,
  userRole,
  exportFilePrefix = "Account_Types",
  createDefaults,
}: {
  accountTypes: AccountType[];
  title: string;
  subtitle: string;
  userRole: string;
  exportFilePrefix?: string;
  createDefaults?: Partial<AccountType>;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<AccountType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // small helper to ensure we always hand a Date to any date consumer
  const asDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const columns: Column<AccountType>[] = [
    {
      accessorKey: "name",
      header: "Account Type",
      cell: (row) => {
        const accountType = row;
        const getTypeIcon = () => {
          if (
            accountType.name.toLowerCase().includes("insurance") ||
            accountType.ledgerAccount?.accountCode === "200600"
          ) {
            return <ShieldCheck className="h-5 w-5 text-purple-600" />;
          }
          switch (accountType.name) {
            case "VOLUNTARY_SAVINGS":
              return <Wallet className="h-5 w-5 text-blue-600" />;
            case "FIXED_DEPOSIT":
              return <TrendingUp className="h-5 w-5 text-green-600" />;
            case "EMERGENCY_SAVINGS":
              return <CreditCard className="h-5 w-5 text-orange-600" />;
            default:
              return <Wallet className="h-5 w-5 text-gray-600" />;
          }
        };
        const getTypeColor = () => {
          if (
            accountType.name.toLowerCase().includes("insurance") ||
            accountType.ledgerAccount?.accountCode === "200600"
          ) {
            return "bg-purple-100 text-purple-800";
          }
          switch (accountType.name) {
            case "VOLUNTARY_SAVINGS":
              return "bg-blue-100 text-blue-800";
            case "FIXED_DEPOSIT":
              return "bg-green-100 text-green-800";
            case "EMERGENCY_SAVINGS":
              return "bg-orange-100 text-orange-800";
            default:
              return "bg-gray-100 text-gray-800";
          }
        };
        return (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${getTypeColor()}`}
            >
              {getTypeIcon()}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">
                {getAccountTypeDisplayName(accountType.name)}
              </span>
              <span className="text-sm text-gray-500">
                {accountType._count?.accounts || 0} accounts created
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
        const accountType = row;
        return (
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700">
              {accountType.interestRate}% p.a.
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "minBalance",
      header: "Balance Limits",
      cell: (row) => {
        const accountType = row;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">Min:</span>
              <span className="font-medium">
                {formatCurrency(accountType.minBalance)}
              </span>
            </div>
            {accountType.maxWithdrawal ? (
              <div className="flex items-center gap-1 text-sm">
                <CreditCard className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">Max Withdrawal:</span>
                <span className="font-medium">
                  {formatCurrency(accountType.maxWithdrawal)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">No withdrawal limit</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isLoanEligible",
      header: "Loan Eligible",
      cell: (row) => {
        const accountType = row;
        return (
          <div className="flex items-center gap-2">
            {accountType.isLoanEligible ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge
                  variant="default"
                  className="bg-green-100 text-green-800"
                >
                  Eligible
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <Badge
                  variant="destructive"
                  className="bg-red-100 text-red-800"
                >
                  Not Eligible
                </Badge>
              </>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const accountType = row;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/account-types/${accountType.id}`)
            }
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        );
      },
    },
  ];

  const handleAddNew = () => setModalOpen(true);

  // Export to Excel
  const handleExport = async (filteredAccountTypes: AccountType[]) => {
    try {
      const exportData = filteredAccountTypes.map((accountType) => ({
        ID: accountType.id,
        "Account Type": getAccountTypeDisplayName(accountType.name),
        "Interest Rate (%)": accountType.interestRate,
        "Minimum Balance": accountType.minBalance,
        "Maximum Withdrawal": accountType.maxWithdrawal || "No limit",
        "Loan Eligible": accountType.isLoanEligible ? "Yes" : "No",
        "Total Accounts": accountType._count?.accounts || 0,
        "Date Created": formatISODate(asDate(accountType.createdAt)), // <- coerce
        "Last Updated": formatISODate(asDate(accountType.updatedAt)), // <- coerce
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Account Types");

      const fileName = `${exportFilePrefix}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Account types exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleEditClick = (accountType: AccountType) => {
    router.push(`/dashboard/account-types/${accountType.id}/edit`);
  };

  const handleDeleteClick = (accountType: AccountType) => {
    setDeleteItem(accountType);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/account-types/${deleteItem.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error("Delete failed", {
          description: result.error || "Failed to delete account type",
        });
      } else {
        toast.success("Account type deleted successfully");
        setDeleteDialogOpen(false);
        setDeleteItem(null);
        router.refresh();
      }
    } catch {
      toast.error("Delete failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <AccountTypeCreateForm
        key={`${exportFilePrefix}-${modalOpen ? "open" : "closed"}`}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={createDefaults}
      />

      <DataTable<AccountType>
        title={title}
        subtitle={subtitle}
        data={accountTypes}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: handleAddNew,
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["name"],
          enableDateFilter: true,
          getItemDate: (item) => asDate(item.createdAt), // <- coerce to Date for the table
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
        title="Delete Account Type"
        description={
          deleteItem ? (
            <>
              Are you sure you want to delete{" "}
              <strong>{getAccountTypeDisplayName(deleteItem.name)}</strong>?
              This action cannot be undone and will fail if the account type has
              associated accounts.
            </>
          ) : (
            "Are you sure you want to delete this account type?"
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
