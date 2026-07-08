import { getAuthUser } from "@/config/useAuth";
import GLPerformanceClient from "./components/GLPerformanceClient";

export default async function GLPerformanceReportPage() {
  const user = await getAuthUser();


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">GL Account Performance</h2>
      </div>
      <div className="hidden items-center space-x-2 md:flex">
        <p className="text-muted-foreground">
          Query the performance of specific General Ledger accounts over time.
        </p>
      </div>

      <GLPerformanceClient
        userRole={user?.role || "MEMBER"}
        userBranchId={user?.branchId || ""}
      />
    </div>
  );
}
