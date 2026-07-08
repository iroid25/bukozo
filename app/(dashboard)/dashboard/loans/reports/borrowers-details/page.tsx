// app/dashboard/reports/loans/borrowers-details/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import BorrowersDetailsListing from "./components/BorrowersDetailsListing";

export const dynamic = "force-dynamic";

export default async function BorrowersDetailsPage() {
  const user = await getAuthUser();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <BorrowersDetailsListing
          title="Borrowers Details"
          subtitle="Comprehensive list of members with loan details"
          initialRole={user?.role ?? "TELLER"}
        />
      </Suspense>
    </div>
  );
}
