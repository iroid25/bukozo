"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DataEntrantDashboardView from "./components/DataEntrantDashboardView";
import { RefreshCw } from "lucide-react";

function DataEntrantDashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="h-20 w-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center shadow-inner">
            <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-indigo-500 rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Loading Workspace...</h2>
          <p className="text-slate-500 font-medium mt-1">Preparing your data entry dashboard</p>
        </div>
      </div>
    </div>
  );
}

export default function DataEntrantDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (role !== "DATA_ENTRANT") { router.push("/dashboard"); return; }

    fetch("/api/v1/data-entrant/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load dashboard");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load dashboard"); setLoading(false); });
  }, [session, status, router]);

  if (loading) return <DataEntrantDashboardLoading />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 max-w-md">
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Error</h2>
          <p className="text-red-600 mb-6">{error || "Failed to load your data entry workspace."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <DataEntrantDashboardView data={data} />
    </div>
  );
}
