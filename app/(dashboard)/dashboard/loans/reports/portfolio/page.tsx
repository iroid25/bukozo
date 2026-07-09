// app/dashboard/reports/loans/portfolio/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import LoanPortfolioListing from "./components/LoanPortfolioListing";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export default async function LoanPortfolioSummaryPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanPortfolioListing
          title="Loan Performance Review"
          subtitle="Comprehensive performance analysis of loans by product"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
