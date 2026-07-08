// app/(dashboard)/dashboard/loans/reports/guarantors/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import GuarantorsListing from "./LoanGuarantorsListing";

export const dynamic = "force-dynamic";

export default async function LoanGuarantorsPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <GuarantorsListing
          title="Loan Guarantors Report"
          subtitle="List of loan guarantors and their associated loans"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
