"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ActivityReportsClient from "./component/ActivityReportsClient";
import { toast } from "sonner";
import {
  EMPTY_ACTIVITY_STATS,
  type ActivityRecord,
  type ActivityStats,
} from "@/lib/reports/activity-types";

export default function ActivityReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [statistics, setStatistics] = useState<ActivityStats | null>(null);
  const sessionBranchId = session?.user?.branchId || undefined;
  const sessionBranchName = session?.user?.branchName || undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch activity data from new API endpoints
      const branchQuery = !isAdmin && sessionBranchId ? `&branchId=${encodeURIComponent(sessionBranchId)}` : "";
      const [activitiesRes, statsRes] = await Promise.all([
        fetch(
          `/api/v1/reports/activity?limit=100&orderBy=createdAt&orderDirection=desc${branchQuery}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        ),
        fetch(`/api/v1/reports/activity/statistics${branchQuery}`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (!activitiesRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch activity data");
      }

      const activitiesData = await activitiesRes.json();
      const statsData = await statsRes.json();

      setActivities(activitiesData.data || []);
      setStatistics(statsData.data);
    } catch (err) {
      console.error("Error fetching activity reports:", err);
      setError(err instanceof Error ? err.message : "Failed to load activity reports");
      toast.error("Failed to load activity reports");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
      <ActivityReportsClient
      activities={activities}
      statistics={statistics ?? EMPTY_ACTIVITY_STATS}
      userRole={session.user.role || "MEMBER"}
      currentUserId={session.user.id}
      currentUserBranchId={sessionBranchId}
      currentUserBranchName={sessionBranchName}
      title="Audit Trail Report Customer Information"
      subtitle="System activity tracking and audit logs"
    />
  );
}
