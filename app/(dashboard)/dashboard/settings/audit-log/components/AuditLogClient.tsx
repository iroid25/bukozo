"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  Download,
  Search,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { ActivityRecord, ActivityStats } from "@/lib/reports/activity-types";
import { toast } from "sonner";

interface AuditLogClientProps {
  user: { id: string; name: string; role: string; email: string };
  initialData: ActivityRecord[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DEPOSIT:            { label: "Deposit",          color: "bg-emerald-100 text-emerald-800 border-emerald-200",  icon: ArrowDownLeft },
  WITHDRAWAL:         { label: "Withdrawal",        color: "bg-rose-100 text-rose-800 border-rose-200",           icon: ArrowUpRight },
  LOAN:               { label: "Loan",              color: "bg-blue-100 text-blue-800 border-blue-200",           icon: CreditCard },
  LOAN_REPAYMENT:     { label: "Loan Repayment",    color: "bg-violet-100 text-violet-800 border-violet-200",     icon: CreditCard },
  USER_MANAGEMENT:    { label: "User Mgmt",         color: "bg-orange-100 text-orange-800 border-orange-200",     icon: Users },
  ACCOUNT_MANAGEMENT: { label: "Account Mgmt",      color: "bg-yellow-100 text-yellow-800 border-yellow-200",    icon: Activity },
  SYSTEM_ADMIN:       { label: "System Admin",      color: "bg-slate-100 text-slate-700 border-slate-200",        icon: Activity },
};

const STATUS_CONFIG: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:   "bg-amber-50 text-amber-700 border-amber-200",
  FAILED:    "bg-rose-50 text-rose-700 border-rose-200",
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(amount);
}

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AuditLogClient({ user, initialData }: AuditLogClientProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>(initialData);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activityType, setActivityType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/reports/activity/statistics", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      setStats(payload?.data ?? null);
    } catch {
      // non-critical
    }
  }, []);

  const loadData = useCallback(async (silent = false) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("orderBy", "createdAt");
      params.set("orderDirection", "desc");

      const response = await fetch(`/api/v1/reports/activity?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load audit log");
      }

      const payload = await response.json();
      setActivities(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadData();
  }, [loadStats, loadData]);

  const filtered = activities.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.description.toLowerCase().includes(q) ||
      a.user.toLowerCase().includes(q) ||
      (a.member && a.member.toLowerCase().includes(q)) ||
      (a.reference && a.reference.toLowerCase().includes(q))
    );
  });

  const clearFilters = () => {
    setSearchTerm("");
    setActivityType("all");
    setStatus("all");
    setDateRange({});
  };

  const hasFilters = searchTerm || activityType !== "all" || status !== "all" || dateRange.from;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete activity trail — {activities.length.toLocaleString()} records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Activities"
            value={stats.totalActivities.toLocaleString()}
            sub={`+${stats.todayActivities} today`}
            icon={Activity}
            color="bg-blue-100 text-blue-600"
          />
          <StatCard
            title="Transaction Value"
            value={fmt(stats.totalTransactionValue)}
            sub="Total processed"
            icon={DollarSign}
            color="bg-emerald-100 text-emerald-600"
          />
          <StatCard
            title="Active Users"
            value={stats.uniqueUsers}
            sub="This period"
            icon={Users}
            color="bg-violet-100 text-violet-600"
          />
          <StatCard
            title="This Week"
            value={stats.thisWeekActivities}
            sub="Activities logged"
            icon={TrendingUp}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search description, user, member…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background text-sm"
          />
        </div>

        {/* Type */}
        <Select value={activityType} onValueChange={setActivityType}>
          <SelectTrigger className="h-9 w-[155px] bg-background text-sm">
            <SelectValue placeholder="Activity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DEPOSIT">Deposits</SelectItem>
            <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
            <SelectItem value="LOAN">Loans</SelectItem>
            <SelectItem value="LOAN_REPAYMENT">Loan Repayments</SelectItem>
            <SelectItem value="USER_MANAGEMENT">User Management</SelectItem>
            <SelectItem value="ACCOUNT_MANAGEMENT">Account Management</SelectItem>
            <SelectItem value="SYSTEM_ADMIN">System Admin</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[130px] bg-background text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 bg-background text-sm font-normal",
                !dateRange.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange.from ? (
                dateRange.to
                  ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yy")}`
                  : format(dateRange.from, "MMM d, yyyy")
              ) : (
                "Date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange as any}
              onSelect={(r: any) => setDateRange(r ?? {})}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Activity table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Activity Records</CardTitle>
              <CardDescription>
                {filtered.length === activities.length
                  ? `${filtered.length.toLocaleString()} records`
                  : `${filtered.length.toLocaleString()} of ${activities.length.toLocaleString()} records`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading records…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No activities found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2.5 pl-4 pr-2 text-left font-medium text-muted-foreground w-[120px]">Type</th>
                    <th className="py-2.5 px-2 text-left font-medium text-muted-foreground">Description</th>
                    <th className="py-2.5 px-2 text-left font-medium text-muted-foreground hidden sm:table-cell">By</th>
                    <th className="py-2.5 px-2 text-right font-medium text-muted-foreground hidden md:table-cell w-[120px]">Amount</th>
                    <th className="py-2.5 px-2 text-left font-medium text-muted-foreground w-[90px]">Status</th>
                    <th className="py-2.5 pl-2 pr-4 text-right font-medium text-muted-foreground w-[130px]">Date / Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((activity) => {
                    const typeCfg = TYPE_CONFIG[activity.type] ?? { label: activity.type, color: "bg-slate-100 text-slate-700 border-slate-200", icon: Activity };
                    const TypeIcon = typeCfg.icon;
                    const statusColor = STATUS_CONFIG[activity.status?.toUpperCase()] ?? STATUS_CONFIG.PENDING;
                    return (
                      <tr key={activity.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-3 pl-4 pr-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}>
                            <TypeIcon className="h-3 w-3 shrink-0" />
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 max-w-[280px]">
                          <p className="font-medium text-foreground truncate">{activity.description}</p>
                          {activity.member && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              Member: {activity.member}
                            </p>
                          )}
                          {activity.reference && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                              {activity.reference}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-2 hidden sm:table-cell">
                          <p className="text-sm truncate max-w-[120px]">{activity.user}</p>
                          {activity.ipAddress && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{activity.ipAddress}</p>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right hidden md:table-cell">
                          {activity.amount ? (
                            <span className="font-medium tabular-nums">{fmt(activity.amount)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                            {activity.status}
                          </span>
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right">
                          <p className="text-xs font-medium tabular-nums">
                            {format(new Date(activity.createdAt), "dd MMM yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                            {format(new Date(activity.createdAt), "HH:mm:ss")}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
