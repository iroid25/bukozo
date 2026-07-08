// app/(dashboard)/dashboard/loans/reports/paid-off/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import PaidOffListing from "./components/PaidOffLoansListing";

export const dynamic = "force-dynamic";

export default async function PaidOffLoansPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <PaidOffListing
          title="Paid Off Loans Report"
          subtitle="List of loans that have been fully repaid and closed"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
