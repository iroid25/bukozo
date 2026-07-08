"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MobileLoanRepaymentListing from "./components/MobileLoanRepaymentListing";

export default function MobileLoanRepaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<{ repayments: any[]; statistics: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }

    fetch("/api/v1/mobile-money/loan-repayments")
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

  const repayments = data?.repayments || [];
  const statistics = data?.statistics;
  const user = session?.user as any;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <MobileLoanRepaymentListing
        title={`Mobile Money Loan Repayments (${repayments.length})`}
        subtitle="Manage Mobile Money Loan Repayments"
        repayments={repayments}
        statistics={statistics}
        userRole={user?.role ?? "TELLER"}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
