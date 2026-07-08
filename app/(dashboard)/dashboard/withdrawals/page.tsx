"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TableLoading } from "@/components/ui/data-table";
import WithdrawalListing from "./components/WithdrawListing";

export default function WithdrawalsPage() {
  const { data: session } = useSession();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/withdrawals");
      const json = await res.json();
      const data = json.data || [];
      setWithdrawals(data);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const todayItems = data.filter((w: any) => new Date(w.createdAt) >= startOfToday);
      const monthItems = data.filter((w: any) => new Date(w.createdAt) >= startOfMonth);

      setStatistics({
        today: { amount: todayItems.reduce((s: number, w: any) => s + Number(w.amount || 0), 0), count: { id: todayItems.length } },
        thisMonth: { amount: monthItems.reduce((s: number, w: any) => s + Number(w.amount || 0), 0), count: { id: monthItems.length } },
        total: { amount: data.reduce((s: number, w: any) => s + Number(w.amount || 0), 0), count: { id: data.length } },
      });

      setLoading(false);
    }
    load();
  }, []);

  const currentUser = session?.user as any;

  if (loading) return <TableLoading />;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <WithdrawalListing
        title={`Withdrawals (${withdrawals.length})`}
        subtitle="Manage Member Account Withdrawals"
        withdrawals={withdrawals}
        statistics={statistics}
        userRole={currentUser?.role ?? "TELLER"}
        currentUserId={currentUser?.id ?? ""}
      />
    </div>
  );
}
