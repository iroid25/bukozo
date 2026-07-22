// @ts-nocheck
// app/dashboard/users/institutions/components/InstitutionsListing.tsx
"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  Pencil,
  UserPlus,
  MoreVertical,
} from "lucide-react";
import { UserRole, Branch } from "@prisma/client";

import {
  Column,
  ConfirmationDialog,
  DataTable,
  TableActions,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatISODate } from "@/lib/utils";

import InstitutionFormModal from "./InstitutionFormModal";

type InstitutionRow = {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionType: string;
  isApproved: boolean;
  createdAt: string | Date;
  primaryContactPerson: string;
  primaryContactPhone: string;
  institutionEmail: string;
  institutionPhone: string;
  district?: string | null;
  signatories?: Array<{
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    signatureImage: string | null;
    status: string;
  }>;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    isActive: boolean;
    role: UserRole;
    createdAt: Date | string;
    branch: { name: string } | null;
  };
};

const toDate = (v: string | Date): Date =>
  typeof v === "string" ? new Date(v) : v;

export default function InstitutionsListing({
  institutions,
  title,
  subtitle,
  branchId,
  role,
  branches,
  onDataChange,
}: {
  institutions: InstitutionRow[];
  title: string;
  subtitle: string;
  branchId: string;
  role: UserRole | string;
  branches: Branch[];
  onDataChange?: () => void;
}) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionRow | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InstitutionRow | null>(null);

  const hasCompleteProfile = (inst: InstitutionRow) =>
    inst.isApproved &&
    inst.user.isActive &&
    !!inst.primaryContactPerson?.trim() &&
    !!inst.primaryContactPhone?.trim() &&
    !!inst.institutionPhone?.trim() &&
    (inst.signatories ?? []).some(
      (sig) => sig.status === "ACTIVE" && !!sig.signatureImage?.trim() && !!sig.phone?.trim(),
    );

  const columns: Column<InstitutionRow>[] = useMemo(
    () => [
      {
        accessorKey: "institutionName",
        header: "Institution",
        cell: (row) => {
          const inst = row;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">{inst.institutionName}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{inst.institutionType}</Badge>
                  <span>•</span>
                  <span>#{inst.institutionNumber}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "contact",
        header: "Contact",
        cell: (row) => {
          const inst = row;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {inst.primaryContactPerson} — {inst.primaryContactPhone}
              </span>
              <span className="text-xs text-muted-foreground">
                {inst.institutionEmail}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "branch",
        header: "Branch",
        cell: (row) => {
          const inst = row;
          return <span>{inst.user.branch?.name ?? "—"}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (row) => {
          const inst = row;
          return (
            <div className="flex items-center gap-2">
              {inst.isApproved ? (
                <Badge className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Approved
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Pending
                </Badge>
              )}
              <Badge variant={inst.user.isActive ? "default" : "destructive"}>
                {inst.user.isActive ? "Active" : "Disabled"}
              </Badge>
              <Badge variant={hasCompleteProfile(inst) ? "default" : "outline"}>
                {hasCompleteProfile(inst) ? "Profile ready" : "Profile incomplete"}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "id",
        header: "Actions",
        cell: (row) => {
          const inst = row;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/users/institutions/${inst.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(inst);
                    setModalOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {!inst.isApproved && (
                  <DropdownMenuItem
                    onClick={() => handleApprove(inst.id)}
                    disabled={approvingId === inst.id}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {approvingId === inst.id ? "Approving..." : "Approve"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setDeleteItem(inst);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [approvingId]
  );

  function handleAddNew() {
    setEditing(null);
    setModalOpen(true);
  }

  async function handleApprove(id: string) {
    try {
      setApprovingId(id);
      const response = await fetch(`/api/v1/institutions/${id}/approve`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to approve institution");
      }

      toast.success("Institution approved");
      onDataChange?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve institution");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDisable() {
    if (!deleteItem) return;
    const { id, institutionName } = deleteItem;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/institutions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to disable institution");
      } else {
        toast.success(`"${institutionName}" disabled`);
        setDeleteDialogOpen(false);
        setDeleteItem(null);
        onDataChange?.();
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleExport(filtered: InstitutionRow[]) {
    const exportData = filtered.map((i) => ({
      ID: i.id,
      Number: i.institutionNumber,
      Name: i.institutionName,
      Type: i.institutionType,
      Approved: i.isApproved ? "Yes" : "No",
      "Profile Ready": hasCompleteProfile(i) ? "Yes" : "No",
      Contact: `${i.primaryContactPerson} (${i.primaryContactPhone})`,
      Email: i.institutionEmail,
      Phone: i.institutionPhone,
      Branch: i.user.branch?.name ?? "",
      "Created (Institution)": formatISODate(toDate(i.createdAt)),
      "Created (User)": formatISODate(toDate(i.user.createdAt)),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Institutions");
    const fileName = `Institutions_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Export successful", { description: fileName });
  }

  return (
    <div className="mx-auto py-6">
      <InstitutionFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          onDataChange?.();
        }}
        mode={editing ? "edit" : "create"}
        branches={branches}
        branchId={branchId}
        role={role as UserRole}
        initial={editing}
      />

      <DataTable<InstitutionRow>
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            <span>{title}</span>
          </div>
        }
        subtitle={subtitle}
        data={institutions}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => onDataChange?.()}
        actions={{
          onAdd: handleAddNew,
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "institutionName",
            "institutionType",
            "institutionNumber",
            "institutionEmail",
            "primaryContactPerson",
          ],
          enableDateFilter: true,
          getItemDate: (item) => toDate(item.createdAt),
        }}
        renderRowActions={(item) => (
          <TableActions.RowActions
            onEdit={() => {
              setEditing(item);
              setModalOpen(true);
            }}
            onDelete={() => {
              setDeleteItem(item);
              setDeleteDialogOpen(true);
            }}
          />
        )}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Disable Institution"
        description={
          deleteItem ? (
            <>
              Are you sure you want to disable{" "}
              <strong>{deleteItem.institutionName}</strong>? The institution's
              user will not be able to log in.
            </>
          ) : (
            "Are you sure you want to disable this institution?"
          )
        }
        onConfirm={handleDisable}
        isConfirming={isDeleting}
        confirmLabel="Disable"
        variant="destructive"
      />
    </div>
  );
}
