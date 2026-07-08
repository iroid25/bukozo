// app/(dashboard)/dashboard/loans/reports/dues-vs-repayment/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import DuesVsRepaymentListing from "./components/DuesVsRepaymentListing";

export const dynamic = "force-dynamic";

export default async function DuesVsRepaymentPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <DuesVsRepaymentListing
          title="Dues vs Repayment"
          subtitle="Comparison of expected collections vs actual repayments"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
