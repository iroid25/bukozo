"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import UserListing from "./components/UserListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Users() {
  const { data: session } = useSession();
  const [members, setMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [membersResp, branchesResp] = await Promise.all([
        axios.get("/api/v1/lookups/members?all=true"),
        axios.get("/api/v1/lookups/branches")
      ]);

      if (membersResp.data.success && branchesResp.data.success) {
        setMembers(membersResp.data.data);
        setBranches(branchesResp.data.data);
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
        branches={branches}
        tableRole="ADMIN"
        title={`Members (${members.length})`}
        subtitle="Manage Members"
        users={members}
        branchId={session?.user?.branchId ?? ""}
        role={session?.user?.role ?? "TELLER"}
      />
    </div>
  );
}
