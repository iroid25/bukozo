import { Suspense } from "react";
import { headers } from "next/headers";
import { TableLoading } from "@/components/ui/data-table";

import { getAuthUser } from "@/config/useAuth";
import LoanProductListing from "./components/LoanProductListing";

async function fetchLoanProducts() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  const response = await fetch(
    `${protocol}://${host}/api/v1/loan-products`,
    {
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Failed to fetch loan products");
  }

  return result.data || [];
}

// Create an async component for data fetching
async function LoanProductListingWithData() {
  const loanProducts = await fetchLoanProducts();
  const user = await getAuthUser();

  return (
    <LoanProductListing
      title={`Loan Products (${loanProducts.length})`}
      subtitle="Manage SACCO Loan Products & Terms"
      loanProducts={loanProducts}
      userRole={user?.role ?? "ADMIN"}
    />
  );
}

export default function LoanProductsPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanProductListingWithData />
      </Suspense>
    </div>
  );
}
