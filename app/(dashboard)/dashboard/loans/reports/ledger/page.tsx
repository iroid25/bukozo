// app/(dashboard)/dashboard/loans/reports/ledger/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import LedgerCardListing from "./components/LoanLedgerCardListing";

export const dynamic = "force-dynamic";

export default async function LoanLedgerCardPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LedgerCardListing
          title="Loan Ledger Card Report"
          subtitle="Complete historical transaction records for all loan accounts"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
