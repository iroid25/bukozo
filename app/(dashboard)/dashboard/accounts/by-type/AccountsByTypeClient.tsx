"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Eye, CreditCard, User, Wallet, Clock, PiggyBank } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = "savings" | "shares" | "fixed-deposits" | "loans";

type AccountItem = {
  id: string;
  accountNumber: string;
  balance: number;
  status: string;
  openedAt: string;
  accountType: {
    id: string;
    name: string;
    isShareAccount: boolean;
    hasFixedPeriod: boolean;
  };
  member: {
    id: string;
    memberNumber: string;
    user: { name: string | null; phone: string | null };
  } | null;
  institution: {
    id: string;
    institutionName: string;
    institutionNumber: string;
  } | null;
  branch: { id: string; name: string } | null;
};

type FixedDepositItem = {
  id: string;
  accountNumber: string;
  principalAmount: number;
  maturityAmount: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  status: string;
  member: {
    id: string;
    memberNumber: string;
    user: { name: string | null; phone: string | null };
  } | null;
  institution: {
    id: string;
    institutionName: string;
    institutionNumber: string;
  } | null;
  branch: { id: string; name: string } | null;
};

type LoanItem = {
  id: string;
  amountGranted: number;
  outstandingBalance: number;
  status: string;
  disbursementDate: string | null;
  dueDate: string;
  member: {
    id: string;
    memberNumber: string;
    user: { name: string | null; phone: string | null };
  };
  loanApplication: { id: string; loanProduct: { id: string; name: string } };
  branch: { id: string; name: string } | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(n);
}

const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DORMANT: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-red-100 text-red-700",
  FROZEN: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-orange-100 text-orange-700",
};

const LOAN_STATUS_COLORS: Record<string, string> = {
  DISBURSED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  REPAID: "bg-gray-100 text-gray-600",
  WRITTEN_OFF: "bg-red-200 text-red-900",
  DEFAULTED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-800",
};

const FD_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  MATURED: "bg-blue-100 text-blue-700",
  WITHDRAWN: "bg-gray-100 text-gray-600",
  REVERSED: "bg-red-100 text-red-700",
};

// ─── Account Table ──────────────────────────────────────────────────────────────

