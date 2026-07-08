// app/(dashboard)/dashboard/accounts/penalty-collection/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import PenaltyCollectionManagement from "./components/PenaltyCollectionManagement";

export const dynamic = "force-dynamic";

export default async function PenaltyCollectionPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <PenaltyCollectionManagement
          title="Penalty Collections"
          subtitle="Manage and track loan penalty charges and collections"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}