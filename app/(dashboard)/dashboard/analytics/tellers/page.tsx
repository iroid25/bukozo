"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Activity, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface TellerMetrics {
  tellerId: string;
  tellerName: string;
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalLoanRepayments: number;
  totalVolume: number;
  depositVolume: number;
  withdrawalVolume: number;
  repaymentVolume: number;
  averageTransactionSize: number;
  activeDays: number;
  transactionsPerDay: number;
  performanceScore: number;
}

export default function TellerPerformancePage() {
  const [tellers, setTellers] = useState<TellerMetrics[]>([]);
  const [topPerformers, setTopPerformers] = useState<TellerMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);

      // Fetch all tellers
      const allResponse = await fetch("/api/v1/analytics/tellers");
      const allData = await allResponse.json();

      // Fetch top 5
      const topResponse = await fetch("/api/v1/analytics/tellers?top=5");
      const topData = await topResponse.json();

      if (allData.success && topData.success) {
        setTellers(allData.data);
        setTopPerformers(topData.data);
      } else {
        toast.error("Failed to load performance data");
      }
    } catch (error) {
      console.error("Error fetching performance:", error);
      toast.error("An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 75) return <Badge className="bg-blue-600">Good</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-600">Average</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teller Performance</h1>
        <p className="text-muted-foreground">
          Track transaction volume and teller productivity metrics
        </p>
      </div>

      {/* Top Performers Leaderboard */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Performing Tellers
          </CardTitle>
          <CardDescription>Highest transaction volume and efficiency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topPerformers.map((teller, index) => (
              <Card key={teller.tellerId} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-start justify-end p-2">
                  <span className="text-2xl font-bold text-primary/40">#{index + 1}</span>
                </div>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="font-semibold truncate">{teller.tellerName}</p>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold text-primary">
                        {teller.performanceScore}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Transactions:</span>
                        <span className="font-medium">{teller.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Volume:</span>
                        <span className="font-medium">{formatCurrency(teller.totalVolume)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Per Day:</span>
                        <span className="font-medium text-blue-600">
                          {teller.transactionsPerDay}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Tellers Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tellers</CardTitle>
          <CardDescription>Comprehensive transaction performance comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teller</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Total Transactions</TableHead>
                  <TableHead className="text-right">Total Volume</TableHead>
                  <TableHead className="text-right">Deposits</TableHead>
                  <TableHead className="text-right">Withdrawals</TableHead>
                  <TableHead className="text-right">Repayments</TableHead>
                  <TableHead className="text-right">Trans/Day</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tellers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No tellers found
                    </TableCell>
                  </TableRow>
                ) : (
                  tellers
                    .sort((a, b) => b.performanceScore - a.performanceScore)
                    .map((teller) => (
                      <TableRow key={teller.tellerId}>
                        <TableCell className="font-medium">{teller.tellerName}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-lg">{teller.performanceScore}</span>
                        </TableCell>
                        <TableCell className="text-right">{teller.totalTransactions}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(teller.totalVolume)}
                        </TableCell>
                        <TableCell className="text-right">{teller.totalDeposits}</TableCell>
                        <TableCell className="text-right">{teller.totalWithdrawals}</TableCell>
                        <TableCell className="text-right">{teller.totalLoanRepayments}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-blue-600 font-medium">
                            {teller.transactionsPerDay}
                          </span>
                        </TableCell>
                        <TableCell>{getScoreBadge(teller.performanceScore)}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
