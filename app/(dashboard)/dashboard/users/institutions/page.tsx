"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import InstitutionsListing from "./components/InstitutionsListing";
import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "../../reports/activity/component/Alert";

export default function InstitutionsPage() {
  const { data: session } = useSession();
  const [institutions, setInstitutions] = useState([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [instResp, branchesResp] = await Promise.all([
        axios.get("/api/v1/lookups/institutions"),
        axios.get("/api/v1/lookups/branches")
      ]);

      if (instResp.data.success && branchesResp.data.success) {
        let fetchedInstitutions = instResp.data.data || [];
        
        // Filter by branch if not ADMIN
        const userRole = (session?.user as any)?.role;
        const userBranchId = (session?.user as any)?.branchId;

        if (userRole !== "ADMIN" && userBranchId) {
          fetchedInstitutions = fetchedInstitutions.filter((inst: any) => inst.user?.branchId === userBranchId);
        }

        setInstitutions(fetchedInstitutions);
        setBranches(branchesResp.data.data || []);
      } else {
        throw new Error(instResp.data.error || branchesResp.data.error || "Failed to fetch data");
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [session]);

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

  const userBranch = branches.find((b: any) => b.id === session?.user?.branchId);
  const branchName = userBranch?.name || "your branch";
  const userRole = (session?.user as any)?.role;

  let subtitle = "";
  if (userRole === "ADMIN") {
    subtitle = "Register, review, approve and manage all institutions across all branches";
  } else {
    subtitle = `Viewing and managing institutions for ${branchName} only`;
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
       {userRole !== "ADMIN" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You are viewing institutions for <strong>{branchName}</strong> only.
            You can only create and manage institutions within your branch.
          </AlertDescription>
        </Alert>
      )}

      <InstitutionsListing
        title={`Institutions (${institutions.length})`}
        subtitle={subtitle}
        institutions={institutions}
        branchId={session?.user?.branchId ?? ""}
        role={userRole ?? "TELLER"}
        branches={branches}
      />
    </div>
  );
}
