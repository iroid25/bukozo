// @ts-nocheck
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Edit,
  MoreHorizontal,
  Trash2,
  ArrowLeft,
  Users,
  Percent,
  DollarSign,
  CreditCard,
  Calendar,
} from "lucide-react";
import type { AccountType } from "@/types/accountTypes";
import { formatISODate } from "@/lib/utils";
import { toast } from "sonner";

interface AccountTypeDetailsViewProps {
  accountType: AccountType;
  userRole: string;
}

export default function AccountTypeDetailsView({
  accountType,
  userRole,
}: AccountTypeDetailsViewProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/account-types/${accountType.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete account type");
      } else {
        toast.success("Account type deleted successfully");
        router.push("/dashboard/account-types");
      }
    } catch {
      toast.error("Failed to delete account type");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const canEdit = userRole === "ADMIN" || userRole === "MANAGER";
  const canDelete =
    userRole === "ADMIN" && (accountType._count?.accounts ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Left side - Back button and title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/dashboard/account-types"
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>

          <div className="border-l border-gray-300 h-8"></div>

          <div>
            <h1 className="text-2xl font-bold">{accountType.name}</h1>
            <p className="text-muted-foreground">Account Type Details</p>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button asChild>
                <Link
                  className="flex items-center bg-gray-200 p-2 rounded-md"
                  href={`/dashboard/account-types/${accountType.id}/edit`}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Account Type
              </Link>
            </Button>
          )}

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link
                      className="flex items-center"
                      href={`/dashboard/account-types/${accountType.id}/edit`}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Account Type Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Account Type Name
              </label>
              <p className="text-lg font-semibold">{accountType.name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Loan Eligibility
              </label>
              <div className="mt-1">
                <Badge
                  variant={accountType.isLoanEligible ? "default" : "secondary"}
                >
                  {accountType.isLoanEligible ? "Eligible" : "Not Eligible"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Interest Rate
              </label>
              <p className="text-lg font-semibold flex items-center gap-1">
                <Percent className="h-4 w-4" />
                {accountType.interestRate}%
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Minimum Balance
              </label>
              <p className="text-lg font-semibold">
                {accountType.minBalance.toLocaleString()}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Maximum Withdrawal
              </label>
              <p className="text-lg font-semibold">
                {accountType.maxWithdrawal
                  ? accountType.maxWithdrawal.toLocaleString()
                  : "No Limit"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {accountType._count?.accounts ?? 0}
              </div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Created
              </label>
              <p className="text-sm">
                {formatISODate(
                  // @ts-ignore
                  typeof accountType.createdAt === "string"
                    ? accountType.createdAt
                    : accountType.createdAt.toISOString()
                )}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Last Updated
              </label>
              <p className="text-sm">
                {formatISODate(
                  // @ts-ignore
                  typeof accountType.updatedAt === "string"
                    ? accountType.updatedAt
                    : accountType.updatedAt.toISOString()
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{accountType.name}"? This action
              cannot be undone.
              {(accountType._count?.accounts ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This account type has {accountType._count?.accounts ?? 0}{" "}
                  associated accounts and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || (accountType._count?.accounts ?? 0) > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
