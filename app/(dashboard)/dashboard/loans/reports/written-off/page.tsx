// app/(dashboard)/dashboard/loans/reports/written-off/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import WrittenOffLoansListing from "./components/WrittenOffLoansListing";

export const dynamic = "force-dynamic";

export default async function WrittenOffLoansPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <WrittenOffLoansListing
          title="Written Off Loans Report"
          subtitle="Record of loans that have been decommissioned as bad debt"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
