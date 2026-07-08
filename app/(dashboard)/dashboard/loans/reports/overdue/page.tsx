// app/(dashboard)/dashboard/loans/reports/overdue/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import OverdueReportView from "./components/OverdueReportView";

export const dynamic = "force-dynamic";

export default async function OverdueReportPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <OverdueReportView
          userRole={user?.role ?? "TELLER"}
          initialBranchId={user?.branchId || undefined}
        />
      </Suspense>
    </div>
  );
}
