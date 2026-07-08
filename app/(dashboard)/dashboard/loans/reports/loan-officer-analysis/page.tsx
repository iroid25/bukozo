// app/dashboard/reports/loans/loan-officer-analysis/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import LoanOfficerAnalysisListing from "./components/LoanOfficerAnalysisListing";

export const dynamic = "force-dynamic";

export default async function LoanOfficerAnalysisPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanOfficerAnalysisListing
          title="Loan Officer Analysis"
          subtitle="Performance metrics and portfolio distribution by loan officer"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
