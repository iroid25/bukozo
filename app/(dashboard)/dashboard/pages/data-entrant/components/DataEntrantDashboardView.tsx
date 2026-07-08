"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  PiggyBank,
  UserPlus,
  Plus,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataEntrantDashboardData {
  user: {
    name: string;
    role: string;
    image?: string | null;
    branchId?: string | null;
  };
  stats: {
    totalMembers: number;
    membersRegisteredToday: number;
    totalAccounts: number;
    totalInstitutions: number;
    institutionsRegisteredToday: number;
    pendingApprovals: number;
  };
  recentMembers: any[];
}

export default function DataEntrantDashboardView({
  data,
}: {
  data: DataEntrantDashboardData;
}) {
  const router = useRouter();
  const { user, stats, recentMembers } = data;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Welcome back, {user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 mt-1">
            Your data entry workspace is ready.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-indigo-700 bg-indigo-50 border-indigo-200 px-4 py-1.5 text-sm font-semibold"
        >
          Data Entrant
        </Badge>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button
          onClick={() => router.push("/dashboard/users/members")}
          className="h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-base font-bold shadow-lg shadow-indigo-200 transition-all hover:shadow-xl"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Register New Member
        </Button>
        <Button
          onClick={() => router.push("/dashboard/users/institutions")}
          variant="outline"
          className="h-16 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-2xl text-base font-bold transition-all"
        >
          <Building2 className="h-5 w-5 mr-2" />
          Register Institution
        </Button>
        <Button
          onClick={() => router.push("/dashboard/accounts")}
          variant="outline"
          className="h-16 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-2xl text-base font-bold transition-all"
        >
          <PiggyBank className="h-5 w-5 mr-2" />
          View Member Accounts
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Members"
          value={stats.totalMembers}
          todayValue={stats.membersRegisteredToday}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Institutions"
          value={stats.totalInstitutions}
          todayValue={stats.institutionsRegisteredToday}
          icon={Building2}
          color="violet"
        />
        <StatCard
          title="Total Accounts"
          value={stats.totalAccounts}
          todayValue={null}
          icon={PiggyBank}
          color="emerald"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          todayValue={null}
          icon={CalendarDays}
          color="amber"
        />
      </div>

      {/* Recent Registrations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Registrations
            </h2>
            <p className="text-sm text-slate-500">
              Members you have recently registered
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/users/members")}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">
                  Name
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">
                  Phone
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">
                  Branch
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">
                  Accounts
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      No members registered yet
                    </p>
                    <p className="text-sm mt-1">
                      Click "Register New Member" to get started
                    </p>
                  </td>
                </tr>
              ) : (
                recentMembers.map((member: any) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">
                        {member.user?.name || "N/A"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {member.memberNumber}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {member.user?.phone || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {member.user?.branch?.name || "—"}
                    </td>
                    <td className="px-6 py-3">
                      {member.accounts?.length > 0 ? (
                        <span className="text-emerald-600 font-medium">
                          {member.accounts.length} account
                          {member.accounts.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs font-medium">
                          No accounts
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          member.status === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          member.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {member.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  todayValue,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  todayValue: number | null;
  icon: any;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string; badge: string }> = {
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-900",
      icon: "text-indigo-500",
      badge: "bg-indigo-100 text-indigo-600",
    },
    violet: {
      bg: "bg-violet-50",
      text: "text-violet-900",
      icon: "text-violet-500",
      badge: "bg-violet-100 text-violet-600",
    },
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      icon: "text-emerald-500",
      badge: "bg-emerald-100 text-emerald-600",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      icon: "text-amber-500",
      badge: "bg-amber-100 text-amber-600",
    },
  };

  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className={`${colors.bg} rounded-2xl p-5 border border-white/60 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`h-6 w-6 ${colors.icon}`} />
        {todayValue !== null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
            +{todayValue} today
          </span>
        )}
      </div>
      <p className={`text-3xl font-black ${colors.text}`}>{value.toLocaleString()}</p>
      <p className="text-sm text-slate-500 mt-1 font-medium">{title}</p>
    </div>
  );
}
