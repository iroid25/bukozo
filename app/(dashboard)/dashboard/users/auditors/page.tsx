"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TableLoading } from "@/components/ui/data-table";
import UserListing from "../components/UserListing";

export default function AuditorsPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [usersRes, branchesRes] = await Promise.all([
        fetch("/api/v1/users?role=AUDITOR"),
        fetch("/api/v1/branches"),
      ]);
      setUsers((await usersRes.json()).data || []);
      setBranches((await branchesRes.json()).data || []);
      setLoading(false);
    }
    load();
  }, []);

  const currentUser = session?.user as any;

  if (loading) return <TableLoading />;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <UserListing
        branches={branches}
        tableRole="AUDITOR"
        title={`Auditors (${users.length})`}
        subtitle="Manage Auditors"
        users={users}
        branchId={currentUser?.branchId ?? ""}
        role={currentUser?.role ?? "TELLER"}
      />
    </div>
  );
}
