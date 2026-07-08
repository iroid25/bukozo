"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import TransactionListing from "./components/TransactionListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TransactionsPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [txResponse, statsResponse] = await Promise.all([
        axios.get("/api/v1/transactions"),
        axios.get("/api/v1/transactions/stats")
      ]);

      if (txResponse.data.success && statsResponse.data.success) {
        setTransactions(txResponse.data.data);
        setStatistics(statsResponse.data.data);
      } else {
        throw new Error("Failed to fetch data");
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

  if (loading) {
    return <TableLoading />;
  }

  if (error || !statistics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-red-50 text-red-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">Fetch failed</h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error || "Unable to load transactions."}</p>
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
      <TransactionListing
        title={`All Transactions (${transactions.length})`}
        subtitle="Monitor All Member Transactions & Account Activities"
        transactions={transactions}
        statistics={statistics}
        userRole={session?.user?.role ?? "TELLER"}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
