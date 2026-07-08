"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ReconciliationDetailsClient from "./ReconciliationDetailsClient";

export default function ReconciliationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }

    fetch(`/api/v1/reconciliations/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) { router.push("/not-found"); return; }
        setReconciliation(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, session, status, router]);

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!reconciliation) return null;

  return (
    <ReconciliationDetailsClient
      reconciliation={reconciliation}
      currentUser={session?.user as any}
    />
  );
}
