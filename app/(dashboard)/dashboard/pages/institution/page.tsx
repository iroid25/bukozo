"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import InstitutionDashboardContent from "./InstitutionDashboardContent";

export default function InstitutionDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (role !== "INSTITUTION") { router.push("/dashboard"); return; }

    fetch("/api/v1/institutions/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load dashboard");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load dashboard"); setLoading(false); });
  }, [session, status, router]);

  if (loading || status === "loading") {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 items-center justify-center">
        <div className="text-slate-500">Loading institution dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 items-center justify-center">
        <div className="text-red-600">{error || "Failed to load dashboard"}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <InstitutionDashboardContent
        transactions={data.transactions || []}
        statistics={data.statistics}
        institutionDetails={data.institutionDetails}
        userId={data.userId}
      />
    </div>
  );
}
