"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Loader2, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import TellerTrackingTable from "./components/TellerTrackingTable";

interface QueuePayload {
  loans: any[];
  reserveBalance: number;
  reserveLabel: string;
  reserveDescription: string;
}

async function fetchLoans(userRole: string, branchId?: string) {
  const params = new URLSearchParams({ status: "APPROVED" });
  if (userRole === "ADMIN" && branchId) {
    params.set("branchId", branchId);
  }

  const response = await fetch(`/api/v1/loans?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Failed to load disbursement queue");
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchReserve(userRole: string, branchId?: string) {
  if (userRole === "ADMIN" && !branchId) {
    const response = await fetch("/api/v1/dashboard/reserve", {
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Failed to load reserve balance");
    }

    return {
      reserveBalance: Number(payload.data?.organisationalReserve?.balance || 0),
      reserveLabel: "Organisational Reserve Balance",
      reserveDescription: "Manage and disburse loans from the organisational reserve.",
    };
  }

  const response = await fetch("/api/v1/vault/balance", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load branch reserve balance");
  }

  return {
    reserveBalance: Number(payload?.balance || 0),
    reserveLabel: "Branch Reserve Balance",
    reserveDescription: "Track and disburse loans assigned to your branch reserve.",
  };
}

export default function DisbursementQueueClient() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role || "";
  const branchId = (session?.user as any)?.branchId as string | undefined;
  const [state, setState] = useState<QueuePayload>({
    loans: [],
    reserveBalance: 0,
    reserveLabel: "Branch Reserve Balance",
    reserveDescription: "Track and disburse loans assigned to your branch reserve.",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (status !== "authenticated") {
        if (!active) return;
        setLoading(status === "loading");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [loans, reserve] = await Promise.all([
          fetchLoans(userRole, branchId),
          fetchReserve(userRole, branchId),
        ]);

        if (!active) return;

        setState({
          loans,
          ...reserve,
        });
      } catch (err) {
        if (!active) return;

        const message = err instanceof Error ? err.message : "Unable to load disbursement queue";
        setError(message);
        setState({
          loans: [],
          reserveBalance: 0,
          reserveLabel: "Branch Reserve Balance",
          reserveDescription: "Track and disburse loans assigned to your branch reserve.",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [branchId, status, userRole]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disbursement Queue</h1>
          <p className="text-muted-foreground">{state.reserveDescription}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2">
          <Wallet className="h-5 w-5 text-blue-600" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-blue-600">{state.reserveLabel}</span>
            <span className="text-lg font-bold text-blue-800">
              UGX {state.reserveBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load disbursement queue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <TellerTrackingTable loans={state.loans} currentReserve={state.reserveBalance} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
