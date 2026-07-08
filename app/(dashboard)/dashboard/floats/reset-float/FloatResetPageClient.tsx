"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import FloatResetListing from "./FloatResetListing";

export default function FloatResetPageClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/floats/reset", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load float reset data");
        }

        setData(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load float reset data";
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
        {error || "Failed to load float reset data"}
      </div>
    );
  }

  return (
    <FloatResetListing
      title={`Float Balance Management (${data.userFloats.length} Users)`}
      subtitle="Reset and manage float balances for tellers and agents"
      userFloats={data.userFloats}
      statistics={data.statistics}
      currentUserId={data.currentUserId}
      userRole={data.userRole}
    />
  );
}
