"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import MemberAccountDashboard from "./components/MemberAccountDashboard";

export default function MyAccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }

    const user = session.user as any;
    if (user.role !== "MEMBER") { router.push("/dashboard"); return; }

    fetch("/api/v1/members/me/account-dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(true);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [session, status, router]);

  if (loading || status === "loading") {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load account data</h2>
          <p className="text-gray-600 mb-4">There was an error loading your account information. Please try again later.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <MemberAccountDashboard
        member={data.member}
        accountOverview={data.accountOverview}
        loanSummary={data.loanSummary}
        recentTransactions={data.recentTransactions}
        currentUserId={data.currentUserId}
      />
    </div>
  );
}
