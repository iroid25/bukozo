// app/dashboard/reports/loans/portfolio-concentration/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import PortfolioConcentrationListing from "./components/PortfolioConcentrationListing";

export const dynamic = "force-dynamic";

export default async function PortfolioConcentrationPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <PortfolioConcentrationListing
          title="Loan Concentration Analysis"
          subtitle="Analyze loan distribution by product and branch"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
