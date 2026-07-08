// app/(dashboard)/dashboard/loans/reports/penalty-collection/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import PenaltyCollectionListing from "./components/PenaltyCollectionListing";

export const dynamic = "force-dynamic";

export default async function PenaltyCollectionPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <PenaltyCollectionListing
          title="Penalty Collections"
          subtitle="Track penalty charges and collections as loan income"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}