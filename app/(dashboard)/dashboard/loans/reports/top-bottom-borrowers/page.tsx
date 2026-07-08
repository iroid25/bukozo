// app/dashboard/reports/loans/top-bottom-borrowers/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import TopBorrowersListing from "./components/TopBorrowersListing";

export const dynamic = "force-dynamic";

export default async function TopBottomBorrowersPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <TopBorrowersListing
          title="Top & Bottom Borrowers"
          subtitle="Analysis of members with most and least credit activity"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
