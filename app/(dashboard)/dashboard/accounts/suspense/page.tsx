"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminSuspenseView from "./components/AdminSuspenseView";
import BranchSuspenseView from "./components/BranchSuspenseView";

export default function SuspenseAccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/sign-in"); return; }

    fetch("/api/v1/accounts/suspense")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status, router]);

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading suspense account data...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.noBranch) {
    return (
      <div className="px-5 py-4">
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              You are not assigned to a branch. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      {data.isAdmin ? (
        <AdminSuspenseView
          companySummary={data.companySummary}
          statistics={data.statistics}
          currentUser={data.currentUser}
        />
      ) : (
        <BranchSuspenseView
          branchSummary={data.branchSummary}
          statistics={data.statistics}
          currentUser={data.currentUser}
        />
      )}
    </div>
  );
}
