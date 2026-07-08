// app/(dashboard)/dashboard/loans/reports/collateral/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import CollateralListing from "./components/LoanCollateralListing";

export const dynamic = "force-dynamic";

export default async function LoanCollateralPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <CollateralListing
          title="Loan Collateral Report"
          subtitle="List of collateral items provided for active loans"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
