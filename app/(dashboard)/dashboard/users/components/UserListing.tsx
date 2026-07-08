"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Key, Fingerprint } from "lucide-react";
import { Branch, UserRole } from "@prisma/client";

import { formatISODate } from "@/lib/utils";
import {
  Column,
  ConfirmationDialog,
  DataTable,
  TableActions,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserCreateForm from "./UserCreateForm";
import { AdminResetPasswordDialog } from "./AdminResetPasswordDialog";

export type User = {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  areaOfOperation: string | null;
  member: {
    id: string;
    fingerprintStatus?: "native" | "legacy" | "none";
  } | null;
  branch: {
    name: string;
  } | null;
};

// Helper function to convert role to URL-friendly format
const roleToUrlSegment = (role: UserRole): string => {
  if (!role) return "members";
  return role.toLowerCase().replace(/_/g, "-") + "s";
};

export default function UserListing({
  users,
  title,
  subtitle,
  branchId,
  role,
  tableRole,
  branches,
  extraActions,
}: {
  users: User[];
  title: string;
  subtitle: string;
  branchId: string;
  role: string;
  tableRole: UserRole;
  branches: Branch[];
  extraActions?: (user: User) => React.ReactNode;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const handleAddNew = () => setModalOpen(true);

  const columns: Column<User>[] = [
    {
      accessorKey: "name",
      header: "User Info",
      cell: (row) => {
        const user = row;
        const image = user.image || "/avatar.avif";
        return (
          <div className="flex items-center gap-3">
            <img
              src={image}
              alt={user.name || "User"}
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="font-medium">{user.name || "N/A"}</span>
              <span className="text-sm text-gray-500">
                {user.email || "N/A"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: (row) => (
        <Badge variant="secondary" className="capitalize">
          {row.role ? row.role.toLowerCase().replace(/_/g, " ") : "N/A"}
        </Badge>
      ),
    },
    {
      accessorKey: "branch",
      header: "Branch / Area",
      cell: (row) => {
        const user = row;
        const value =
          user.role === "AGENT"
            ? (user.areaOfOperation ?? user.branch?.name)
            : user.branch?.name;
        return <span>{value || "N/A"}</span>;
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: (row) => {
        const user = row;
        return (
          <div 
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleToggleStatus(user)}
            title="Click to toggle status"
          >
            <Badge
              variant={user.isActive ? "default" : "destructive"}
              className="font-medium"
            >
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        );
      },
    },
    ...(tableRole === "MEMBER"
      ? [
          {
            accessorKey: (row: User) => row.member?.fingerprintStatus ?? "none",
            header: "Fingerprint",
            cell: (row: User) => {
              const status = row.member?.fingerprintStatus ?? "none";
              if (status === "native") {
                return (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Enrolled
                  </span>
                );
              }
              if (status === "legacy") {
                return (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Needs re-enroll
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Not enrolled
                </span>
              );
            },
          },
        ]
      : []),
    {
      accessorKey: "createdAt",
      header: "Date Added",
      cell: (row) => <span>{formatISODate(row.createdAt)}</span>,
    },
    {
      accessorKey: (row) => row.id,
      header: "Actions",
      cell: (row) => {
        const user = row;
        return (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild title="View Details">
              <Link href={`/dashboard/pages/userdetails/${user.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setResetUser(user);
                setResetPasswordOpen(true);
              }}
              title="Reset Password"
            >
              <Key className="h-4 w-4" />
            </Button>
            {extraActions?.(user)}
            <TableActions.RowActions
              onEdit={() => handleEditClick(user)}
              onDelete={() => handleDeleteClick(user)}
            />
          </div>
        );
      },
    },
  ];

  // --- API ACTIONS ---
  const handleEditClick = (user: User) => {
    const urlSegment = roleToUrlSegment(user.role);
    router.push(`/dashboard/users/${urlSegment}/${user.id}/edit`);
  };

  const handleDeleteClick = (user: User) => {
    setDeleteItem(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/v1/users?userId=${deleteItem.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to deactivate user");
      }

      toast.success("User deactivated successfully");
      router.refresh();
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error("Deactivation failed", {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const loadingToast = toast.loading("Updating user status...");
    try {
      const response = await fetch("/api/v1/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          isActive: !user.isActive,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update status");
      }

      toast.success(`User ${!user.isActive ? "activated" : "deactivated"} successfully`, {
        id: loadingToast,
      });
      router.refresh();
    } catch (error: any) {
      toast.error("Status update failed", {
        id: loadingToast,
        description: error.message,
      });
    }
  };

  // --- EXPORT ---
  const handleExport = async (filteredUsers: User[]) => {
    try {
      const exportData = filteredUsers.map((user) => ({
        ID: user.id,
        Name: user.name,
        Email: user.email,
        Role: user.role,
        Status: user.isActive ? "Active" : "Inactive",
        Branch: user.branch?.name || "N/A",
        "Date Added": formatISODate(user.createdAt),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

      const fileName = `Users_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Users exported to ${fileName}`,
      });
    } catch (error: any) {
      toast.error("Export failed", {
        description: error.message,
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <UserCreateForm
        branchId={branchId}
        role={tableRole}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        branches={branches}
      />

      <DataTable<User>
        title={title}
        subtitle={subtitle}
        data={users}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: handleAddNew,
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["name", "email"],
          enableDateFilter: true,
          getItemDate: (item) => item.createdAt,
        }}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Deactivate User"
        description={
          deleteItem ? (
            <>
              Are you sure you want to deactivate{" "}
              <strong>{deleteItem.name}</strong>? This user will no longer be
              able to log in.
            </>
          ) : (
            "Are you sure you want to deactivate this user?"
          )
        }
        onConfirm={handleConfirmDelete}
        isConfirming={isDeleting}
        confirmLabel="Deactivate"
        variant="destructive"
      />

      {resetUser && (
        <AdminResetPasswordDialog
          userId={resetUser.id}
          userName={resetUser.name}
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
        />
      )}
    </div>
  );
}
