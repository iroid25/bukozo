// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import WithdrawalListingTest from "../WithdrawListingTest";

function TodaysWithdrawalsWithData() {
  const { data: session } = useSession();
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/withdraw-test")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAllWithdrawals(json.data.withdrawals || []);
          setStatistics(json.data.statistics);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const user = session?.user as any;

  if (loading || !statistics) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  // Filter withdrawals for today only
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));

  const todaysWithdrawals = (allWithdrawals as any[]).filter((withdrawal: any) => {
    const withdrawalDate = new Date(withdrawal.withdrawalDate);
    return withdrawalDate >= startOfDay;
  });

  // Create today-only statistics
  const todayStats = {
    today: statistics.today,
    thisMonth: {
      amount: 0,
      count: { id: 0 },
    },
    total: {
      amount: 0,
      count: { id: 0 },
    },
  };

  return (
    <WithdrawalListingTest
      withdrawals={todaysWithdrawals}
      title="Today's Withdrawals"
      subtitle={`All withdrawal transactions made today (${todaysWithdrawals.length} transactions)`}
      statistics={todayStats}
      userRole={user?.role}
      currentUserId={user?.id || ""}
    />
  );
}

export default function TodaysWithdrawalsPage() {
  return <TodaysWithdrawalsWithData />;
}
