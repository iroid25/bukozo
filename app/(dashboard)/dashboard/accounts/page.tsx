// app/dashboard/accounts/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { headers } from "next/headers";

import { getAuthUser } from "@/config/useAuth";
import AccountListing from "./components/AccountListing";

async function fetchAccounts() {
  const headerList = await headers();
  const protocol = headerList.get("x-forwarded-proto") || "http";
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const response = await fetch(`${baseUrl}/api/v1/accounts/list`, {
    cache: "no-store",
    headers: {
      cookie: headerList.get("cookie") || "",
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || "Failed to load accounts");
  }

  return Array.isArray(json?.data) ? json.data : [];
}

// Create an async component for data fetching
async function AccountListingWithData() {
  const accounts = await fetchAccounts();
  const user = await getAuthUser();

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
