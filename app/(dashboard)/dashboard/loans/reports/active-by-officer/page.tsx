// app(dashboard)/dashboard/loans/reports/active-by-officer/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import ActiveByOfficerListing from "./components/ActiveLoansByOfficerListing";

export const dynamic = "force-dynamic";

export default async function ActiveLoansByOfficerPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <ActiveByOfficerListing
          title="Active Loans by Officer"
          subtitle="List of active loans grouped by loan officer"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
