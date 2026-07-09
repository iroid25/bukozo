// app/dashboard/accounts/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";

import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import AccountListing from "./components/AccountListing";

async function fetchAccounts() {
  const accounts = await db.account.findMany({
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
  });

  return accounts;
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
