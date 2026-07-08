// @ts-nocheck
// app/dashboard/loans/reports/repayment/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import RepaymentHistoryReportView from "./RepaymentHistoryReportView";

export const dynamic = "force-dynamic";

export default async function RepaymentHistoryReportPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <RepaymentHistoryReportView
          userRole={user?.role ?? "MEMBER"}
          initialBranchId={user?.branchId || undefined}
        />
      </Suspense>
    </div>
  );
}
