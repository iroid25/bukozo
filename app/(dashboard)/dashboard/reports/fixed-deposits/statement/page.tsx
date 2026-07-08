"use client";

import React, { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { FileText, RefreshCw, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";

interface AccountInfo {
  accountNumber: string;
  memberName: string;
  accountType: string;
  openedDate: string;
  maturityDate: string;
  interestRate: number;
  currentBalance: number;
  status: string;
  branch: string;
}

interface StatementEntry {
  date: string;
  transactionRef: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}

export default function FixedDepositStatementPage() {
  const [accountIdInput, setAccountIdInput] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(new Date().setFullYear(new Date().getFullYear() - 1)), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  const fetchStatement = useCallback(async () => {
    const id = accountIdInput.trim();
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ accountId: id, startDate, endDate });
      const response = await fetch(`/api/v1/reports/fixed-deposits/statement?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load statement");
      setAccountInfo(result.accountInfo);
      setTransactions(result.transactions || []);
      setGeneratedAt(new Date().toLocaleString("en-UG"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load statement");
      setAccountInfo(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [accountIdInput, startDate, endDate]);

  useEffect(() => {
    if (accountIdInput.trim()) fetchStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

  return (
    <ReportPageLayout
      title="Fixed Deposit Statement"
      description="Transaction history for a fixed deposit account. Enter the account ID to load."
      generatedAt={generatedAt || undefined}
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <label className="text-sm font-medium">Account ID</label>
            <div className="flex gap-2">
              <Input
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value)}
                placeholder="Paste account database ID"
                className="font-mono text-sm"
              />
              <Button onClick={fetchStatement} disabled={loading || !accountIdInput.trim()} icon={Search} iconPosition="left">
                {loading ? "Loading..." : "Load"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 lg:col-span-4">
            <Button onClick={fetchStatement} disabled={loading || !accountIdInput.trim()} icon={RefreshCw} iconPosition="left" variant="outline">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
      }
      summary={
        accountInfo ? (
          <>
            <ReportSummaryCard title="Transactions" value={transactions.length.toString()} icon={FileText} />
            <ReportSummaryCard title="Total Debits" value={ugx(totalDebits)} icon={TrendingDown} className="border-rose-200 bg-rose-50/50" />
            <ReportSummaryCard title="Total Credits" value={ugx(totalCredits)} icon={TrendingUp} className="border-emerald-200 bg-emerald-50/50" />
            <ReportSummaryCard title="Current Balance" value={ugx(accountInfo.currentBalance)} icon={Wallet} />
          </>
        ) : null
      }
    >
      <div className="space-y-4 p-4">
        {accountInfo && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-muted-foreground">Account No.:</span> <span className="font-medium">{accountInfo.accountNumber}</span></div>
              <div><span className="text-muted-foreground">Member:</span> <span className="font-medium">{accountInfo.memberName}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{accountInfo.accountType}</span></div>
              <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{accountInfo.branch}</span></div>
              <div><span className="text-muted-foreground">Opened:</span> <span className="font-medium">{new Date(accountInfo.openedDate).toLocaleDateString("en-UG")}</span></div>
              <div><span className="text-muted-foreground">Maturity:</span> <span className="font-medium">{new Date(accountInfo.maturityDate).toLocaleDateString("en-UG")}</span></div>
              <div><span className="text-muted-foreground">Rate:</span> <span className="font-medium">{accountInfo.interestRate}%</span></div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant={accountInfo.status === "ACTIVE" ? "secondary" : "destructive"} className="text-xs">
                  {accountInfo.status}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {!accountInfo && !loading && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Enter an account ID above and click Load to view the statement.
          </div>
        )}

        {transactions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Ref No.</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit (UGX)</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit (UGX)</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance (UGX)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row, index) => (
                  <tr key={`${row.transactionRef}-${index}`} className={`border-b ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                    <td className="px-3 py-2">{new Date(row.date).toLocaleDateString("en-UG")}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.transactionRef}</td>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.debit > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                        {row.debit > 0 ? ugx(row.debit) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.credit > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                        {row.credit > 0 ? ugx(row.credit) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      <span className={row.balance < 0 ? "text-destructive" : ""}>{ugx(row.balance)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr className="border-t-2 font-semibold">
                  <td className="px-3 py-3" colSpan={3}>Total ({transactions.length} entries)</td>
                  <td className="px-3 py-3 text-right text-rose-600">{ugx(totalDebits)}</td>
                  <td className="px-3 py-3 text-right text-emerald-600">{ugx(totalCredits)}</td>
                  <td className="px-3 py-3 text-right">{accountInfo ? ugx(accountInfo.currentBalance) : ""}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </ReportPageLayout>
  );
}
