"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Column,
  DataTable,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { LiftHoldButton } from "./lift-hold-button";
import { Account, Member, Institution, User, AccountType, AccountHold, HoldReason, Loan } from "@prisma/client";
import { HoldAccountDialog } from "./hold-account-dialog";

// Define the shape of the data returned by getActiveHolds
export type HoldWithRelations = AccountHold & {
  account: Account & {
    accountType: AccountType;
  };
  member: (Member & { user: User }) | null;
  institution: (Institution & { user: User }) | null;
  placedBy: User;
  liftedBy: User | null;
  loan: Loan | null;
};

export default function HoldListing({
  holds,
  userId,
  onRefresh,
}: {
  holds: HoldWithRelations[];
  userId: string;
  onRefresh?: () => void;
}) {
  const router = useRouter();

  // Define Columns
  const columns: Column<HoldWithRelations>[] = [
    {
      accessorKey: (row) => row.account.accountNumber,
      header: "Account",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.account.accountNumber}</div>
          <div className="text-xs text-muted-foreground">{row.account.accountType.name}</div>
        </div>
      ),
    },
    {
        accessorKey: (row) => row.member?.user.name || row.institution?.institutionName || "Unknown",
        header: "Owner",
        cell: (row) => {
            const name = row.member?.user.name || row.institution?.institutionName || "Unknown";
            const type = row.member ? "Member" : "Institution";
            return (
                <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{type}</div>
                </div>
            );
        }
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: (row) => (
        <div>
            <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
             {row.reason.replace(/_/g, " ")}
            </Badge>
            {row.reasonText && (
                <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={row.reasonText}>
                    {row.reasonText}
                </div>
            )}
        </div>
      ),
    },
    {
      accessorKey: (row) => row.placedBy.name,
      header: "Placed By",
      cell: (row) => (
          <div>
              <div>{row.placedBy.name}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(row.placedAt), "MMM d, yyyy")}</div>
          </div>
      ),
    },
    {
        accessorKey: "id",
        header: "Actions",
        cell: (row) => (
            <LiftHoldButton 
                holdId={row.id} 
                userId={userId}
                accountNumber={row.account.accountNumber}
                onSuccess={() => router.refresh()}
            />
        )
    }
  ];

  // --- EXPORT ---
  const handleExport = async (filteredHolds: HoldWithRelations[]) => {
    try {
      const exportData = filteredHolds.map((hold) => ({
        "Account Number": hold.account.accountNumber,
        "Account Type": hold.account.accountType.name,
        "Owner": hold.member?.user.name || hold.institution?.institutionName || "Unknown",
        "Reason": hold.reason,
        "Details": hold.reasonText || "",
        "Placed By": hold.placedBy.name,
        "Placed Date": format(new Date(hold.placedAt), "yyyy-MM-dd"),
        "Notes": hold.notes || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Holds");

      const fileName = `Holds_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful");
    } catch (error: any) {
      toast.error("Export failed", { description: error.message });
    }
  };

  return (
    <div className="container mx-auto py-2">
      <DataTable<HoldWithRelations>
        title={`Active Holds (${holds.length})`}
        subtitle="Manage frozen accounts"
        data={holds}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
        }}
        // Custom header action component
        customAction={
             <HoldAccountDialog userId={userId} onSuccess={() => router.refresh()} />
        }
        filters={{
          searchFields: ["account.accountNumber", "reason"], // Note: nested search might need DataTable support or flattening
          enableDateFilter: true,
          getItemDate: (item) => new Date(item.placedAt),
        }}
      />
    </div>
  );
}
