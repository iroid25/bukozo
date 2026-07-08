// app/dashboard/reports/loans/arrears/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import ArrearsListing from "./components/LoanArrearsListing";

export const dynamic = "force-dynamic";

export default async function ArrearsPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <ArrearsListing
          title="Loans in Arrears"
          subtitle="Monitor overdue loan accounts"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
