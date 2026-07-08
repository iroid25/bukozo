"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoanWriteOffClient from "./LoanWriteOffClient";

export default function LoanWriteOffsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [writeOffs, setWriteOffs] = useState<any[]>([]);
  const [eligibleLoans, setEligibleLoans] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    const allowedRoles = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "AUDITOR"];
    if (!allowedRoles.includes(role)) { router.push("/dashboard"); return; }

    async function load() {
      const [woRes, elRes, stRes] = await Promise.all([
        fetch("/api/v1/loan-write-offs"),
        fetch("/api/v1/loan-write-offs/eligible"),
        fetch("/api/v1/loan-write-offs/statistics"),
      ]);
      const [wo, el, st] = await Promise.all([woRes.json(), elRes.json(), stRes.json()]);
      setWriteOffs(wo.data || []);
      setEligibleLoans(el.data || []);
      setStatistics(st.data);
      setLoading(false);
    }
    load();
  }, [session, status, router]);

  if (loading) return <div className="container mx-auto py-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Write-Offs</h1>
          <p className="text-muted-foreground mt-1">Manage loan write-off requests and approvals</p>
        </div>
      </div>
      <LoanWriteOffClient
        writeOffs={writeOffs}
        eligibleLoans={eligibleLoans}
        statistics={statistics}
        currentUserRole={(session?.user as any)?.role ?? "LOANOFFICER"}
      />
    </div>
  );
}
