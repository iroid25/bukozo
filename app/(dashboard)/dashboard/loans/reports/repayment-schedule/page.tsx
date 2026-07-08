// app/(dashboard)/dashboard/loans/reports/repayment-schedule/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import RepaymentScheduleListing from "./components/LoanRepaymentScheduleListing";

export const dynamic = "force-dynamic";

export default async function RepaymentSchedulePage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <RepaymentScheduleListing
          title="Loan Repayment Schedule Report"
          subtitle="Future repayment plan for all active loans"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
