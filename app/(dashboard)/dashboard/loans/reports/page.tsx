// app/dashboard/loans/reports/page.tsx
import { Suspense } from "react";
import { getAuthUser } from "@/config/useAuth";
import { TableLoading } from "@/components/ui/data-table";
import LoanReportsHub from "./LoanReportsHub";

export const dynamic = "force-dynamic";

export default function LoanReportsPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <LoanReportsHubWithAuth />
      </Suspense>
    </div>
  );
}

async function LoanReportsHubWithAuth() {
  const user = await getAuthUser();

  return (
    <LoanReportsHub
      userRole={user?.role ?? "MEMBER"}
      userName={user?.name ?? "User"}
    />
  );
}
