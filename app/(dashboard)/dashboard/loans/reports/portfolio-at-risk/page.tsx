// app/(dashboard)/dashboard/loans/reports/portfolio-at-risk/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import PortfolioReportView from "./components/PortfolioReportView";

export const dynamic = "force-dynamic";

export default async function PortfolioReportPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <PortfolioReportView
          userRole={user?.role ?? "MEMBER"}
          initialBranchId={user?.branchId || undefined}
        />
      </Suspense>
    </div>
  );
}
