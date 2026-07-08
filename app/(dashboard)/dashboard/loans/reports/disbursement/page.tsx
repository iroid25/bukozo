// app/(dashboard)/dashboard/loans/reports/disbursement/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import DisbursementReportView from "./components/DisbursementReportView";

export const dynamic = "force-dynamic";

export default async function LoanDisbursementPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <DisbursementReportView
          userRole={user?.role ?? "TELLER"}
          initialBranchId={user?.branchId || undefined}
        />
      </Suspense>
    </div>
  );
}
