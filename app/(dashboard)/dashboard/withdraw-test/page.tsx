import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import WithdrawalListingTest from "./WithdrawListingTest";
import { serverFetch } from "@/lib/server-fetch";

async function getWithdrawals() {
  try {
    const res = await serverFetch("/api/v1/withdraw-test");
    if (!res.ok) {
      const text = await res.text();
      console.error("Withdrawal API error:", res.status, text);
      return { success: false, data: { withdrawals: [], statistics: null }, error: `API Error: ${res.status}` };
    }
    const json = await res.json();
    const withdrawals =
      json?.data?.withdrawals ??
      json?.withdrawals ??
      json?.data ??
      [];
    const statistics =
      json?.data?.statistics ??
      json?.statistics ??
      null;

    return {
      success: true,
      data: {
        withdrawals: Array.isArray(withdrawals) ? withdrawals : [],
        statistics,
      },
    };
  } catch (error: any) {
    console.error("Error fetching withdrawals:", error);
    return { success: false, data: { withdrawals: [], statistics: null }, error: error.message || "Failed to fetch withdrawals" };
  }
}

async function getWithdrawalStats() {
  try {
    const res = await serverFetch("/api/v1/withdrawals/stats");
    if (!res.ok) {
      return {
        success: false,
        data: {
          today: { amount: 0, count: { id: 0 } },
          thisMonth: { amount: 0, count: { id: 0 } },
          total: { amount: 0, count: { id: 0 } },
        },
      };
    }
    return await res.json();
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

  const withdrawals = withdrawalsResult.data?.withdrawals ?? [];
  const statistics =
    withdrawalsResult.data?.statistics ??
    statisticsResult.data;
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