function AccountTypeTable({
  data,
  loading,
  category,
  onRefresh,
}: {
  data: AccountItem[];
  loading: boolean;
  category: Category;
  onRefresh: () => void;
}) {
  const router = useRouter();

  const columns: Column<AccountItem>[] = [
    {
      accessorKey: "accountNumber",
      header: "Account",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm">{row.accountNumber}</div>
            <div className="text-xs text-gray-600">{row.accountType?.name}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: (row) =>
        row.member?.user.name || row.institution?.institutionName || "—",
      header: "Owner",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <div>
            <div className="text-sm font-medium">
              {row.member?.user.name || row.institution?.institutionName || "—"}
            </div>
            <div className="text-xs text-gray-500">
              {row.member?.memberNumber ||
                row.institution?.institutionNumber ||
                ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: (row) => (
        <span className="font-semibold text-sm">{fmt(row.balance)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          className={
            ACCOUNT_STATUS_COLORS[row.status] || "bg-gray-100 text-gray-700"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      accessorKey: (row) => row.branch?.name || "—",
      header: "Branch",
      cell: (row) => (
        <span className="text-sm text-gray-600">{row.branch?.name || "—"}</span>
      ),
    },
    {
      accessorKey: "openedAt",
      header: "Opened",
      cell: (row) => (
        <span className="text-sm text-gray-600">
          {row.openedAt ? format(new Date(row.openedAt), "dd MMM yyyy") : "—"}
        </span>
      ),
    },
  ];

  const categoryLabel =
    category === "savings" ? "Savings Accounts" : "Share Accounts";

  return (
    <DataTable<AccountItem>
      title={`${categoryLabel} (${data.length})`}
      subtitle="Click Statement to view full account ledger"
      data={data}
      columns={columns}
      keyField="id"
      isLoading={loading}
      onRefresh={onRefresh}
      filters={{
        searchFields: [
          "accountNumber",
          "member.user.name",
          "member.memberNumber",
          "institution.institutionName",
          "branch.name",
          "status",
        ],
        enableDateFilter: false,
      }}
      renderRowActions={(item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/accounts/${item.id}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Statement
        </Button>
      )}
    />
  );
}

// ─── Fixed Deposit Table ────────────────────────────────────────────────────────

function FixedDepositTable({
  data,
  loading,
  onRefresh,
}: {
  data: FixedDepositItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();

  const columns: Column<FixedDepositItem>[] = [
    {
      accessorKey: "accountNumber",
      header: "FD Number",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm font-mono">
              {row.accountNumber}
            </div>
            <div className="text-xs text-gray-500">
              {row.termMonths} months @ {row.interestRate}%
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: (row) =>
        row.member?.user.name || row.institution?.institutionName || "—",
      header: "Owner",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <div>
            <div className="text-sm font-medium">
              {row.member?.user.name || row.institution?.institutionName || "—"}
            </div>
            <div className="text-xs text-gray-500">
              {row.member?.memberNumber ||
                row.institution?.institutionNumber ||
                ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "principalAmount",
      header: "Principal",
      cell: (row) => (
        <span className="font-semibold text-sm">
          {fmt(row.principalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "maturityAmount",
      header: "Maturity Value",
      cell: (row) => (
        <span className="text-sm font-medium text-emerald-700">
          {fmt(row.maturityAmount)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          className={
            FD_STATUS_COLORS[row.status] || "bg-gray-100 text-gray-700"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      accessorKey: (row) => row.branch?.name || "—",
      header: "Branch",
      cell: (row) => (
        <span className="text-sm text-gray-600">{row.branch?.name || "—"}</span>
      ),
    },
    {
      accessorKey: "maturityDate",
      header: "Matures",
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Clock className="h-3 w-3" />
          {row.maturityDate
            ? format(new Date(row.maturityDate), "dd MMM yyyy")
            : "—"}
        </div>
      ),
    },
  ];

  return (
    <DataTable<FixedDepositItem>
      title={`Fixed Deposits (${data.length})`}
      subtitle="Click View to open the fixed deposit ledger"
      data={data}
      columns={columns}
      keyField="id"
      isLoading={loading}
      onRefresh={onRefresh}
      filters={{
        searchFields: [
          "accountNumber",
          "member.user.name",
          "member.memberNumber",
          "institution.institutionName",
          "branch.name",
          "status",
        ],
        enableDateFilter: false,
      }}
      renderRowActions={(item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/dashboard/accounts/fixed-deposits/${item.id}`)
          }
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      )}
    />
  );
}

// ─── Loan Table ────────────────────────────────────────────────────────────────

function LoanTable({
  data,
  loading,
  onRefresh,
}: {
  data: LoanItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();

  const columns: Column<LoanItem>[] = [
    {
      accessorKey: "id",
      header: "Loan",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm font-mono">
              {row.id.slice(-8).toUpperCase()}
            </div>
            <div className="text-xs text-gray-500">
              {row.loanApplication?.loanProduct?.name || "—"}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: (row) => row.member?.user.name || "—",
      header: "Member",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <div>
            <div className="text-sm font-medium">
              {row.member?.user.name || "—"}
            </div>
            <div className="text-xs text-gray-500">
              {row.member?.memberNumber || ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "amountGranted",
      header: "Granted",
      cell: (row) => (
        <span className="text-sm font-medium">{fmt(row.amountGranted)}</span>
      ),
    },
    {
      accessorKey: "outstandingBalance",
      header: "Outstanding",
      cell: (row) => (
        <span
          className={`text-sm font-semibold ${
            row.outstandingBalance > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {fmt(row.outstandingBalance)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          className={
            LOAN_STATUS_COLORS[row.status] || "bg-gray-100 text-gray-700"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      accessorKey: (row) => row.branch?.name || "—",
      header: "Branch",
      cell: (row) => (
        <span className="text-sm text-gray-600">{row.branch?.name || "—"}</span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Clock className="h-3 w-3" />
          {row.dueDate ? format(new Date(row.dueDate), "dd MMM yyyy") : "—"}
        </div>
      ),
    },
  ];

  return (
    <DataTable<LoanItem>
      title={`Loans (${data.length})`}
      subtitle="Click View to open the loan ledger and repayment schedule"
      data={data}
      columns={columns}
      keyField="id"
      isLoading={loading}
      onRefresh={onRefresh}
      filters={{
        searchFields: [
          "member.user.name",
          "member.memberNumber",
          "status",
          "branch.name",
        ],
        enableDateFilter: false,
      }}
      renderRowActions={(item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/loans/${item.id}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      )}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

const TABS: { key: Category; label: string }[] = [
  { key: "savings", label: "Savings" },
  { key: "shares", label: "Shares" },
  { key: "fixed-deposits", label: "Fixed Deposits" },
  { key: "loans", label: "Loans" },
];

export default function AccountsByTypeClient() {
  const [activeTab, setActiveTab] = useState<Category>("savings");
  const [accountData, setAccountData] = useState<AccountItem[]>([]);
  const [fxdData, setFxdData] = useState<FixedDepositItem[]>([]);
  const [loanData, setLoanData] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (category: Category) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounts/by-type?category=${category}`);
      const json = await res.json();
      if (!json.success) return;
      if (category === "loans") {
        setLoanData(json.data || []);
      } else if (category === "fixed-deposits") {
        setFxdData(json.data || []);
      } else {
        setAccountData(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch accounts by type:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  const handleTabChange = (value: string) => {
    const cat = value as Category;
    setActiveTab(cat);
    setAccountData([]);
    setFxdData([]);
    setLoanData([]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts by Type</h1>
        <p className="text-sm text-gray-500 mt-1">
          Filter accounts by product type. Click <strong>Statement</strong> to
          view the full ledger.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(["savings", "shares"] as Category[]).map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <AccountTypeTable
              data={activeTab === cat ? accountData : []}
              loading={loading && activeTab === cat}
              category={cat}
              onRefresh={() => fetchData(cat)}
            />
          </TabsContent>
        ))}

        <TabsContent value="fixed-deposits" className="mt-4">
          <FixedDepositTable
            data={fxdData}
            loading={loading && activeTab === "fixed-deposits"}
            onRefresh={() => fetchData("fixed-deposits")}
          />
        </TabsContent>

        <TabsContent value="loans" className="mt-4">
          <LoanTable
            data={loanData}
            loading={loading && activeTab === "loans"}
            onRefresh={() => fetchData("loans")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
