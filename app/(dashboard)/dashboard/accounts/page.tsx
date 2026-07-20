// app/dashboard/accounts/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";

import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import AccountListing from "./components/AccountListing";

async function fetchAccounts(branchId?: string, isAdmin?: boolean) {
  const branchFilter = isAdmin
    ? branchId && branchId !== "all"
      ? { branchId }
      : {}
    : branchId
      ? { branchId }
      : {};

  const [accounts, fixedDeposits] = await Promise.all([
    db.account.findMany({
      where: branchFilter,
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        accountType: true,
        branch: true,
        jointMembers: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    }),
    db.fixedDeposit.findMany({
      where: branchFilter,
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        branch: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  // Map FixedDeposit records to Account-compatible shape for the listing
  const fdAccounts = fixedDeposits.map((fd) => {
    const now = new Date();
    const maturityDate = new Date(fd.maturityAmount ? fd.maturityDate : fd.maturityDate);
    const totalInterest = fd.maturityAmount - fd.principalAmount;
    const daysTotal = Math.max(1, Math.ceil((maturityDate.getTime() - new Date(fd.startDate).getTime()) / 86400000));
    const daysElapsed = Math.max(0, Math.min(daysTotal, Math.ceil((now.getTime() - new Date(fd.startDate).getTime()) / 86400000)));
    const progressPct = Math.min(100, Math.round((daysElapsed / daysTotal) * 100));
    const daysToMaturity = Math.max(0, Math.ceil((maturityDate.getTime() - now.getTime()) / 86400000));
    const isMatured = fd.status === "ACTIVE" && now >= maturityDate;
    const status = fd.status === "WITHDRAWN" ? "CLOSED" : isMatured ? "MATURED" : "ACTIVE";

    return {
      id: fd.id,
      accountNumber: fd.accountNumber,
      balance: fd.principalAmount,
      status,
      accountTypeId: "fixed-deposit-model",
      accountType: {
        id: "fixed-deposit-model",
        name: "FIXED_DEPOSIT",
        minBalance: 0,
        hasFixedPeriod: true,
        isShareAccount: false,
        interestRate: fd.interestRate,
        sharePrice: null,
      },
      memberId: fd.memberId,
      member: fd.member
        ? {
            ...fd.member,
            user: fd.member.user,
          }
        : null,
      institutionId: fd.institutionId,
      institution: fd.institution
        ? {
            ...fd.institution,
            user: fd.institution.user,
          }
        : null,
      branchId: fd.branchId,
      branch: fd.branch,
      openedAt: fd.startDate,
      closedAt: fd.withdrawnDate || null,
      expectedInterest: totalInterest,
      maturityAmount: fd.maturityAmount,
      fixingEndDate: fd.maturityDate,
      termMonths: fd.termMonths,
      daysToMaturity,
      maturityProgressPct: progressPct,
      isFd: true as const,
      fdStatus: fd.status,
      _count: { transactions: 0, deposits: 0, withdrawals: 0 },
    };
  });

  return [...accounts, ...fdAccounts as any[]];
}

// Create an async component for data fetching
async function AccountListingWithData() {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const branchId = resolveBranchScope(user, undefined);
  const accounts = await fetchAccounts(branchId, user.role === "ADMIN");

  return (
    // <div className="p-10">
    <AccountListing
      title={`Member Accounts (${accounts.length})`}
      subtitle="Manage Member Bank Accounts & Balances"
      accounts={accounts}
      userRole={user?.role ?? "TELLER"}
    />
    // </div>
  );
}

export default function AccountsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Suspense fallback={<TableLoading />}>
        {/* <div className="p-10"> */}
        <AccountListingWithData />
        {/* </div> */}
      </Suspense>
    </div>
  );
}
