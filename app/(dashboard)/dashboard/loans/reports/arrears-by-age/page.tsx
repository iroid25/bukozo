// app/(dashboard)/dashboard/loans/reports/arrears-by-age/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import LoanArrearsByAgeListing from "./components/LoanArrearsByAgeListing";

export const dynamic = "force-dynamic";

export default async function LoanArrearsByAgePage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanArrearsByAgeListing
          title="Loan Arrears by Age"
          subtitle="View arrears categorized by aging periods"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
