"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import HoldListing from "./components/HoldListing";

export default function HoldsPage() {
  const { data: session } = useSession();
  const [holds, setHolds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHolds() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/holds");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load holds");
      setHolds(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHolds(); }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading holds...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load account holds.<br />{error}</div>;

  return (
    <div className="p-6">
      <HoldListing holds={holds} userId={(session?.user as any)?.id ?? ""} onRefresh={fetchHolds} />
    </div>
  );
}
