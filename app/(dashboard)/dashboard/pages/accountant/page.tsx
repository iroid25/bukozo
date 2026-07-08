"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import AccountantDashboardView from "./components/AccountantDashboardView";
import AccountantDashboardLoading from "./components/AccountantDashboardLoading";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

export default function AccountantPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const response = await axios.get("/api/v1/accountant/dashboard");
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.error || "Failed to fetch dashboard data");
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return <AccountantDashboardLoading />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-indigo-50 text-indigo-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">Sync Failed</h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error || "We couldn't reach the financial monitoring service."}</p>
        </div>
        <Button 
          onClick={() => fetchDashboardData()} 
          className="bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl px-8"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-establish Connection
        </Button>
      </div>
    );
  }

  return (
    <AccountantDashboardView 
      data={data} 
      onRefresh={() => fetchDashboardData(true)} 
      refreshing={refreshing} 
    />
  );
}
