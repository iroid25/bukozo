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
import { Trophy, TrendingUp, DollarSign, Target, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface OfficerMetrics {
  officerId: string;
  officerName: string;
  totalLoans: number;
  portfolioValue: number;
  activeLoans: number;
  repaidLoans: number;
  overdueLoans: number;
  defaultedLoans: number;
  repaymentRate: number;
  defaultRate: number;
  approvalRate: number;
  averageLoanSize: number;
  performanceScore: number;
}

export default function LoanOfficerPerformancePage() {
  const [officers, setOfficers] = useState<OfficerMetrics[]>([]);
  const [topPerformers, setTopPerformers] = useState<OfficerMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch all officers
      const allResponse = await fetch("/api/v1/analytics/loan-officers");
      const allData = await allResponse.json();
      
      // Fetch top 5
      const topResponse = await fetch("/api/v1/analytics/loan-officers?top=5");
      const topData = await topResponse.json();

      if (allData.success && topData.success) {
        setOfficers(allData.data);
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
        <h1 className="text-3xl font-bold tracking-tight">Loan Officer Performance</h1>
        <p className="text-muted-foreground">Track and compare loan officer performance metrics</p>
      </div>

      {/* Top Performers Leaderboard */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Performers
          </CardTitle>
          <CardDescription>Best performing loan officers this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topPerformers.map((officer, index) => (
              <Card key={officer.officerId} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-start justify-end p-2">
                  <span className="text-2xl font-bold text-primary/40">#{index + 1}</span>
                </div>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="font-semibold truncate">{officer.officerName}</p>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold text-primary">
                        {officer.performanceScore}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Portfolio:</span>
                        <span className="font-medium">{formatCurrency(officer.portfolioValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Repayment:</span>
                        <span className="font-medium text-green-600">{officer.repaymentRate}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Officers Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Loan Officers</CardTitle>
          <CardDescription>Comprehensive performance comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Total Loans</TableHead>
                  <TableHead className="text-right">Portfolio Value</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Repayment Rate</TableHead>
                  <TableHead className="text-right">Default Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No loan officers found
                    </TableCell>
                  </TableRow>
                ) : (
                  officers
                    .sort((a, b) => b.performanceScore - a.performanceScore)
                    .map((officer) => (
                      <TableRow key={officer.officerId}>
                        <TableCell className="font-medium">{officer.officerName}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-lg">{officer.performanceScore}</span>
                        </TableCell>
                        <TableCell className="text-right">{officer.totalLoans}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(officer.portfolioValue)}
                        </TableCell>
                        <TableCell className="text-right">{officer.activeLoans}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600 font-medium">
                            {officer.repaymentRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              officer.defaultRate > 5 ? "text-red-600 font-medium" : "text-muted-foreground"
                            }
                          >
                            {officer.defaultRate}%
                          </span>
                        </TableCell>
                        <TableCell>{getScoreBadge(officer.performanceScore)}</TableCell>
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
