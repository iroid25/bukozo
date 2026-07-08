"use client";

import { useState, useEffect, useCallback } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { useSession } from "next-auth/react";
import BranchListing from "./components/Branchlisting";
import { toast } from "sonner";

export default function BranchesPage() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [branchesResp, accountantsResp, managersResp] = await Promise.all([
        fetch("/api/v1/branches").then((r) => r.json()),
        fetch("/api/v1/users?role=ACCOUNTANT").then((r) => r.json()),
        fetch("/api/v1/users?role=BRANCHMANAGER").then((r) => r.json()),
      ]);

      if (branchesResp.data) setBranches(branchesResp.data);
      if (accountantsResp.success) setAccountants(accountantsResp.data);
      if (managersResp.success) setManagers(managersResp.data);
    } catch (error) {
      console.error("Error fetching branches data:", error);
      toast.error("Failed to load branches data");
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

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-5">
      <BranchListing
        title={`Branches (${branches.length})`}
        subtitle="Manage SACCO Branches"
        branches={branches}
        userRole={session?.user?.role ?? "ADMIN"}
        accountants={accountants}
        managers={managers}
        onRefresh={fetchData}
        isLoading={loading}
      />
    </div>
  );
}
