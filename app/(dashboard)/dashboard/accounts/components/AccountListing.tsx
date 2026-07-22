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
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  User,
  Users,
  CreditCard,
  Building,
  Building2,
  Lock,
  DollarSign,
  Calendar,
  RefreshCcw,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import { Account, getAccountStatusInfo } from "@/types/accounts";
import AccountCreateForm from "./AccountCreateForm";
import { AccountStatus } from "@prisma/client";

export default function AccountListing({
  accounts,
  title,
  subtitle,
  userRole,
}: {
  accounts: Account[];
  title: string;
  subtitle: string;
  userRole: string;
}) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeItem, setCloseItem] = useState<Account | null>(null);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [reactivateItem, setReactivateItem] = useState<Account | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const columns: Column<Account>[] = [
    {
      accessorKey: "accountNumber",
      header: "Account Details",
      cell: (row) => {
        const account = row as any;
        const statusInfo = getAccountStatusInfo(account.status);
        const isFd = account.isFd;

        return (
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isFd
                ? "bg-amber-100 text-amber-600"
                : "bg-blue-100 text-blue-600"
            }`}>
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{account.accountNumber}</span>
                {isFd ? (
                  <Badge className={
                    account.fdStatus === "ACTIVE"
                      ? account.daysToMaturity <= 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                      : account.fdStatus === "WITHDRAWN"
                      ? "bg-red-100 text-red-800"
                      : account.fdStatus === "REVERSED"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-blue-100 text-blue-800"
                  }>
                    {account.fdStatus === "ACTIVE"
                      ? account.daysToMaturity <= 0 ? "Matured" : "Active"
                      : account.fdStatus === "WITHDRAWN"
                      ? "Withdrawn"
                      : account.fdStatus === "REVERSED"
                      ? "Reversed"
                      : account.fdStatus === "RENEWED"
                      ? "Renewed"
                      : account.fdStatus}
                  </Badge>
                ) : (
                  <Badge className={statusInfo.color}>
                    {statusInfo.icon} {statusInfo.label}
                  </Badge>
                )}
                {isFd && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">
                    FD
                  </Badge>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {getAccountTypeDisplayName(account.accountType.name)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: (row) =>
        row.member?.user.name || row.institution?.institutionName || "Unknown",
      header: "Account Owner",
      cell: (row) => {
        const account = row;

        // Check if it's a member account
        if (account.member) {
          const member = account.member;
          const user = member.user;
          const jointMembers = (account as any).jointMembers || [];
          const hasJointMembers = jointMembers.length > 0;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {hasJointMembers ? (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      <Users className="h-3 w-3 mr-1" />
                      +{jointMembers.length} Joint
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <User className="h-3 w-3 mr-1" />
                      Member
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span>#{member.memberNumber}</span>
                </div>
              </div>
            </div>
          );
        }

        // Check if it's an institution account
        if (account.institution) {
          const institution = account.institution;
          const user = institution.user;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={institution.institutionName}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {institution.institutionName}
                  </span>
                  <Badge variant="outline" className="text-xs bg-purple-50">
                    <Building2 className="h-3 w-3 mr-1" />
                    Institution
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span>#{institution.institutionNumber}</span>
                </div>
              </div>
            </div>
          );
        }

        return <span className="text-gray-400">Unknown</span>;
      },
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: (row) => {
        const account = row as any;
        const isFd = account.isFd;
        const balanceColor =
          account.balance >= (account.accountType.minBalance || 0)
            ? "text-green-700"
            : "text-red-700";

        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <DollarSign className={`h-4 w-4 ${balanceColor}`} />
              <span className={`font-medium ${balanceColor}`}>
                {formatCurrency(account.balance)}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Min: {formatCurrency(account.accountType.minBalance || 0)}
            </div>

            {isFd && account.expectedInterest > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Interest ({account.accountType.interestRate}% p.a.)</span>
                  <span className="text-green-600 font-semibold">{formatCurrency(account.expectedInterest)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">At Maturity</span>
                  <span className="text-blue-700 font-bold">{formatCurrency(account.maturityAmount || account.balance + account.expectedInterest)}</span>
                </div>

                {isFd && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>{account.termMonths} months</span>
                      <span>{account.daysToMaturity > 0 ? `${account.daysToMaturity}d left` : "Matured"}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          account.maturityProgressPct >= 100
                            ? "bg-green-500"
                            : account.maturityProgressPct >= 75
                            ? "bg-blue-500"
                            : account.maturityProgressPct >= 50
                            ? "bg-amber-400"
                            : "bg-orange-400"
                        }`}
                        style={{ width: `${Math.min(100, account.maturityProgressPct || 0)}%` }}
                      />
                    </div>
                  </div>
                )}

                {account.fixingEndDate && (
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due: {formatISODate(account.fixingEndDate)}
                  </div>
                )}
              </div>
            )}

            {!isFd && account.accountType.hasFixedPeriod && account.expectedInterest && (
              <div className="mt-1 pt-1 border-t border-gray-200">
                <div className="text-xs text-green-600 font-medium">
                  Interest: {formatCurrency(account.expectedInterest)}
                </div>
                <div className="text-xs text-blue-600 font-semibold">
                  At Maturity: {formatCurrency(account.balance + account.expectedInterest)}
                </div>
                {account.fixingEndDate && (
                  <div className="text-xs text-gray-500">
                    Due: {formatISODate(account.fixingEndDate)}
                  </div>
                )}
              </div>
            )}

            {account.accountType.isShareAccount && account.sharesCount !== null && (
              <div className="mt-1 pt-1 border-t border-gray-200">
                <div className="bg-blue-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1.5">
                   <div className="text-xs text-blue-700 font-semibold">
                     {account.sharesCount} Shares
                   </div>
                   {account.accountType.sharePrice && (
                      <span className="text-[10px] text-blue-600">
                        (@ {formatCurrency(account.accountType.sharePrice)})
                      </span>
                   )}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: (row) => {
        const account = row;

        return (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium text-sm">{account.branch.name}</span>
              <span className="text-xs text-gray-500">
                {account.branch.location}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "openedAt",
      header: "Opened Date",
      cell: (row) => {
        const account = row;

        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">
                {formatISODate(account.openedAt)}
              </span>
              {account.closedAt && (
                <span className="text-sm text-red-500">
                  Closed: {formatISODate(account.closedAt)}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const account = row as any;
        const isFd = account.isFd;

        if (isFd) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/accounts/fixed-deposits?view=${account.id}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              {account.fdStatus === "ACTIVE" && account.daysToMaturity <= 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/accounts/fixed-deposits`)}
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Withdraw
                </Button>
              )}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        );
      },
    },
  ];

  const handleAddNew = () => {
    setModalOpen(true);
  };

  const handleExport = async (filteredAccounts: Account[]) => {
    try {
      const exportData = filteredAccounts.map((account) => {
        const isInstitution = !!account.institution;
        const ownerName = isInstitution
          ? account.institution?.institutionName
          : account.member?.user.name;
        const ownerNumber = isInstitution
          ? account.institution?.institutionNumber
          : account.member?.memberNumber;
        const ownerType = isInstitution ? "Institution" : "Member";

        return {
          "Account Number": account.accountNumber,
          "Owner Type": ownerType,
          "Owner Name": ownerName,
          "Owner Number": ownerNumber,
          "Account Type": getAccountTypeDisplayName(account.accountType.name),
          Balance: account.balance,
          Status: getAccountStatusInfo(account.status).label,
          "Interest Rate": `${account.accountType.interestRate}%`,
          "Minimum Balance": account.accountType.minBalance,
          Branch: account.branch.name,
          "Branch Location": account.branch.location,
          "Total Transactions": account._count?.transactions || 0,
          "Total Deposits": account._count?.deposits || 0,
          "Total Withdrawals": account._count?.withdrawals || 0,
          "Date Opened": formatISODate(account.openedAt),
          "Date Closed": account.closedAt
            ? formatISODate(account.closedAt)
            : "N/A",
          "Owner Email": isInstitution
            ? account.institution?.user.email
            : account.member?.user.email,
          "Owner Phone": isInstitution
            ? account.institution?.user.phone || "N/A"
            : account.member?.user.phone || "N/A",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Accounts");

      const fileName = `Accounts_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Accounts exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleCloseAccountClick = (account: Account) => {
    setCloseItem(account);
    setCloseDialogOpen(true);
  };

  const handleReactivateAccountClick = (account: Account) => {
    setReactivateItem(account);
    setReactivateDialogOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!closeItem) return;

    setIsClosing(true);
    try {
      const response = await fetch(`/api/v1/accounts/${encodeURIComponent(closeItem.id)}/close`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error("Failed to close account", {
          description: json?.error || "Unable to close account",
        });
      } else {
        toast.success("Account closed successfully");
        setCloseDialogOpen(false);
        setCloseItem(null);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to close account", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateItem) return;

    setIsReactivating(true);
    try {
      const response = await fetch(
        `/api/v1/accounts/${encodeURIComponent(reactivateItem.id)}/reactivate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            remarks: "Reactivation processed from dashboard",
          }),
        }
      );
      const json = await response.json();

      if (!response.ok) {
        toast.error("Failed to reactivate account", {
          description: json?.error || "Unable to reactivate account",
        });
      } else {
        toast.success("Account reactivated successfully");
        setReactivateDialogOpen(false);
        setReactivateItem(null);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to reactivate account", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsReactivating(false);
    }
  };

  const getOwnerName = (account: Account) => {
    if (account.institution) {
      return account.institution.institutionName;
    }
    return account.member?.user.name || "Unknown";
  };

  return (
    <>
      <AccountCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <DataTable<Account>
        title={title}
        subtitle={subtitle}
        data={accounts}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: ["ADMIN", "MANAGER", "TELLER"].includes(userRole)
            ? handleAddNew
            : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "accountNumber",
            "member.user.name",
            "member.user.firstName",
            "member.user.lastName",
            "member.memberNumber",
            "member.user.email",
            "member.user.phone",
            "institution.institutionName",
            "institution.institutionNumber",
            "institution.user.firstName",
            "institution.user.lastName",
            "institution.user.email",
            "institution.user.phone",
            "accountType.name",
            "branch.name",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.openedAt,
        }}
        renderRowActions={(item) => {
          const a = item as any;
          const isFd = a.isFd;

          if (isFd) {
            return (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/accounts/fixed-deposits?view=${a.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {a.fdStatus === "ACTIVE" && (a.daysToMaturity ?? 0) <= 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/accounts/fixed-deposits`)}
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Withdraw
                  </Button>
                )}
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/accounts/${item.id}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>

              {item.status === AccountStatus.DORMANT &&
                ["ADMIN", "ACCOUNTANT", "TELLER"].includes(userRole) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReactivateAccountClick(item)}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Reactivate
                  </Button>
                )}

              {item.status !== AccountStatus.CLOSED && userRole === "ADMIN" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCloseAccountClick(item)}
                  className="text-destructive"
                >
                  <Lock className="h-4 w-4 mr-1" />
                  Close
                </Button>
              )}
            </div>
          );
        }}
      />

      <ConfirmationDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        title="Close Account"
        description={
          closeItem ? (
            <>
              Are you sure you want to close account{" "}
              <strong>{closeItem.accountNumber}</strong> for{" "}
              <strong>{getOwnerName(closeItem)}</strong>?
              {closeItem.balance > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <strong>Warning:</strong> This account has a balance of{" "}
                  {formatCurrency(closeItem.balance)}. All funds must be
                  withdrawn before closing.
                </div>
              )}
            </>
          ) : (
            "Are you sure you want to close this account?"
          )
        }
        onConfirm={handleConfirmClose}
        isConfirming={isClosing}
        confirmLabel="Close Account"
        variant="destructive"
      />

      <ConfirmationDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        title="Reactivate Dormant Account"
        description={
          reactivateItem ? (
            <>
              Reactivating <strong>{reactivateItem.accountNumber}</strong> for{" "}
              <strong>{getOwnerName(reactivateItem)}</strong> will collect
              UGX 10,000 in total:
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm">
                <div>UGX 5,000 to restore the minimum balance</div>
                <div>UGX 5,000 dormancy penalty</div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                This will only apply to dormant savings accounts.
              </div>
            </>
          ) : (
            "Are you sure you want to reactivate this dormant account?"
          )
        }
        onConfirm={handleConfirmReactivate}
        isConfirming={isReactivating}
        confirmLabel="Reactivate Account"
        variant="default"
      />
    </>
  );
}
