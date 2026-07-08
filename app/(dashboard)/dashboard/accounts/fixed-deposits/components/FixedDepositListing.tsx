"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, TrendingUp, Calendar, Search, ArrowUpDown, LogOut, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface FixedDeposit {
  id: string;
  accountNumber: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  member?: {
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
    };
  };
  institution?: {
    institutionNumber: string;
    institutionName: string;
    institutionEmail: string | null;
  };
  branch?: {
    name: string;
  };
}

interface FixedDepositListingProps {
  refreshKey?: number;
  onRefresh?: () => void;
}

export default function FixedDepositListing({ refreshKey, onRefresh }: FixedDepositListingProps) {
  const [deposits, setDeposits] = useState<FixedDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof FixedDeposit | string; direction: "asc" | "desc" } | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [confirmFd, setConfirmFd] = useState<FixedDeposit | null>(null);

  useEffect(() => {
    fetchDeposits();
  }, [refreshKey]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/fixed-deposits");
      const json = await res.json();
      if (json.data) setDeposits(json.data);
    } catch (err) {
      console.error("Failed to fetch fixed deposits:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(val);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const isEarlyWithdrawal = (fd: FixedDeposit) => new Date() < new Date(fd.maturityDate);

  const handleWithdraw = async () => {
    if (!confirmFd) return;
    setWithdrawing(confirmFd.id);
    setConfirmFd(null);
    try {
      const res = await fetch(`/api/v1/fixed-deposits/${confirmFd.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Withdrawal failed");
        return;
      }
      toast.success(json.message || "Withdrawal processed successfully");
      fetchDeposits();
      onRefresh?.();
    } catch {
      toast.error("Failed to process withdrawal. Please try again.");
    } finally {
      setWithdrawing(null);
    }
  };

  const filteredDeposits = React.useMemo(() => {
    const filtered = deposits.filter((fd) => {
      const searchLower = search.toLowerCase();
      const name = fd.member?.user.name.toLowerCase() || fd.institution?.institutionName.toLowerCase() || "";
      return name.includes(searchLower) || fd.accountNumber.toLowerCase().includes(searchLower);
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] ?? "";
      const bVal = (b as any)[sortConfig.key] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [deposits, search, sortConfig]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
      case "MATURED": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Matured</Badge>;
      case "WITHDRAWN": return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Withdrawn</Badge>;
      case "REVERSED": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Reversed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedIsEarly = confirmFd ? isEarlyWithdrawal(confirmFd) : false;

  return (
    <>
      <Card className="shadow-sm border-blue-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            Fixed Deposits
          </CardTitle>
          <CardDescription>Detailed list of all fixed deposit accounts for this branch</CardDescription>
          <div className="pt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member or account number..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No fixed deposits found.</div>
          ) : (
            <div className="rounded-md border border-blue-50 overflow-hidden">
              <Table>
                <TableHeader className="bg-blue-50/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Account #</TableHead>
                    <TableHead>Member / Institution</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => handleSort("principalAmount")}>
                        Principal <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => handleSort("termMonths")}>
                        Term <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="p-0 h-auto font-medium" onClick={() => handleSort("maturityDate")}>
                        Maturity Date <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Maturity Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.map((fd) => {
                    const early = isEarlyWithdrawal(fd);
                    const isProcessing = withdrawing === fd.id;
                    return (
                      <TableRow key={fd.id} className="hover:bg-blue-50/20 transition-colors">
                        <TableCell className="font-mono text-xs font-medium text-blue-900">{fd.accountNumber}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{fd.member?.user.name || fd.institution?.institutionName}</span>
                            <span className="text-xs text-muted-foreground">
                              {fd.member ? `Member: ${fd.member.memberNumber}` : `Institution: ${fd.institution?.institutionNumber}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(fd.principalAmount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            <span className="text-xs">{fd.interestRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{fd.termMonths} Months</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3 text-blue-600" />
                            {formatDate(fd.maturityDate)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-green-700">{formatCurrency(fd.maturityAmount)}</TableCell>
                        <TableCell>{getStatusBadge(fd.status)}</TableCell>
                        <TableCell className="text-right">
                          {fd.status === "ACTIVE" && (
                            <Button
                              variant={early ? "destructive" : "default"}
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => setConfirmFd(fd)}
                              className="text-xs gap-1"
                            >
                              <LogOut className="h-3 w-3" />
                              {isProcessing ? "Processing..." : early ? "Early Withdraw" : "Pay Out"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmFd} onOpenChange={(open) => { if (!open) setConfirmFd(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {selectedIsEarly && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {selectedIsEarly ? "Early Withdrawal — Interest Will Be Forfeited" : "Confirm Maturity Payout"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {confirmFd && (
                  <>
                    <p><span className="font-medium">Account:</span> {confirmFd.accountNumber}</p>
                    <p><span className="font-medium">Member/Institution:</span> {confirmFd.member?.user.name || confirmFd.institution?.institutionName}</p>
                    <p><span className="font-medium">Principal Amount:</span> {formatCurrency(confirmFd.principalAmount)}</p>
                    {selectedIsEarly ? (
                      <>
                        <p><span className="font-medium">Maturity Date:</span> {formatDate(confirmFd.maturityDate)} (not yet reached)</p>
                        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800">
                          <strong>Warning:</strong> The term has not ended. The member will receive only the principal amount of{" "}
                          <strong>{formatCurrency(confirmFd.principalAmount)}</strong>. The interest of{" "}
                          <strong>{formatCurrency(confirmFd.maturityAmount - confirmFd.principalAmount)}</strong> will be forfeited.
                        </div>
                      </>
                    ) : (
                      <>
                        <p><span className="font-medium">Interest Earned:</span> {formatCurrency(confirmFd.maturityAmount - confirmFd.principalAmount)}</p>
                        <p><span className="font-medium">Total Payout:</span> <strong>{formatCurrency(confirmFd.maturityAmount)}</strong></p>
                        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-800">
                          The fixed deposit has matured. The full amount including interest will be credited to the member&apos;s savings account.
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWithdraw}
              className={selectedIsEarly ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              {selectedIsEarly ? "Confirm Early Withdrawal" : "Confirm Payout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
