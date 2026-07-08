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
import { Eye, MapPin, Phone, Mail, Users } from "lucide-react";

// import { Branch } from "@/types/branch";
// import BranchCreateForm from "./BranchCreateForm";
import { formatISODate } from "@/lib/utils";
import { Branch } from "@/types/branches";
import BranchCreateForm from "./BranchCreateForm";

export default function BranchListing({
  branches,
  title,
  subtitle,
  userRole,
  accountants = [],
  managers = [],
  isLoading = false,
  onRefresh,
}: {
  branches: Branch[];
  title: string;
  subtitle: string;
  userRole: string;
  accountants?: any[];
  managers?: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Branch | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columns: Column<Branch>[] = [
    {
      accessorKey: "name",
      header: "Branch Info",
      cell: (row) => {
        const branch = row;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex flex-col ">
              <span className="font-medium">{branch.name}</span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {branch.location}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: (row) => {
        const branch = row;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {branch.contactPerson || "Not assigned"}
            </span>
            {branch.contactPhone && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {branch.contactPhone}
              </span>
            )}
            {branch.email && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {branch.email}
              </span>
            )}
          </div>
        );
      },
    },
    // {
    //   accessorKey: "_count",
    //   header: "Statistics",
    //   cell: (row) => {
    //     const branch = row;
    //     const count = branch._count;
    //     return (
    //       <div className="grid grid-cols-2 gap-2 text-sm">
    //         <div className="flex items-center gap-1">
    //           <Users className="h-3 w-3 text-blue-500" />
    //           <span>{count?.users || 0} Users</span>
    //         </div>
    //         <div className="flex items-center gap-1">
    //           <span className="h-3 w-3 rounded bg-green-500" />
    //           <span>{count?.accounts || 0} Accounts</span>
    //         </div>
    //         <div className="flex items-center gap-1">
    //           <span className="h-3 w-3 rounded bg-yellow-500" />
    //           <span>{count?.loans || 0} Loans</span>
    //         </div>
    //         <div className="flex items-center gap-1">
    //           <span className="h-3 w-3 rounded bg-purple-500" />
    //           <span>{count?.floatAllocations || 0} Floats</span>
    //         </div>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "createdAt",
      header: "Date Created",
      cell: (row) => {
        const branch = row;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(branch.createdAt)}
            </span>
            <span className="text-sm text-gray-500">
              Updated: {formatISODate(branch.updatedAt)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const branch = row;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/branches/${branch.id}`)}
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

  // Export to Excel
  const handleExport = async (filteredBranches: Branch[]) => {
    try {
      // Prepare data for export
      const exportData = filteredBranches.map((branch) => ({
        ID: branch.id,
        Name: branch.name,
        Location: branch.location,
        "Contact Person": branch.contactPerson || "N/A",
        "Contact Phone": branch.contactPhone || "N/A",
        Email: branch.email || "N/A",
        "Total Users": branch._count?.users || 0,
        "Total Accounts": branch._count?.accounts || 0,
        "Total Loans": branch._count?.loans || 0,
        "Float Allocations": branch._count?.floatAllocations || 0,
        "Date Created": formatISODate(branch.createdAt),
        "Last Updated": formatISODate(branch.updatedAt),
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");

      // Generate filename with current date
      const fileName = `Branches_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Branches exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Handle edit click
  const handleEditClick = (branch: Branch) => {
    router.push(`/dashboard/branches/${branch.id}/edit`);
  };

  // Handle delete click
  const handleDeleteClick = (branch: Branch) => {
    setDeleteItem(branch);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/branches/${deleteItem.id}`, { method: "DELETE" });
      const result = await res.json();

      if (!res.ok) {
        toast.error("Delete failed", { description: result.error });
      } else {
        toast.success("Branch deleted successfully");
        setDeleteDialogOpen(false);
        setDeleteItem(null);
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      toast.error("Delete failed", { description: "An unexpected error occurred" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <BranchCreateForm
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (onRefresh) onRefresh();
        }}
        accountants={accountants}
        managers={managers}
      />

      <DataTable<Branch>
        title={title}
        subtitle={subtitle}
        data={branches}
        columns={columns}
        keyField="id"
        isLoading={isLoading}
        onRefresh={onRefresh || (() => router.refresh())}
        actions={{
          onAdd: userRole === "ADMIN" ? handleAddNew : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["name", "location", "contactPerson"],
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
        title="Delete Branch"
        description={
          deleteItem ? (
            <>
              Are you sure you want to delete <strong>{deleteItem.name}</strong>
              ? This action cannot be undone and will fail if the branch has
              associated users, accounts, or loans.
            </>
          ) : (
            "Are you sure you want to delete this branch?"
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
