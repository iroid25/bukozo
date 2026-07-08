"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import BranchDetailsView from "../components/BranchDetailsView";

function BranchDetailsLoading() {
  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-12" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function BranchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [branch, setBranch] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [branchRes, statsRes, usersRes] = await Promise.all([
        fetch(`/api/v1/branches/${id}`),
        fetch(`/api/v1/branches/${id}/statistics`),
        fetch(`/api/v1/branches/${id}/users`),
      ]);
      const branchJson = await branchRes.json();
      const statsJson = await statsRes.json();
      const usersJson = await usersRes.json();
      setBranch(branchJson.data);
      setStatistics(statsJson.data);
      setUsers(usersJson.data || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <BranchDetailsLoading />;
  if (!branch) return <div className="p-8 text-center text-gray-500">Branch not found.</div>;

  const userRole = (session?.user as any)?.role ?? "TELLER";

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <BranchDetailsView
        branch={branch}
        userRole={userRole}
        statistics={statistics}
        users={users}
      />
    </div>
  );
}
