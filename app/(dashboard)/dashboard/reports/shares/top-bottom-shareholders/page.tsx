"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Loader2, Printer, RefreshCw, Trophy, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { printReport } from "@/lib/reports/print-report";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Shareholder = {
  rank: number;
  accountNumber: string;
  memberName: string;
  memberPhone: string;
  numberOfShares: number;
  totalValue: string;
};

type ReportData = {
  topShareholders: Shareholder[];
  bottomShareholders: Shareholder[];
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value);

export default function TopBottomShareholdersPage() {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({ enabled: true, intervalMs: 15000 });
  const lastRefreshRef = useRef(liveRefreshVersion);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [generatedAt, setGeneratedAt] = useState("");

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, any> = { limit };
      if (isAdmin) {
        if (userBranchId) body.branchId = userBranchId;
      } else if (userBranchId) {
        body.branchId = userBranchId;
      }

      const res = await fetch("/api/v1/reports/shares/top-bottom-shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      const result = await res.json();
      setData(result.data?.data || result.data);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [limit, isAdmin, userBranchId]);

  useEffect(() => {
    void fetchReport();
  }, []);

  useEffect(() => {
    if (liveRefreshVersion !== lastRefreshRef.current) {
      lastRefreshRef.current = liveRefreshVersion;
      void fetchReport();
    }
  }, [liveRefreshVersion, fetchReport]);

  const handlePrint = useCallback(() => {
    if (!data) {
      toast.error("No report to print");
      return;
    }

    const groupBy = [
      {
        key: 0,
        label: "Top Shareholders",
        subHeaders: ["Rank", "Account", "Member", "Shares", "Value"],
        subRows: data.topShareholders.map((row) => [
          row.rank,
          row.accountNumber,
          row.memberName,
          row.numberOfShares,
          row.totalValue,
        ]),
      },
      {
        key: 1,
        label: "Bottom Shareholders",
        subHeaders: ["Rank", "Account", "Member", "Shares", "Value"],
        subRows: data.bottomShareholders.map((row) => [
          row.rank,
          row.accountNumber,
          row.memberName,
          row.numberOfShares,
          row.totalValue,
        ]),
      },
    ];

    printReport({
      title: "Top & Bottom Shareholders",
      headers: [],
      rows: [],
      groupBy,
    });
  }, [data]);

  return (
    <ReportPageLayout
      title="Top & Bottom Shareholders"
      description="Ranking of shareholders by number of shares held"
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Show Top/Bottom</Label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Generate
        </Button>
        <Button variant="outline" onClick={() => void handlePrint()} disabled={!data}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {data && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <ReportSummaryCard title="Top Shareholders" value={data.topShareholders.length} icon={Trophy} />
            <ReportSummaryCard
              title="Highest Shares"
              value={data.topShareholders[0]?.numberOfShares?.toLocaleString() || "0"}
            />
            <ReportSummaryCard title="Bottom Shareholders" value={data.bottomShareholders.length} icon={TrendingDown} />
            <ReportSummaryCard
              title="Lowest Shares"
              value={data.bottomShareholders[0]?.numberOfShares?.toLocaleString() || "0"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Shareholders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topShareholders.map((row) => (
                      <TableRow key={row.accountNumber}>
                        <TableCell className="font-medium">{row.rank}</TableCell>
                        <TableCell>{row.memberName}</TableCell>
                        <TableCell className="font-mono text-xs">{row.accountNumber}</TableCell>
                        <TableCell className="text-right">{row.numberOfShares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.totalValue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Bottom Shareholders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bottomShareholders.map((row) => (
                      <TableRow key={row.accountNumber}>
                        <TableCell className="font-medium">{row.rank}</TableCell>
                        <TableCell>{row.memberName}</TableCell>
                        <TableCell className="font-mono text-xs">{row.accountNumber}</TableCell>
                        <TableCell className="text-right">{row.numberOfShares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.totalValue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {generatedAt && (
            <p className="mt-4 text-xs text-muted-foreground">Generated: {generatedAt}</p>
          )}
        </>
      )}
    </ReportPageLayout>
  );
}
