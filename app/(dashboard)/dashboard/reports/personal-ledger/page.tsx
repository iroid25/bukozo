"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { BadgeCheck, Check, ChevronDown, Download, Loader2, Printer, ShieldAlert, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";

type SearchResult = {
  kind: "member" | "institution";
  member_id: string;
  member_number: string;
  full_name: string;
  phone: string;
  account_number: string;
  account_kind: string;
  label: string;
};

type PersonalLedgerReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
  };
  subject_type: "member" | "institution";
  member?: {
    member_id: string;
    full_name: string;
    physical_address: string;
    postal_address: string;
    sex: string;
    date_of_birth: string | null;
    id_card: string;
    ref_no: number | null;
    phone: string;
    mobile: string | null;
    email: string | null;
    occupation: string | null;
    employer: string | null;
    area_code: string | null;
    next_of_kin: string | null;
    kyc_status: "Verified" | "Pending" | "Incomplete";
    member_since: string;
    member_type: "Affiliate" | "Ordinary" | "Associate";
    batch_no: number | null;
    is_active: boolean;
    is_staff: boolean;
  };
  institution?: {
    institution_id: string;
    institution_number: string;
    institution_name: string;
    institution_type: string;
    registration_number: string | null;
    tin_number: string | null;
    legal_status: string | null;
    physical_address: string;
    postal_address: string;
    primary_contact_person: string;
    primary_contact_title: string | null;
    primary_contact_phone: string;
    primary_contact_email: string | null;
    institution_phone: string;
    institution_email: string;
    member_since: string;
    approval_status: "Verified" | "Pending" | "Incomplete";
    is_active: boolean;
    is_staff: boolean;
  };
  accounts: Array<{
    account_no: string;
    product_code: string;
    product_name: string;
    date_opened: string;
    status: string;
    account_type: "savings" | "shares" | "fixed" | "loans";
    savings_variant?: "voluntary" | "compulsory" | "junior" | null;
    opening_balance: number;
    transactions: Array<{
      trx_date: string;
      session_date: string;
      trx_number: string;
      trx_code: string;
      voucher_no: string;
      description: string;
      debit: number;
      credit: number;
      running_balance: number;
      user_name: string;
    }>;
    summary: {
      transaction_count: number;
      total_debit: number;
      total_credit: number;
      closing_balance: number;
    };
    loan_details?: {
      loan_amount: number;
      outstanding_balance: number;
      interest_rate: number;
      maturity_date: string;
      loan_status: string;
    };
  }>;
  grand_summary: {
    total_savings_balance: number;
    total_shares_balance: number;
    total_fixed_deposit_balance: number;
    total_loan_balance: number;
    net_worth: number;
  };
};

const today = new Date().toISOString().slice(0, 10);
const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10);

