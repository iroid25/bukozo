"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import BranchManagerDetailsView from "./BranchManagerDetailsView";

export default function BranchManagerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [branchManager, setBranchManager] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [userRes, branchesRes] = await Promise.all([
        fetch(`/api/v1/users/${id}`),
        fetch("/api/v1/branches"),
      ]);
      const userJson = await userRes.json();
      const branchesJson = await branchesRes.json();
      setBranchManager(userJson.data || null);
      setBranches(branchesJson.data || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!branchManager || branchManager.role !== "BRANCHMANAGER") return notFound();

  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6">
      <BranchManagerDetailsView
        branchManager={branchManager}
        currentUser={session?.user as any}
        branches={branches}
      />
    </div>
  );
}
