"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TableLoading } from "@/components/ui/data-table";
import UserListing from "../components/UserListing";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";

export default function TellersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [usersRes, branchesRes] = await Promise.all([
        fetch("/api/v1/users?role=TELLER"),
        fetch("/api/v1/branches"),
      ]);
      const usersJson = await usersRes.json();
      const branchesJson = await branchesRes.json();
      setUsers(usersJson.data || []);
      setBranches(branchesJson.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const currentUser = session?.user as any;

  if (loading) return <TableLoading />;

  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            User Management
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Tellers</h1>
          <p className="max-w-2xl text-muted-foreground">
            Manage teller records, branch assignments, and performance access from one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/analytics/tellers">
              <ArrowRight className="mr-2 h-4 w-4" />
              View Teller Performance
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/users/tellers/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Teller
            </Link>
          </Button>
        </div>
      </div>
      <UserListing
        tableRole="TELLER"
        title={`Tellers (${users.length})`}
        subtitle="Manage tellers"
        users={users}
        branchId={currentUser?.branchId ?? ""}
        role={currentUser?.role ?? "TELLER"}
        branches={branches}
      />
    </div>
  );
}
