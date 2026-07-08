"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TellerDashboardView } from "./components/TellerDashboardView";
import { RefreshCw } from "lucide-react";

function TellerDashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center shadow-inner">
            <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Syncing Station...</h2>
          <p className="text-slate-500 font-medium mt-1">Connecting to secure transaction ledger</p>
        </div>
      </div>
    </div>
  );
}

export default function TellerDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (role !== "TELLER") { router.push("/dashboard"); return; }

    fetch("/api/v1/teller/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "Failed to load dashboard");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load dashboard"); setLoading(false); });
  }, [session, status, router]);

  if (loading) return <TellerDashboardLoading />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 max-w-md">
          <h2 className="text-xl font-bold text-red-900 mb-2">Workspace Access Error</h2>
          <p className="text-red-600 mb-6">{error || "Failed to establish a secure connection to your teller station."}</p>
          <a href="/dashboard/pages/teller" className="inline-block px-6 py-2 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all text-center">
            Try Reconnecting
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <TellerDashboardView data={data} />
    </div>
  );
}
