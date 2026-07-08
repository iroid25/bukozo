"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowRightLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserListing from "../components/UserListing";
import BranchTransferModal from "./components/BranchTransferModal";

function getFingerprintStatus(template: string | null | undefined): "native" | "legacy" | "none" {
  if (!template) return "none";
  // SG400 native template: 400 bytes → 536 base64 chars with == padding
  if (template.length === 536 && template.endsWith("==")) return "native";
  return "legacy";
}

export const dynamic = "force-dynamic";

export default function MembersPage() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferMember, setTransferMember] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [membersResp, branchesResp] = await Promise.all([
        fetch("/api/v1/members"),
        fetch("/api/v1/lookups/branches"),
      ]);

      const membersData = await membersResp.json();
      const branchesData = await branchesResp.json();

      if (!membersResp.ok) {
        throw new Error(membersData?.error || "Failed to fetch members");
      }

      if (!branchesResp.ok) {
        throw new Error(branchesData?.error || "Failed to fetch branches");
      }

      const memberRows = Array.isArray(membersData)
        ? membersData
        : Array.isArray(membersData?.data)
          ? membersData.data
          : [];

      const transformedMembers = memberRows.map((m: any) => ({
        ...m.user,
        role: m.user?.role ?? "MEMBER",
        isActive: m.user?.isActive ?? true,
        member: {
          id: m.id,
          fingerprintStatus: getFingerprintStatus(m.fingerprintTemplate),
        },
        branch: m.user?.branch
          ? {
              name: m.user.branch.name,
            }
          : null,
        branchId: m.user?.branchId ?? m.user?.branch?.id ?? m.branchId,
        createdAt: m.user?.createdAt ? new Date(m.user.createdAt) : new Date(),
      }));

      setMembers(transformedMembers);
      setBranches(Array.isArray(branchesData) ? branchesData : branchesData.data || []);
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

  const userRole = (session?.user as any)?.role;
  const isAdminOrManager = userRole === "ADMIN" || userRole === "BRANCHMANAGER";

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <UserListing
        branches={branches}
        tableRole="MEMBER"
        title={`Members (${members.length})`}
        subtitle="Manage Members"
        users={members}
        branchId={(session?.user as any)?.branchId ?? ""}
        role={userRole ?? "TELLER"}
        extraActions={
          isAdminOrManager
            ? (user: any) => (
                <Button
                  variant="outline"
                  size="icon"
                  title="Transfer Branch"
                  onClick={() => setTransferMember(user)}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              )
            : undefined
        }
      />

      <BranchTransferModal
        open={!!transferMember}
        member={transferMember}
        branches={branches}
        onClose={() => setTransferMember(null)}
      />
    </div>
  );
}
