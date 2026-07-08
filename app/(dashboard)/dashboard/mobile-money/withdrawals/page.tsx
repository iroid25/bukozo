"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MobileMoneyWithdrawalListing from "./components/MobileMoneyWithdrawalListing";

export default function MobileMoneyWithdrawalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<{ withdrawals: any[]; statistics: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }

    fetch("/api/v1/mobile-money/withdrawals")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status, router]);

  if (loading || status === "loading") {
    return <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 items-center justify-center text-slate-500">Loading...</div>;
  }

  const withdrawals = data?.withdrawals || [];
  const statistics = data?.statistics;
  const user = session?.user as any;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <MobileMoneyWithdrawalListing
        title={`Mobile Money Withdrawals (${withdrawals.length})`}
        subtitle="Manage Mobile Money Account Withdrawals"
        withdrawals={withdrawals}
        statistics={statistics}
        userRole={user?.role ?? "TELLER"}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