function formatMoney(value: number) {
  return `UGX ${Math.round(value || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

function buildDateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
}

function phoneLooksSuspicious(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 && digits.length !== 10;
}

export default function PersonalLedgerPage() {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SearchResult | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [report, setReport] = useState<PersonalLedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountType, setAccountType] = useState<"all" | "savings" | "voluntary" | "compulsory" | "shares" | "fixed" | "loans">("all");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: defaultFrom,
    toDate: today,
  });
  const searchTimer = useRef<number | null>(null);

  const reportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSubject?.kind === "institution") params.set("institutionId", selectedSubject.member_id);
    else if (selectedSubject?.kind === "member") params.set("memberId", selectedSubject.member_id);
    else if (memberQuery.trim()) params.set("memberName", memberQuery.trim());
    params.set("fromDate", filters.fromDate);
    params.set("toDate", filters.toDate);
    params.set("accountType", accountType);
    params.set("includeClosed", String(includeClosed));
    return params;
  }, [accountType, filters.fromDate, filters.toDate, includeClosed, memberQuery, selectedSubject?.kind, selectedSubject?.member_id]);

  async function searchMembers(value: string) {
    const q = value.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/v1/reports/member-ledger/personal-ledger/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json?.error || "Failed to search members");
      }
      setSuggestions(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search members");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void searchMembers(memberQuery);
    }, 250);

    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [memberQuery]);

  const selectedMemberLabel = useMemo(() => {
    if (selectedSubject) return `${selectedSubject.full_name} (${selectedSubject.member_number})`;
    return "Select Member or Institution";
  }, [selectedSubject]);

  async function generateReport() {
    if (!selectedSubject && !memberQuery.trim()) {
      toast.error("Search by member or institution name, or select one first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/reports/member-ledger/personal-ledger?${reportUrl.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json?.error || "Failed to generate report");
      }
      setReport(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    if (!selectedSubject && !memberQuery.trim()) {
      toast.error("Search by member or institution name, or select one first");
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams(reportUrl);
      params.set("format", "xlsx");
      const response = await fetch(`/api/v1/reports/member-ledger/personal-ledger?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `personal-ledger-${selectedSubject?.member_number || "ledger"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export report");
    } finally {
      setExporting(false);
    }
  }

  const summary = useMemo(() => {
    if (!report) return null;
    return [
      { label: "Savings", value: formatMoney(report.grand_summary.total_savings_balance), tone: "text-emerald-700" },
      { label: "Shares", value: formatMoney(report.grand_summary.total_shares_balance), tone: "text-violet-700" },
      { label: "Fixed Deposits", value: formatMoney(report.grand_summary.total_fixed_deposit_balance), tone: "text-amber-700" },
      { label: "Loans", value: formatMoney(report.grand_summary.total_loan_balance), tone: "text-rose-700" },
      { label: "Net Worth", value: formatMoney(report.grand_summary.net_worth), tone: "text-slate-900" },
    ];
  }, [report]);

  return (
    <ReportPageLayout
      title="Personal Ledger"
      description="Member-facing statement with identity profile, all account activity, opening balances, and running balances."
      period={report ? `From ${report.report_meta.from_date} to ${report.report_meta.to_date}` : undefined}
      summary={
        report ? (
          <>
            {summary?.map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className={`text-2xl font-bold ${item.tone}`}>{item.value}</CardContent>
              </Card>
            ))}
          </>
        ) : null
      }
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Label>Member / Institution Search</Label>
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={memberOpen} className="w-full justify-between font-normal">
                  <span className="truncate">{selectedMemberLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name, account number, member ID, or institution..."
                    value={memberQuery}
                    onValueChange={(value) => {
                      setMemberQuery(value);
                      setSelectedSubject(null);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searching ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching members...
                        </div>
                      ) : (
                        "No matching members or institutions found."
                      )}
                    </CommandEmpty>
                    <CommandGroup heading="Eligible members and institutions">
                      {suggestions.map((item) => {
                        const isSelected =
                          selectedSubject?.member_id === item.member_id &&
                          selectedSubject?.kind === item.kind;
                        return (
                          <CommandItem
                            key={`${item.member_id}-${item.account_number || item.member_number}`}
                            value={`${item.full_name} ${item.member_number} ${item.account_number} ${item.phone}`}
                            onSelect={() => {
                              setSelectedSubject(item);
                              setMemberQuery(item.full_name);
                              setSuggestions([]);
                              setMemberOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900">{item.full_name}</span>
                              <span className="text-xs text-slate-500">
                                {item.account_number
                                  ? `${item.account_kind.toUpperCase()} • ${item.account_number}`
                                  : `Member No. ${item.member_number}`}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {searching && memberOpen && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            )}

            {selectedSubject && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Selected: {selectedSubject.full_name} {selectedSubject.account_number ? `(${selectedSubject.account_number})` : ""}
              </div>
            )}
          </div>

          <div>
            <Label>From Date</Label>
            <Input type="date" value={filters.fromDate} onChange={(e) => setFilters((current) => ({ ...current, fromDate: e.target.value }))} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={filters.toDate} onChange={(e) => setFilters((current) => ({ ...current, toDate: e.target.value }))} />
          </div>
          <div>
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={(value) => setAccountType(value as typeof accountType)}>
              <SelectTrigger>
                <SelectValue placeholder="All account types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="savings">All Savings</SelectItem>
                <SelectItem value="voluntary">Voluntary Savings</SelectItem>
                <SelectItem value="compulsory">Compulsory Savings</SelectItem>
                <SelectItem value="shares">Shares</SelectItem>
                <SelectItem value="fixed">Fixed Savings</SelectItem>
                <SelectItem value="loans">Loans</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || loading}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export to Excel"}
          </Button>
          <Button variant="outline" onClick={() => setIncludeClosed((current) => !current)}>
            {includeClosed ? "Hide Closed" : "Include Closed"}
          </Button>
          <Button onClick={() => void generateReport()} disabled={loading}>
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      }
      fitContent
    >
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                {report?.subject_type === "institution" ? "Institution Identity Profile" : "Member Identity Profile"}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {report?.member?.full_name || report?.institution?.institution_name || selectedSubject?.full_name || "No subject selected"}
              </h2>
              {report?.subject_type === "institution" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {report.institution?.approval_status && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${report.institution.approval_status === "Verified" ? "bg-emerald-100 text-emerald-700" : report.institution.approval_status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {report.institution.approval_status}
                    </span>
                  )}
                  {report.institution?.institution_type && (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{report.institution.institution_type}</span>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {report?.member?.kyc_status && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${report.member?.kyc_status === "Verified" ? "bg-emerald-100 text-emerald-700" : report.member?.kyc_status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {report.member?.kyc_status}
                    </span>
                  )}
                  {report?.member?.is_staff && (
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">Also a Teller</span>
                  )}
                  {report?.member?.member_type && (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{report.member?.member_type}</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2 text-sm text-slate-700 lg:text-right">
              {report?.subject_type === "institution" ? (
                <>
                  <div>
                    <span className="font-semibold">Registered Since:</span> {report?.institution?.member_since || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Phone:</span> {report?.institution?.institution_phone || "-"}
                  </div>
                  <div><span className="font-semibold">Address:</span> {report?.institution?.physical_address || report?.institution?.postal_address || "-"}</div>
                </>
              ) : (
                <>
                  <div>
                    <span className="font-semibold">Member Since:</span> {report?.member?.member_since || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Phone:</span> {report?.member?.phone || "-"}
                    {report?.member?.phone && phoneLooksSuspicious(report.member?.phone) && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        Check format
                      </span>
                    )}
                  </div>
                  <div><span className="font-semibold">Address:</span> {report?.member?.physical_address || report?.member?.postal_address || "-"}</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {report?.subject_type === "institution" ? (
              <>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Institution No.</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.institution?.institution_number || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Registration No.</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.institution?.registration_number || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Primary Contact</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.institution?.primary_contact_person || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Institution Email</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.institution?.institution_email || "-"}</div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">ID Card</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.member?.id_card || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ref. No.</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.member?.ref_no ?? "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Date of Birth</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.member?.date_of_birth ? buildDateLabel(report.member?.date_of_birth || "") : "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Member Type</div>
                  <div className="mt-1 font-bold text-slate-900">{report?.member?.member_type || "-"}</div>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {report?.subject_type === "institution" ? (
              <>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Primary Contact Phone</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.institution?.primary_contact_phone || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Primary Contact Email</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.institution?.primary_contact_email || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Institution Phone</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.institution?.institution_phone || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</div>
                  <div className="mt-1 flex items-center gap-2 font-medium text-slate-900">
                    {report?.institution?.is_active ? (
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <UserCog className="h-4 w-4 text-slate-500" />
                    )}
                    {report?.institution?.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Email</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.member?.email || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Occupation</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.member?.occupation || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Next of Kin</div>
                  <div className="mt-1 font-medium text-slate-900">{report?.member?.next_of_kin || "-"}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</div>
                  <div className="mt-1 flex items-center gap-2 font-medium text-slate-900">
                    {report?.member?.is_active ? (
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <UserCog className="h-4 w-4 text-slate-500" />
                    )}
                    {report?.member?.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {report?.accounts?.length ? (
          <div className="space-y-6">
            {report.accounts.map((account) => (
              <details key={`${account.account_type}-${account.account_no}`} open className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none flex-col gap-2 border-b bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Account Header</div>
                    <div className="mt-1 font-bold text-slate-950">
                      A/C No.: {account.account_no} | {account.product_code} - {account.product_name} | Opened: {account.date_opened} | Status: {account.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                      Opening Balance: {formatMoney(account.opening_balance)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${account.summary.closing_balance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      Closing Balance: {formatMoney(account.summary.closing_balance)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      Debit {formatMoney(account.summary.total_debit)} | Credit {formatMoney(account.summary.total_credit)}
                    </span>
                  </div>
                </summary>

                {account.loan_details && (
                  <div className="grid gap-3 border-b bg-amber-50 px-4 py-3 text-sm md:grid-cols-5">
                    <div><span className="font-semibold">Loan Amount:</span> {formatMoney(account.loan_details.loan_amount)}</div>
                    <div><span className="font-semibold">Outstanding:</span> {formatMoney(account.loan_details.outstanding_balance)}</div>
                    <div><span className="font-semibold">Interest Rate:</span> {account.loan_details.interest_rate}%</div>
                    <div><span className="font-semibold">Maturity Date:</span> {account.loan_details.maturity_date}</div>
                    <div><span className="font-semibold">Loan Status:</span> {account.loan_details.loan_status}</div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-4 py-3">Trx Date</th>
                        <th className="px-4 py-3">Session Date</th>
                        <th className="px-4 py-3">Trx No.</th>
                        <th className="px-4 py-3">Trx Code</th>
                        <th className="px-4 py-3">Voucher No.</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3">User Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-blue-50/80">
                        <td className="px-4 py-3 font-semibold" colSpan={10}>
                          Opening Balance: {formatMoney(account.opening_balance)}
                        </td>
                      </tr>
                      {account.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                            No transactions in the selected date range.
                          </td>
                        </tr>
                      ) : (
                        account.transactions.map((tx) => (
                          <tr
                            key={`${tx.trx_date}-${tx.trx_number}-${tx.voucher_no}`}
                            className={`border-b ${tx.debit > 0 ? "bg-rose-50/60" : tx.credit > 0 ? "bg-emerald-50/60" : ""}`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">{tx.trx_date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{tx.session_date}</td>
                            <td className="px-4 py-3 font-mono text-xs">{tx.trx_number}</td>
                            <td className="px-4 py-3">{tx.trx_code}</td>
                            <td className="px-4 py-3">{tx.voucher_no || "-"}</td>
                            <td className="px-4 py-3">{tx.description}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{tx.debit ? formatMoney(tx.debit) : ""}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{tx.credit ? formatMoney(tx.credit) : ""}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(tx.running_balance)}</td>
                            <td className="px-4 py-3">{tx.user_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t-2 font-bold ${account.summary.closing_balance >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                        <td className="px-4 py-3" colSpan={6}>
                          Total Debit: {formatMoney(account.summary.total_debit)} | Total Credit: {formatMoney(account.summary.total_credit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(account.summary.total_debit)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(account.summary.total_credit)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(account.summary.closing_balance)}</td>
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ))}

            <div className="rounded-3xl border bg-slate-950 p-5 text-white shadow-lg">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Grand Summary</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Savings Balance</div>
                  <div className="mt-1 text-lg font-bold text-emerald-300">{formatMoney(report.grand_summary.total_savings_balance)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Shares Balance</div>
                  <div className="mt-1 text-lg font-bold text-violet-300">{formatMoney(report.grand_summary.total_shares_balance)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Fixed Deposits</div>
                  <div className="mt-1 text-lg font-bold text-amber-300">{formatMoney(report.grand_summary.total_fixed_deposit_balance)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Loan Balance</div>
                  <div className="mt-1 text-lg font-bold text-rose-300">{formatMoney(report.grand_summary.total_loan_balance)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Net Worth</div>
                  <div className="mt-1 text-lg font-bold text-white">{formatMoney(report.grand_summary.net_worth)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : report ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">
            No account rows matched the selected member and filters.
            <div className="mt-2 text-sm text-slate-400">
              Try switching to All Savings, including closed accounts, or widening the date range if you know transactions exist.
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">
            Select a member and generate the report to view the statement.
          </div>
        )}
      </div>
    </ReportPageLayout>
  );
}
