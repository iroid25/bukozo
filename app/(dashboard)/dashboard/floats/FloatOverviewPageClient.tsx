"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import FloatAllocationListing from "./floattwo/FloatAllocationListing";
import AccountantReconciliationPopup from "./distribution/reconciliations/components/AccountantReconciliationPopup";

export default function FloatOverviewPageClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/floats/overview", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load float overview");
        }

        setData(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load float overview";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <TableLoading />;
  if (error || !data) {
    return (
      <div className="p-4 text-sm text-red-600">
        {error || "Failed to load float overview"}
      </div>
    );
  }

  return (
    <>
      <AccountantReconciliationPopup
        accountantId={data.currentUserId}
        branchId={data.branchId || undefined}
      />
      <FloatAllocationListing
        floatAllocations={data.floatAllocations}
        eligibleUsers={data.eligibleUsers}
        branches={data.branches}
        title={`Float Allocations (${data.floatAllocations.length})`}
        subtitle={`Allocate Float to Tellers & Agents - ${data.eligibleCount} eligible for allocation`}
        statistics={data.statistics}
        currentUserId={data.currentUserId}
        pendingReconciliations={data.pendingReconciliations}
        vaultBalance={data.branchReserveBalance ?? data.vaultBalance}
        vaultId={data.branchReserveId ?? data.vaultId}
        vaultData={data.branchReserveVault ?? data.vaultData}
        orgReserveId={data.orgReserveId}
      />
    </>
  );
}
