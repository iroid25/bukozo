// app/(dashboard)/dashboard/loans/reports/written-off-repayments/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import WrittenOffRepaymentsListing from "./components/WrittenOffRepaymentsListing";

export const dynamic = "force-dynamic";

export default async function WrittenOffRepaymentsPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <WrittenOffRepaymentsListing
          title="Written Off Repayments"
          subtitle="Analysis of payments received against written off loan accounts"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
