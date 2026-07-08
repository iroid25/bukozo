"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, Filter, Search, Printer, FileText, ChevronRight } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { TableRow, TableCell } from "@/components/ui/table";

interface LedgerCardListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function LedgerCardListing({
  title,
  subtitle,
  initialRole,
}: LedgerCardListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Detect if viewing individual loan ledger
  const loanId = searchParams.get("loanId");
  const [individualLoanDetails, setIndividualLoanDetails] = useState<any>(null);

  // Fetch data from API
  const fetchData = async () => {
    // If no specific loan or member is selected, and we haven't searched, skip fetching heavy all-ledgers
    if (
      !loanId &&
      !searchParams.get("memberId") &&
      !searchParams.get("institutionId") &&
      !searchParams.get("branchId") &&
      !searchParams.get("officerId")
    ) {
      setLoading(false);
      setData(null);
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let result;
      if (loanId) {
        // Individual loan ledger - fetch from ledger-card endpoint
        const response = await fetch(`/api/v1/reports/loans/ledger-card?loanId=${loanId}`, {
          cache: "no-store",
        });
        result = await response.json();
        if (result.success && result.data) {
          const loanData = result.data;
          setIndividualLoanDetails(loanData.loanDetails);
          // Transform individual response to match all-ledgers format
          const transformed = {
            transactions: loanData.transactions.map((t: any) => ({
              transactionDate: t.date,
              transactionType: t.description,
              voucherNo: t.reference,
              memberName: loanData.loanDetails.memberName,
              memberNumber: loanData.loanDetails.memberNumber,
              loanId: loanData.loanDetails.id,
              debitPrincipal: t.debitPrincipal,
              debitInterest: t.debitInterest,
              creditPrincipal: t.creditPrincipal,
              creditInterest: t.creditInterest,
              creditPenalty: t.creditPenalty || 0,
              totalDebit: t.totalDebit,
              totalCredit: t.totalCredit,
              balancePrincipal: t.balancePrincipal,
              balanceInterest: t.balanceInterest,
              balanceTotal: t.balance,
              loanOfficer: loanData.loanDetails.loanOfficer,
              branch: loanData.loanDetails.branch,
            })),
            summary: {
              totalTransactions: loanData.transactions.length,
              totalDebits: loanData.summary.totalDebits,
              totalCredits: loanData.summary.totalCredits,
              totalPrincipalPaid: loanData.summary.totalPrincipalPaid || 0,
              totalInterestPaid: loanData.summary.totalInterestPaid || 0,
              totalPenaltyPaid: loanData.summary.totalPenaltyPaid || 0,
              totalLoans: 1,
            },
          };
          setData(transformed);
          setSearchResults([]);
        } else {
          setError(result.error || "Failed to fetch data");
          toast.error(result.error || "Failed to fetch ledger");
        }
      } else {
        const queryString = searchParams.toString();
        const hasSubjectSearch =
          Boolean(searchParams.get("memberId")) ||
          Boolean(searchParams.get("institutionId"));

        if (hasSubjectSearch) {
          const response = await fetch(`/api/v1/reports/loans/ledger-search?${queryString}`, {
            cache: "no-store",
          });
          result = await response.json();
          setIndividualLoanDetails(null);
          if (result.success) {
            setSearchResults(result.data?.results || []);
            setData(null);
          } else {
            setError(result.error || "Failed to fetch data");
            toast.error(result.error || "Failed to fetch data");
          }
          return;
        }

        const response = await fetch(`/api/v1/reports/loans/all-ledgers?${queryString}`, {
          cache: "no-store",
        });
        result = await response.json();
        setIndividualLoanDetails(null);
        if (result.success) {
          setData(result.data);
          setSearchResults([]);
        } else {
          setError(result.error || "Failed to fetch data");
          toast.error(result.error || "Failed to fetch data");
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("An error occurred while fetching data");
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch officers for filter
  useEffect(() => {
    const fetchFilterOfficers = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching filter officers:", error);
      }
    };
    fetchFilterOfficers();
  }, []);

  // Fetch members for member filter
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch("/api/v1/members?limit=500", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setMembers(result.data || []);
        }
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const response = await fetch("/api/v1/institutions?limit=500", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setInstitutions(result.data || []);
        }
      } catch (error) {
        console.error("Error fetching institutions:", error);
      }
    };
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const columns: Column<any>[] = [
    {
      header: "Trx Date",
      accessorKey: "transactionDate",
      cell: (row: any) => (
        <span className="text-[10px]">
          {row.transactionDate
            ? format(new Date(row.transactionDate), "dd/MM/yy HH:mm")
            : "N/A"}
        </span>
      ),
    },
    {
      header: "Member/Type",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-[10px] truncate max-w-[100px]">{row.memberName}</span>
          <div className="flex items-center gap-1">
             <span className="text-[9px] text-muted-foreground">{row.memberNumber}</span>
             <Badge variant="outline" className="text-[8px] h-3 px-1 py-0">{row.transactionType}</Badge>
          </div>
        </div>
      ),
    },
    {
      header: "Voucher",
      accessorKey: "voucherNo",
      cell: (row: any) => (
        <span className="font-mono text-[9px]">{row.voucherNo || "-"}</span>
      ),
    },
    {
      header: "Amount Paid",
      accessorKey: "totalCredit",
      cell: (row: any) => (
        <span className={`text-[10px] font-semibold ${row.totalCredit > 0 ? "text-green-700" : "text-muted-foreground"}`}>
          {row.totalCredit > 0 ? formatCurrency(row.totalCredit) : "-"}
        </span>
      ),
    },
    {
      header: "Principal Paid",
      accessorKey: "creditPrincipal",
      cell: (row: any) => (
        <span className="text-[10px] text-blue-600">
          {row.creditPrincipal > 0 ? formatCurrency(row.creditPrincipal) : "-"}
        </span>
      ),
    },
    {
      header: "Interest Paid",
      accessorKey: "creditInterest",
      cell: (row: any) => (
        <span className="text-[10px] text-orange-600">
          {row.creditInterest > 0 ? formatCurrency(row.creditInterest) : "-"}
        </span>
      ),
    },
    {
      header: "Penalty Paid",
      accessorKey: "creditPenalty",
      cell: (row: any) => (
        <span className="text-[10px] text-rose-600">
          {row.creditPenalty > 0 ? formatCurrency(row.creditPenalty) : "-"}
        </span>
      ),
    },
    {
      header: "Disbursed",
      accessorKey: "totalDebit",
      cell: (row: any) => (
        <span className="text-[10px] text-red-600">
          {row.totalDebit > 0 ? formatCurrency(row.totalDebit) : "-"}
        </span>
      ),
    },
    {
      header: "Prin. Balance",
      accessorKey: "balancePrincipal",
      cell: (row: any) => (
        <span className="text-[10px]">
          {row.balancePrincipal !== undefined ? formatCurrency(row.balancePrincipal) : "-"}
        </span>
      ),
    },
    {
      header: "Int. Balance",
      accessorKey: "balanceInterest",
      cell: (row: any) => (
        <span className="text-[10px]">
          {row.balanceInterest !== undefined ? formatCurrency(row.balanceInterest) : "-"}
        </span>
      ),
    },
    {
      header: "Total Balance",
      accessorKey: "balanceTotal",
      cell: (row: any) => (
        <span className="text-[10px] font-bold">
          {formatCurrency(row.balanceTotal || 0)}
        </span>
      ),
    },
  ];

  const transactions = data?.transactions || [];

  // Calculate totals for summary
  const totalPrincipalPaid = transactions.reduce((sum: number, t: any) => sum + (t.creditPrincipal || 0), 0);
  const totalInterestPaid = transactions.reduce((sum: number, t: any) => sum + (t.creditInterest || 0), 0);
  const totalPenaltyPaid = transactions.reduce((sum: number, t: any) => sum + (t.creditPenalty || 0), 0);
  const totalAmountPaid = transactions.reduce((sum: number, t: any) => sum + (t.totalCredit || 0), 0);
  const totalDisbursed = transactions.reduce((sum: number, t: any) => sum + (t.totalDebit || 0), 0);
  
  // Current balances (from the most recent transaction)
  const currentPrinBalance = transactions.length > 0 ? transactions[transactions.length - 1].balancePrincipal : 0;
  const currentIntBalance = transactions.length > 0 ? transactions[transactions.length - 1].balanceInterest : 0;
  const currentTotalBalance = transactions.length > 0
    ? transactions[transactions.length - 1].balanceTotal
    : (individualLoanDetails?.principalAmount || 0);

  const renderLoanSearchCard = (loan: any) => (
    <button
      key={loan.id}
      type="button"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("memberId");
        params.delete("institutionId");
        params.set("loanId", loan.id);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="w-full rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Borrower</p>
          <p className="font-semibold">{loan.memberName}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{loan.memberNumber}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {loan.subjectType}
            </Badge>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Loan Details</p>
          <p className="font-medium">{loan.loanProduct}</p>
          <p className="text-xs text-muted-foreground">
            Disbursed {loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd/MM/yyyy") : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground">{loan.loanOfficer} • {loan.branch}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Principal Amount</p>
            <p className="font-medium">{formatCurrency(loan.principalAmount || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Interest</p>
            <p className="font-medium">{formatCurrency(loan.interestAmount || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Due</p>
            <p className="font-medium">{formatCurrency(loan.totalAmountDue || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Outstanding</p>
            <p className="font-semibold text-orange-600">{formatCurrency(loan.outstandingBalance || 0)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <Badge className="font-bold">{loan.status}</Badge>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
          Open Full Ledger <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Trx Date": item.transactionDate
          ? format(new Date(item.transactionDate), "dd/MM/yyyy HH:mm")
          : "N/A",
        "Trx Type": item.transactionType,
        "Voucher No": item.voucherNo || "",
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Amount Paid": item.totalCredit || 0,
        "Principal Paid": item.creditPrincipal || 0,
        "Interest Paid": item.creditInterest || 0,
        "Penalty Paid": item.creditPenalty || 0,
        "Disbursed": item.totalDebit || 0,
        "Principal Balance": item.balancePrincipal || 0,
        "Interest Balance": item.balanceInterest || 0,
        "Total Balance": item.balanceTotal || 0,
        "Loan ID": item.loanId,
        "Officer": item.loanOfficer,
        "Branch": item.branch,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Ledger Card");
      const fileName = `loan-ledger-card-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <ReportHeader
        title={individualLoanDetails ? `Loan Ledger - ${individualLoanDetails.memberName}` : title}
        subtitle={individualLoanDetails 
          ? `${individualLoanDetails.memberNumber} | ${individualLoanDetails.loanProduct} | ${individualLoanDetails.status}` 
          : subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(transactions)}
        disableExport={!transactions.length}
      >
        {individualLoanDetails && (
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/loans/reports/ledger")}>
            ← All Ledgers
          </Button>
        )}
      </ReportHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 border-b pb-4">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase">{individualLoanDetails ? "Payments" : "Transactions"}</p>
          <p className="text-xl font-bold">{individualLoanDetails ? transactions.filter((t: any) => t.totalDebit > 0).length : (data?.summary?.totalTransactions || 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase">{individualLoanDetails ? "Principal Granted" : "Total Disbursed"}</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(totalDisbursed)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm border-l-4 border-l-green-500">
          <p className="text-xs text-muted-foreground font-medium uppercase">Total Paid</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(totalAmountPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm border-l-4 border-l-orange-500">
          <p className="text-xs text-muted-foreground font-medium uppercase">Current Balance</p>
          <p className="text-xl font-bold text-orange-600">
            {formatCurrency(currentTotalBalance)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase">Principal Paid</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(totalPrincipalPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase">{individualLoanDetails ? "Member Count" : "Active Loans"}</p>
          <p className="text-xl font-bold">{individualLoanDetails ? 1 : (data?.summary?.totalLoans || 0)}</p>
        </div>
      </div>

      {/* Individual Loan Info Banner */}
      {individualLoanDetails && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Loan Product</p>
            <p className="font-medium">{individualLoanDetails.loanProduct}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Principal Amount</p>
            <p className="font-medium">{formatCurrency(individualLoanDetails.principalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Interest</p>
            <p className="font-medium">{formatCurrency(individualLoanDetails.interestAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Due</p>
            <p className="font-medium">{formatCurrency(individualLoanDetails.totalAmountDue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Loan Officer</p>
            <p className="font-medium">{individualLoanDetails.loanOfficer}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
            <Badge className="font-bold">{individualLoanDetails.status}</Badge>
          </div>
        </div>
      )}

      {/* Primary Search and Filters */}
      {!loanId && (
        <div className="flex flex-col md:flex-row gap-4">
          {["ADMIN", "AUDITOR"].includes(initialRole) && (
            <Select
              value={searchParams.get("branchId") || "all"}
              onValueChange={(v) => {
                const params = new URLSearchParams(searchParams.toString());
                if (v && v !== "all") params.set("branchId", v);
                else params.delete("branchId");
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={searchParams.get("officerId") || "all"}
            onValueChange={(v) => {
              const params = new URLSearchParams(searchParams.toString());
              if (v && v !== "all") params.set("officerId", v);
              else params.delete("officerId");
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Officers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Officers</SelectItem>
              {filterOfficers.map((officer) => (
                <SelectItem key={officer.id} value={officer.id}>
                  {officer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchParams.get("branchId") || searchParams.get("officerId") || searchParams.get("memberId") || searchParams.get("institutionId") || loanId) && (
            <Button
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("branchId");
                params.delete("officerId");
                params.delete("memberId");
                params.delete("institutionId");
                params.delete("loanId");
                setMemberSearch("");
                setIndividualLoanDetails(null);
                setData(null);
                router.push(pathname);
              }}
            >
              Clear Search
            </Button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {!loanId && !searchParams.get("memberId") && !searchParams.get("institutionId") && !searchParams.get("branchId") && !searchParams.get("officerId") ? (
        <div className="flex-1 flex items-center justify-center border rounded-xl bg-neutral-50/30 shadow-inner my-4 py-24">
          <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-6">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
              <div className="relative rounded-full bg-blue-100 p-10 shadow-xl border-4 border-white">
                <Search className="h-16 w-16 text-blue-600" />
              </div>
            </div>
            
            <h3 className="text-4xl font-black text-neutral-900 tracking-tight uppercase mb-4">Ledger Transactions</h3>
            <p className="text-lg text-neutral-500 font-medium leading-relaxed mb-10">
              Generate a precise transaction history and ledger card for any member or institution.
            </p>

            <div className="w-full max-w-lg relative mb-12">
               <div className="relative group">
                  <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-6 w-6 text-neutral-400 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    placeholder="Search member or institution name/number..."
                    value={memberSearch}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setMemberSearch(nextValue);
                      setShowMemberDropdown(true);
                      const params = new URLSearchParams(searchParams.toString());
                      if (
                        params.has("memberId") ||
                        params.has("institutionId") ||
                        params.has("loanId")
                      ) {
                        params.delete("memberId");
                        params.delete("institutionId");
                        params.delete("loanId");
                        setIndividualLoanDetails(null);
                        setData(null);
                        setSearchResults([]);
                        router.replace(
                          nextValue.trim()
                            ? `${pathname}?${params.toString()}`
                            : pathname,
                        );
                      }
                    }}
                    onFocus={() => setShowMemberDropdown(true)}
                    className="pl-14 py-8 rounded-2xl border-2 border-neutral-200 shadow-xl focus:ring-8 focus:ring-blue-50 focus:border-blue-500 text-xl transition-all"
                  />
               </div>
               
               {memberSearch.length >= 2 && (
                  <div className="absolute z-50 w-full mt-2 max-h-64 overflow-y-auto rounded-2xl border bg-white shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                    {[
                      ...members
                        .filter((m: any) => {
                          const search = memberSearch.toLowerCase();
                          return (
                            (m.user?.name || "").toLowerCase().includes(search) ||
                            (m.memberNumber || "").toLowerCase().includes(search)
                          );
                        })
                        .map((m: any) => ({
                          id: m.id,
                          type: "member" as const,
                          name: m.user?.name || "Unknown",
                          number: m.memberNumber || "",
                        })),
                      ...institutions
                        .filter((i: any) => {
                          const search = memberSearch.toLowerCase();
                          return (
                            (i.institutionName || "").toLowerCase().includes(search) ||
                            (i.institutionNumber || "").toLowerCase().includes(search)
                          );
                        })
                        .map((i: any) => ({
                          id: i.id,
                          type: "institution" as const,
                          name: i.institutionName || "Unknown Institution",
                          number: i.institutionNumber || "",
                        })),
                    ]
                      .slice(0, 10)
                      .map((entry: any) => (
                        <div
                          key={`${entry.type}-${entry.id}`}
                          className="px-4 py-3 text-sm cursor-pointer hover:bg-blue-50 rounded-xl flex justify-between items-center transition-colors group"
                          onClick={() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete("memberId");
                            params.delete("institutionId");
                            if (entry.type === "institution") {
                              params.set("institutionId", entry.id);
                            } else {
                              params.set("memberId", entry.id);
                            }
                            setMemberSearch(entry.name || entry.number);
                            setShowMemberDropdown(false);
                            router.push(`${pathname}?${params.toString()}`);
                          }}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-neutral-900 group-hover:text-blue-700">{entry.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-[10px] uppercase font-black">{entry.number}</span>
                              <Badge variant="outline" className="text-[8px] h-4 px-1 py-0">
                                {entry.type}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500" />
                        </div>
                      ))}
                  </div>
               )}
            </div>

            <div className="flex flex-wrap justify-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Live Synchronization</span>
               </div>
               <div className="flex items-center gap-2">
                  <Printer className="h-3 w-3 text-neutral-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Print Ready Reports</span>
               </div>
            </div>
          </div>
        </div>
      ) : searchResults.length > 0 && !loanId ? (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Matching Loans</h3>
              <p className="text-sm text-muted-foreground">
                Select a loan below to open the full ledger view with the same detail as the single-loan page.
              </p>
            </div>
            <Badge variant="secondary">{searchResults.length} loan(s)</Badge>
          </div>
          <div className="space-y-3">
            {searchResults.map((loan) => renderLoanSearchCard(loan))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-lg border bg-card">
          <DataTable
            title="Ledger Transactions"
            subtitle="Full transaction history for specific loan accounts with summations"
            data={transactions}
            columns={columns}
            keyField="transactionDate"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            footer={
              transactions.length > 0 && (
                <TableRow className="bg-neutral-100 font-black hover:bg-neutral-100 border-t-2 border-neutral-300">
                  <TableCell className="text-[9px] uppercase tracking-tighter text-neutral-500 pl-4 py-4">TOTALS</TableCell>
                  <TableCell className="text-[9px]"></TableCell>
                  <TableCell className="text-[9px]"></TableCell>
                  <TableCell className="text-[11px] text-green-700 bg-green-50/50 border-x">{formatCurrency(totalAmountPaid)}</TableCell>
                  <TableCell className="text-[11px] text-blue-700 bg-blue-50/50 border-x">{formatCurrency(totalPrincipalPaid)}</TableCell>
                  <TableCell className="text-[11px] text-orange-700 bg-orange-50/50 border-x">{formatCurrency(totalInterestPaid)}</TableCell>
                  <TableCell className="text-[11px] text-rose-700 bg-rose-50/50 border-x">{formatCurrency(totalPenaltyPaid)}</TableCell>
                  <TableCell className="text-[11px] text-red-700 bg-red-50/50 border-x">{formatCurrency(totalDisbursed)}</TableCell>
                  <TableCell className="text-[11px] text-neutral-700 border-x">{formatCurrency(currentPrinBalance)}</TableCell>
                  <TableCell className="text-[11px] text-neutral-700 border-x">{formatCurrency(currentIntBalance)}</TableCell>
                  <TableCell className="text-[11px] text-neutral-900 border-x bg-neutral-200/50">{formatCurrency(currentTotalBalance)}</TableCell>
                </TableRow>
              )
            }
            filters={{
              searchFields: ["loanId", "memberName", "memberNumber"],
              enableDateFilter: true,
              getItemDate: (item) => item.transactionDate,
            }}
          />
        </div>
      )}
    </div>
  );
}
