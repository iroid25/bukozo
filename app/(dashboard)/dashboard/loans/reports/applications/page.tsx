// app/(dashboard)/dashboard/loans/reports/applications/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import LoanApplicationsListing from "./components/LoanApplicationsListing";

export const dynamic = "force-dynamic";

export default async function LoanApplicationsPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanApplicationsListing
          title="Loan Applications Report"
          subtitle="Status analysis of loan applications"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
