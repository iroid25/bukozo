"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import LoanListing from "./components/LoanListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["BRANCHMANAGER", "LOANOFFICER", "ADMIN", "SUPERADMIN"] as const;

export default function LoansPage() {
  const { data: session, status } = useSession();
  const [loans, setLoans] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const isTeller = session?.user?.role === "TELLER";
      const tellerId = session?.user?.id;
      
      const params = new URLSearchParams();
      // Only show Disbursed and Overdue loans in the "Active Loans" section
      params.append("status", "DISBURSED,OVERDUE");
      
      // If TELLER, by default show their assigned loans to ensure they see them.
      if (isTeller && tellerId) {
        params.append("allocatedTellerId", tellerId);
      }

      const [loansResp, statsResp] = await Promise.all([
        axios.get(`/api/v1/loans?${params.toString()}`),
        axios.get("/api/v1/loans/stats")
      ]);

      if (loansResp.data.success && statsResp.data.success) {
        setLoans(loansResp.data.data);
        setStatistics(statsResp.data.data);
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
    if (status === "unauthenticated") {
        redirect("/login");
    }
    if (session?.user && !ALLOWED_ROLES.includes(session.user.role as any)) {
        redirect("/dashboard");
    }
    if (status === "authenticated") {
        fetchData();
    }
  }, [fetchData, status, session]);

  if (loading || status === "loading") {
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
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error || "Statistics not loaded"}</p>
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
    <div className="flex h-full flex-1 flex-col gap-5 rounded-xl p-4">
      <LoanListing
        title={`Active Loans (${loans.length})`}
        subtitle="Manage Active Member Loans & Repayments"
        loans={loans || []}
        statistics={statistics}
        userRole={session?.user?.role ?? "TELLER"}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
