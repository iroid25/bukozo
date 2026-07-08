// app/dashboard/reports/loans/daily-demand/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import DailyDemandSheetListing from "./components/DailyDemandSheetListing";

export const dynamic = "force-dynamic";

export default async function DailyDemandSheetPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <DailyDemandSheetListing
          title="Daily Demand Sheet"
          subtitle="View daily loan repayments due and collected"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
