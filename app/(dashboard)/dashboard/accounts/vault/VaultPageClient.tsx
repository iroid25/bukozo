"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import VaultDashboard from "./VaultDashboard";

export default function VaultPageClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/dashboard/accounts-vault", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load vault dashboard");
        }

        setData(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load vault dashboard";
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
    return <div className="p-4 text-sm text-red-600">{error || "Failed to load vault dashboard"}</div>;
  }

  const vault = data.vaultData;

  if (!vault) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Vault not initialized</h2>
        <p className="mt-2 text-sm text-slate-600">
          The central reserve vault does not exist yet. Create it or refresh after initialization.
        </p>
      </div>
    );
  }

  return (
    <VaultDashboard
      vault={vault}
      accountantId={data.currentUserId}
      userRole={data.userRole}
      branches={data.branches || []}
    />
  );
}
