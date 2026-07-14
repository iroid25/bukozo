"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AccountRecord = {
  accountNumber: string;
  memberName: string;
  accountType: string;
  balance: number;
  status: string;
  hasActiveHold: boolean;
  branch: string;
};

type ReportResponse = {
  accounts: AccountRecord[];
  summary: { totalAccounts: number };
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value);

export default function OnHoldClosedPage() {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({ enabled: true, intervalMs: 15000 });
  const lastRefreshRef = useRef(liveRefreshVersion);

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, any> = {};
      if (isAdmin) {
        if (userBranchId) body.branchId = userBranchId;
      } else if (userBranchId) {
        body.branchId = userBranchId;
      }

      const res = await fetch("/api/v1/reports/savings/on-hold-closed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      const result = await res.json();
      const reportData = result.data?.data || result.data;
      setData(reportData);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    void fetchReport();
  }, []);

  useEffect(() => {
    if (liveRefreshVersion !== lastRefreshRef.current) {
      lastRefreshRef.current = liveRefreshVersion;
      void fetchReport();
    }
  }, [liveRefreshVersion, fetchReport]);

  return (
    <ReportPageLayout
      title="Accounts On Hold / Closed"
      description="Savings accounts that are on hold, suspended, or closed"
    >
      <div className="mb-6 flex items-center gap-4">
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Generate
        </Button>
      </div>

      {data && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <ReportSummaryCard title="Total Accounts" value={data.summary?.totalAccounts || data.accounts?.length || 0} icon={AlertTriangle} />
            <ReportSummaryCard
              title="On Hold"
              value={data.accounts?.filter((a) => a.hasActiveHold).length || 0}
            />
            <ReportSummaryCard
              title="Closed/Suspended"
              value={data.accounts?.filter((a) => !a.hasActiveHold).length || 0}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No.</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No accounts on hold or closed
                    </TableCell>
                  </TableRow>
                )}
                {data.accounts?.map((row) => (
                  <TableRow key={row.accountNumber}>
                    <TableCell className="font-mono text-xs">{row.accountNumber}</TableCell>
                    <TableCell>{row.memberName}</TableCell>
                    <TableCell>{row.accountType}</TableCell>
                    <TableCell>{row.branch}</TableCell>
                    <TableCell className="text-right">{currency(row.balance)}</TableCell>
                    <TableCell>
                      <Badge variant={row.hasActiveHold ? "destructive" : "secondary"}>
                        {row.hasActiveHold ? "ON HOLD" : row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {generatedAt && (
            <p className="mt-4 text-xs text-muted-foreground">Generated: {generatedAt}</p>
          )}
        </>
      )}
    </ReportPageLayout>
  );
}
