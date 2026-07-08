"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import BranchReserveDashboard from "./components/BranchReserveDashboard";

export default function ReservePageClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/dashboard/reserve", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          if (response.status === 403) {
            throw new Error(
              "You do not have access to Branch Reserve. Use an Accountant, Branch Manager, or Admin account.",
            );
          }
          throw new Error(result.error || "Failed to load reserve dashboard");
        }

        setData(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load reserve dashboard";
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
        {error || "Failed to load reserve dashboard"}
      </div>
    );
  }

  return (
    <BranchReserveDashboard
      user={{
        id: data.currentUserId,
        role: data.userRole,
        branchId: data.branchId,
      }}
      branches={data.branches || []}
      pendingAllocations={data.pendingAllocations || []}
      organisationalReserve={data.organisationalReserve}
      accountantVault={data.accountantVault}
      history={data.history || []}
    />
  );
}
