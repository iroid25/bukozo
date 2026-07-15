// app/dashboard/accounts/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";

import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import AccountListing from "./components/AccountListing";

async function fetchAccounts() {
  const [accounts, fixedDeposits] = await Promise.all([
    db.account.findMany({
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
  const fdAccounts = fixedDeposits.map((fd) => ({
    id: fd.id,
    accountNumber: fd.accountNumber,
    balance: fd.principalAmount,
    status: fd.status === "ACTIVE" ? "ACTIVE" : fd.status === "WITHDRAWN" ? "CLOSED" : "ACTIVE",
    accountTypeId: "",
    accountType: {
      id: "fixed-deposit-model",
      name: "FIXED_DEPOSIT",
      minBalance: 0,
      hasFixedPeriod: true,
      interestRate: fd.interestRate,
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
    openedAt: fd.createdAt,
    _count: { transactions: 0, deposits: 0, withdrawals: 0 },
  }));

  return [...accounts, ...fdAccounts as any[]];
}

// Create an async component for data fetching
async function AccountListingWithData() {
  const user = await getAuthUser();
  const accounts = await fetchAccounts();

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
