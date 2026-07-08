// @ts-nocheck
// app/(dashboard)/dashboard/loans/reports/rescheduled/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import RescheduledLoansListing from "./components/RescheduledLoansListing";

export const dynamic = "force-dynamic";

export default async function RescheduledLoansPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <RescheduledLoansListing
          title="Rescheduled Loans"
          subtitle="View all rescheduled loans"
          role={user?.role ?? "MEMBER"}
          initialBranchId={user?.branchId || undefined}
        />
      </Suspense>
    </div>
  );
}
