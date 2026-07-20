import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import WithdrawalListingTest from "./WithdrawListingTest";
import {
  getAllWithdrawalsTest,
  getWithdrawalTestStatistics,
} from "@/actions/withdrawsTest";

async function getWithdrawals() {
  try {
    return await getAllWithdrawalsTest();
  } catch (error: any) {
    console.error("Error fetching withdrawals:", error);
    return { success: false, data: { withdrawals: [], statistics: null }, error: error.message || "Failed to fetch withdrawals" };
  }
}

async function getWithdrawalStats() {
  try {
    return await getWithdrawalTestStatistics();
  } catch (error: any) {
    console.error("Error fetching withdrawal stats:", error);
    return {
      success: false,
      data: {
        today: { amount: 0, count: { id: 0 } },
        thisMonth: { amount: 0, count: { id: 0 } },
        total: { amount: 0, count: { id: 0 } },
      },
    };
  }
}

async function WithdrawalListingWithData() {
  const [withdrawalsResult, statisticsResult, user] = await Promise.all([
    getWithdrawals(),
    getWithdrawalStats(),
    getAuthUser(),
  ]);

  if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-orange-600">Authentication Required</h2>
        <p className="text-sm text-muted-foreground">Please log in to view withdrawals.</p>
      </div>
    );
  }

  if (!withdrawalsResult.success) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-red-600">Error Loading Withdrawals</h2>
        <p className="text-sm text-muted-foreground">
          {withdrawalsResult.error || "Failed to fetch withdrawals. Please refresh the page."}
        </p>
      </div>
    );
  }

  const withdrawals = Array.isArray((withdrawalsResult as any).data)
    ? (withdrawalsResult as any).data
    : [];
  const statistics = (statisticsResult as any).data ?? {
    today: { amount: 0, count: { id: 0 } },
    thisMonth: { amount: 0, count: { id: 0 } },
    total: { amount: 0, count: { id: 0 } },
  };
  const userRole = user?.role ?? "TELLER";
  const currentUserId = user?.id ?? "";

  return (
    <WithdrawalListingTest
      withdrawals={withdrawals}
      title="Withdrawals"
      subtitle="All member cash-outs"
      statistics={statistics}
      userRole={userRole}
      currentUserId={currentUserId}
    />
  );
}

export default function WithdrawalsPage() {
  return (
    <Suspense fallback={<TableLoading />}>
      <WithdrawalListingWithData />
    </Suspense>
  );
}
