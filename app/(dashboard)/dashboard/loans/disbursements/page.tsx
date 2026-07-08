"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import DisbursementListing from "./components/DisbursementListing";

export default function DisbursementRequestsPage() {
  const { data: session, status } = useSession();
  const [pendingLoans, setPendingLoans] = useState([]);
  const [disbursedLoans, setDisbursedLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);

      const isTeller = session.user.role === "TELLER";
      const tellerId = session.user.id;
      
      // Base params
      const pendingParams = new URLSearchParams();
      pendingParams.append("status", "APPROVED");
      
      const historyParams = new URLSearchParams();
      historyParams.append("status", "DISBURSED,REPAID,OVERDUE"); // Include all post-disbursement statuses
      
      // Filter by teller if applicable
      if (isTeller) {
        pendingParams.append("allocatedTellerId", tellerId);
        historyParams.append("allocatedTellerId", tellerId);
      }

      // Fetch both sets of data
      const [pendingResp, historyResp] = await Promise.all([
        axios.get(`/api/v1/loans?${pendingParams.toString()}`),
        axios.get(`/api/v1/loans?${historyParams.toString()}`)
      ]);

      if (pendingResp.data.success) {
        setPendingLoans(pendingResp.data.data);
      }
      
      if (historyResp.data.success) {
        setDisbursedLoans(historyResp.data.data);
      }

    } catch (error) {
      console.error("Failed to fetch disbursement data:", error);
      toast.error("Failed to load disbursement requests");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <DisbursementListing 
        pendingLoans={pendingLoans}
        disbursedLoans={disbursedLoans}
        userRole={session?.user?.role || ""}
      />
    </div>
  );
}
