"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import UserListing from "../components/UserListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Accountants() {
  const { data: session } = useSession();
  const [accountants, setAccountants] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔍 Fetching accountants and branches...");
      
      const [usersResp, branchesResp] = await Promise.all([
        axios.get("/api/v1/users?role=ACCOUNTANT"),
        axios.get("/api/v1/lookups/branches")
      ]);

      console.log("📦 Users Response:", usersResp.data);
      console.log("📦 Branches Response:", branchesResp.data);

      const rolesOk = usersResp.data.success || Array.isArray(usersResp.data.data);
      const branchesOk = branchesResp.data.success || Array.isArray(branchesResp.data.data);

      if (rolesOk && branchesOk) {
        setAccountants(usersResp.data.data || []);
        setBranches(branchesResp.data.data || []);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err: any) {
      console.error("❌ Fetch Error:", err);
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-red-50 text-red-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">Fetch failed</h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error}</p>
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
      <UserListing
        tableRole="ACCOUNTANT"
        title={`Accountants (${accountants.length})`}
        subtitle="Manage accountants"
        users={accountants}
        branchId={session?.user?.branchId ?? ""}
        role={session?.user?.role ?? "ACCOUNTANT"}
        branches={branches}
      />
    </div>
  );
}
