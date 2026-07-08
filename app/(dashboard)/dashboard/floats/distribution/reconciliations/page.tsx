import { Suspense } from "react";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import ReconciliationsListing from "./ReconciliationListing";
import { serverFetch } from "@/lib/server-fetch";

async function ReconciliationsPageContent() {
  const user = await getAuthUser();

  if (!user) redirect("/login");
  if (user.role !== "ACCOUNTANT" && user.role !== "ADMIN") redirect("/dashboard");

  const res = await serverFetch("/api/v1/floats/reconciliations");
  const json = res.ok ? await res.json() : { success: false, data: null };

  const safeData = {
    pending: json.data?.pending ?? [],
    approved: json.data?.approved ?? [],
    rejected: json.data?.rejected ?? [],
  };

  return (
    <ReconciliationsListing
      pendingReconciliations={safeData.pending}
      approvedReconciliations={safeData.approved}
      rejectedReconciliations={safeData.rejected}
      userId={user.id}
    />
  );
}

export default function ReconciliationsPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<div className="p-4">Loading reconciliations...</div>}>
        <ReconciliationsPageContent />
      </Suspense>
    </div>
  );
}
