"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import StatementListing from "./components/StatementListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StatementsPage() {
  const { data: session, status } = useSession();
  const [statements, setStatements] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statementsResp, statsResp] = await Promise.allSettled([
        axios.get("/api/v1/statements"),
        axios.get("/api/v1/statements/stats"),
      ]);

      if (
        statementsResp.status !== "fulfilled" ||
        !statementsResp.value.data?.success
      ) {
        const message =
          statementsResp.status === "fulfilled"
            ? statementsResp.value.data?.error || "Failed to fetch statements"
            : statementsResp.reason?.response?.data?.error ||
              statementsResp.reason?.message ||
              "Failed to fetch statements";
        throw new Error(message);
      }

      setStatements(statementsResp.value.data.data || []);

      if (
        statsResp.status === "fulfilled" &&
        statsResp.value.data?.success
      ) {
        setStatistics(statsResp.value.data.data);
      } else {
        setStatistics({
          totalStatements: statementsResp.value.data.data?.length || 0,
          generatedToday: 0,
          pendingGeneration: 0,
          failedGeneration: 0,
        } as any);
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || status === "loading") {
    return <TableLoading />;
  }

  if (error || !statistics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-indigo-50 text-indigo-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">Fetch failed</h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error || "Unable to load statements."}</p>
        </div>
        <Button 
          onClick={() => fetchData()} 
          className="bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl px-8"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <StatementListing
        title={`Bank Statements (${statements.length})`}
        subtitle="Generate and manage member and institution account statements"
        statements={statements || []}
        statistics={statistics}
        userRole={session?.user?.role ?? "TELLER"}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
