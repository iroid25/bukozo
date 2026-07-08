// =============================================
// FILE: app/dashboard/configurations/accounts/page.tsx
// DESCRIPTION: Admin-side Accounts Configurations UI
// - Savings Account Types (CRUD) — actions/accountType.ts
// - Share Account Types (CRUD) — actions/accountType.ts
// - Loan Products (CRUD) — actions/loanProduct.ts
// - Three tabs: Savings, Shares, Loans
// - Dialogs have fixed footers + scrollable bodies
// - Tables get horizontal scroll when wider than viewport
// =============================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  Plus,
  Edit3,
  Trash2,
  Percent,
  Landmark,
  PiggyBank,
  TrendingUp,
  Info,
} from "lucide-react";

// import {
//   createLoanProduct,
//   deleteLoanProduct,
//   getAllLoanProducts,
//   updateLoanProduct,
// } from "@/actions/loanProduct";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------- Types ----------

type AccountTypeRow = {
  id: string;
  name: string;
  interestRate: number;
  minBalance: number;
  maxWithdrawal?: number | null;
  isDefault: boolean;
  isLoanEligible: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { accounts: number };

  // Extended fields from schema
  monthlyCharge?: number | null;
  flatWithdrawalFee?: number | null;
  withdrawalFeePercentage?: number | null;
  withdrawalFeeTiers?: string | null;
  withdrawalFrequencyDays?: number | null;
  maxWithdrawalsPerDay?: number | null;
  hasFixedPeriod?: boolean;
  fixedPeriodMonths?: number | null;
  maturityTransferAccountType?: string | null;
  isShareAccount?: boolean;
  canWithdraw?: boolean;
  earnsDividends?: boolean;
};

type LoanProductRow = {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string | null;
  isActive: boolean;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
  createdAt: string;
  updatedAt: string;
};

type WithdrawalTier = {
  min: number;
  max: number | null;
  fee: number;
};

type SystemWithdrawalConfig = {
  memberRates: WithdrawalTier[];
  institutionRates: WithdrawalTier[];
};

// ---------- Helpers ----------
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(v || 0);

const fmtPercent = (v: number) => `${v}%`;

const MONTHLY_INTEREST_CONVERSION = 12;

// ---------- Component ----------
export default function AccountsConfigurationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("savings");

  // Account types state
  const [accountTypes, setAccountTypes] = useState<AccountTypeRow[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountTypeRow | null>(
    null
  );

  // Loans state
  const [loanProducts, setLoanProducts] = useState<LoanProductRow[]>([]);
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanProductRow | null>(null);

  // System Config State
  const [systemRates, setSystemRates] = useState<SystemWithdrawalConfig | null>(null);

  // Filtered data
  const savingTypes = accountTypes.filter((at) => !at.isShareAccount);
  const shareTypes = accountTypes.filter((at) => at.isShareAccount);

  // Load data
  useEffect(() => {
    (async () => {
      setAccountLoading(true);
      try {
        const res = await fetch("/api/v1/account-types");
        const json = await res.json();
        setAccountTypes((json.data || json) as any);
      } catch {
        toast.error("Failed to load account types");
      } finally {
        setAccountLoading(false);
      }
    })();
    (async () => {
      setLoanLoading(true);
      try {
        const res = await fetch("/api/v1/loans/products");
        if (res.ok) {
          const lps = await res.json();
          setLoanProducts(lps);
        } else {
             toast.error("Failed to load loan products");
        }
      } catch {
        toast.error("Failed to load loan products");
      } finally {
        setLoanLoading(false);
      }
    })();
    (async () => {
        try {
            const res = await fetch("/api/v1/system/withdrawal-config");
            if (res.ok) {
                const data = await res.json();
                setSystemRates(data);
            }
        } catch (e) {
            console.error("Failed to load system withdrawal rates", e);
        }
    })();
  }, []);

  // ---------- Forms: Account Types ----------
  type AccountForm = {
    name: string;
    interestRate: number;
    minBalance: number;
    maxWithdrawal?: number | null;
    isDefault?: boolean;
    isLoanEligible?: boolean;

    monthlyCharge?: number | null;
    flatWithdrawalFee?: number | null;
    withdrawalFeePercentage?: number | null;
    withdrawalFrequencyDays?: number | null;
    maxWithdrawalsPerDay?: number | null;
    hasFixedPeriod?: boolean;
    fixedPeriodMonths?: number | null;
    maturityTransferAccountType?: string;
    isShareAccount?: boolean;
    canWithdraw?: boolean;
    earnsDividends?: boolean;
  };

  const accountForm = useForm<AccountForm>({
    defaultValues: {
      name: "",
      interestRate: 0,
      minBalance: 0,
      maxWithdrawal: null,
      isDefault: false,
      isLoanEligible: true,

      monthlyCharge: 0,
      flatWithdrawalFee: null,
      withdrawalFeePercentage: null,
      withdrawalFrequencyDays: null,
      maxWithdrawalsPerDay: null,
      hasFixedPeriod: false,
      fixedPeriodMonths: null,
      maturityTransferAccountType: "",
      isShareAccount: false,
      canWithdraw: true,
      earnsDividends: false,
    },
  });

  const openCreateAccount = (isShare: boolean) => {
    setEditingAccount(null);
    accountForm.reset({
      name: "",
      interestRate: 0,
      minBalance: 0,
      maxWithdrawal: null,
      isDefault: false,
      isLoanEligible: !isShare,

      monthlyCharge: 0,
      flatWithdrawalFee: null,
      withdrawalFeePercentage: null,
      withdrawalFrequencyDays: null,
      maxWithdrawalsPerDay: null,
      hasFixedPeriod: false,
      fixedPeriodMonths: null,
      maturityTransferAccountType: "",
      isShareAccount: isShare,
      canWithdraw: !isShare,
      earnsDividends: isShare,
    });
    setAccountModalOpen(true);
  };

  const openEditAccount = (row: AccountTypeRow) => {
    setEditingAccount(row);
    accountForm.reset({
      name: row.name,
      interestRate: row.interestRate,
      minBalance: row.minBalance,
      maxWithdrawal: row.maxWithdrawal ?? null,
      isDefault: row.isDefault,
      isLoanEligible: row.isLoanEligible,

      monthlyCharge:
        row.monthlyCharge === null || row.monthlyCharge === undefined
          ? 0
          : Number(row.monthlyCharge),
      flatWithdrawalFee:
        row.flatWithdrawalFee === null || row.flatWithdrawalFee === undefined
          ? null
          : Number(row.flatWithdrawalFee),
      withdrawalFeePercentage:
        row.withdrawalFeePercentage === null ||
        row.withdrawalFeePercentage === undefined
          ? null
          : Number(row.withdrawalFeePercentage),
      withdrawalFrequencyDays:
        row.withdrawalFrequencyDays === null ||
        row.withdrawalFrequencyDays === undefined
          ? null
          : Number(row.withdrawalFrequencyDays),
      maxWithdrawalsPerDay:
        row.maxWithdrawalsPerDay === null ||
        row.maxWithdrawalsPerDay === undefined
          ? null
          : Number(row.maxWithdrawalsPerDay),
      hasFixedPeriod: !!row.hasFixedPeriod,
      fixedPeriodMonths:
        row.fixedPeriodMonths === null || row.fixedPeriodMonths === undefined
          ? null
          : Number(row.fixedPeriodMonths),
      maturityTransferAccountType: row.maturityTransferAccountType || "",
      isShareAccount: !!row.isShareAccount,
      canWithdraw:
        row.canWithdraw === null || row.canWithdraw === undefined
          ? true
          : !!row.canWithdraw,
      earnsDividends: !!row.earnsDividends,
    });
    setAccountModalOpen(true);
  };

  const submitAccount = accountForm.handleSubmit(async (values) => {
    const payload: AccountForm = {
      ...values,
      interestRate: Number(values.interestRate),
      minBalance: Number(values.minBalance),
      maxWithdrawal:
        values.maxWithdrawal === null || values.maxWithdrawal === undefined
          ? null
          : Number(values.maxWithdrawal),

      monthlyCharge:
        values.monthlyCharge === undefined
          ? 0
          : values.monthlyCharge === null
            ? null
            : Number(values.monthlyCharge),
      flatWithdrawalFee:
        values.flatWithdrawalFee === null ||
        values.flatWithdrawalFee === undefined ||
        (values as any).flatWithdrawalFee === ""
          ? null
          : Number(values.flatWithdrawalFee),
      withdrawalFeePercentage:
        values.withdrawalFeePercentage === null ||
        values.withdrawalFeePercentage === undefined ||
        (values as any).withdrawalFeePercentage === ""
          ? null
          : Number(values.withdrawalFeePercentage),
      withdrawalFrequencyDays:
        values.withdrawalFrequencyDays === null ||
        values.withdrawalFrequencyDays === undefined ||
        (values as any).withdrawalFrequencyDays === ""
          ? null
          : Number(values.withdrawalFrequencyDays),
      maxWithdrawalsPerDay:
        values.maxWithdrawalsPerDay === null ||
        values.maxWithdrawalsPerDay === undefined ||
        (values as any).maxWithdrawalsPerDay === ""
          ? null
          : Number(values.maxWithdrawalsPerDay),
      fixedPeriodMonths:
        values.fixedPeriodMonths === null ||
        values.fixedPeriodMonths === undefined ||
        (values as any).fixedPeriodMonths === ""
          ? null
          : Number(values.fixedPeriodMonths),
      maturityTransferAccountType:
        (values.maturityTransferAccountType || "").trim() || "",
      hasFixedPeriod: !!values.hasFixedPeriod,
      isShareAccount: !!values.isShareAccount,
      canWithdraw: !!values.canWithdraw,
      earnsDividends: !!values.earnsDividends,
    };

    try {
      if (editingAccount) {
        const res = await fetch(`/api/v1/account-types/${editingAccount.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) return toast.error(json.error || "Update failed");
        toast.success("Account type updated");
      } else {
        const res = await fetch("/api/v1/account-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) return toast.error(json.error || "Create failed");
        toast.success("Account type created");
      }
      const atsRes = await fetch("/api/v1/account-types");
      const atsJson = await atsRes.json();
      setAccountTypes((atsJson.data || atsJson) as any);
      setAccountModalOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Operation failed");
    }
  });

  const onDeleteAccount = async (row: AccountTypeRow) => {
    try {
      const res = await fetch(`/api/v1/account-types/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Delete failed");
      toast.success("Deleted account type");
      setAccountTypes((prev) => prev.filter((x) => x.id !== row.id));
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  // ---------- Forms: Loans ----------
  type LoanForm = {
    name: string;
    minAmount: number;
    maxAmount: number;
    interestRate: number;
    repaymentPeriodDays: number;
    description?: string;
    isActive?: boolean;
    interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  };

  const loanForm = useForm<LoanForm>({
    defaultValues: {
      name: "",
      minAmount: 100000,
      maxAmount: 1000000,
      interestRate: 2.5, // Monthly default
      repaymentPeriodDays: 30,
      description: "",
      isActive: true,
      interestType: "FLAT_RATE",
    },
  });

  const openCreateLoan = () => {
    setEditingLoan(null);
    loanForm.reset({
      name: "",
      minAmount: 100000,
      maxAmount: 1000000,
      interestRate: 2.5,
      repaymentPeriodDays: 30,
      description: "",
      isActive: true,
      interestType: "FLAT_RATE",
    });
    setLoanModalOpen(true);
  };
  const openEditLoan = (row: LoanProductRow) => {
    setEditingLoan(row);
    loanForm.reset({
      name: row.name,
      minAmount: row.minAmount,
      maxAmount: row.maxAmount,
      interestRate: row.interestRate / MONTHLY_INTEREST_CONVERSION, // Convert Annual -> Monthly for display
      repaymentPeriodDays: row.repaymentPeriodDays,
      description: row.description || "",
      isActive: row.isActive,
      interestType: row.interestType || "FLAT_RATE",
    });
    setLoanModalOpen(true);
  };

  const submitLoan = loanForm.handleSubmit(async (values) => {
    const payload = {
      ...values,
      minAmount: Number(values.minAmount),
      maxAmount: Number(values.maxAmount),
      interestRate: Number(values.interestRate) * MONTHLY_INTEREST_CONVERSION, // Convert Monthly -> Annual for DB
      repaymentPeriodDays: Number(values.repaymentPeriodDays),
      interestType: values.interestType,
    };

    try {
      let response;
      if (editingLoan) {
        response = await fetch(`/api/v1/loans/products/${editingLoan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`/api/v1/loans/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok) {
           throw new Error(result.error || "Operation failed");
      }

      toast.success(editingLoan ? "Loan product updated" : "Loan product created");
      
      // Refresh list
      const res = await fetch("/api/v1/loans/products");
      if (res.ok) {
        const lps = await res.json();
        setLoanProducts(lps);
      }
      
      setLoanModalOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Operation failed");
    }
  });

  const onDeleteLoan = async (row: LoanProductRow) => {
    try {
      const response = await fetch(`/api/v1/loans/products/${row.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
         const result = await response.json();
         throw new Error(result.error || "Delete failed");
      }

      toast.success("Deleted loan product");
      setLoanProducts((prev) => prev.filter((x) => x.id !== row.id));
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  // ---------- Render Account Type Table ----------
  const renderAccountTypeTable = (
    types: AccountTypeRow[],
    loading: boolean
  ) => (
    <div className="rounded-xl border overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-12 bg-muted px-4 py-3 text-xs font-medium uppercase tracking-wide">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Interest</div>
          <div className="col-span-2">Min Balance</div>
          <div className="col-span-2">Max Withdrawal</div>
          <div className="col-span-1">Default</div>
          <div className="col-span-1">Eligible</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="divide-y">
          {loading && (
            <div className="p-6 text-sm text-muted-foreground">
              Loading account types…
            </div>
          )}
          {!loading && types.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No account types yet.
            </div>
          )}
          {!loading &&
            types.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-12 items-center px-4 py-3"
              >
                <div className="col-span-3 font-medium">{row.name}</div>
                <div className="col-span-2 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  {fmtPercent(row.interestRate)}
                </div>
                <div className="col-span-2">{fmtCurrency(row.minBalance)}</div>
                <div className="col-span-2">
                  {row.maxWithdrawal ? (
                    fmtCurrency(row.maxWithdrawal)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1">
                  {row.isDefault ? (
                    <Badge>Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </div>
                <div className="col-span-1">
                  {row.isLoanEligible ? (
                    <Badge>Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </div>
                <div className="col-span-1 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openEditAccount(row)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => onDeleteAccount(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  // ---------- UI ----------
  return (
    <div className="p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Accounts Configurations
            </h1>
            <p className="text-muted-foreground">
              Define savings products, share accounts, loan products, and
              business rules.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="savings" className="flex gap-2">
              <PiggyBank className="h-4 w-4" />
              Savings
            </TabsTrigger>
            <TabsTrigger value="shares" className="flex gap-2">
              <TrendingUp className="h-4 w-4" />
              Shares
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex gap-2">
              <Landmark className="h-4 w-4" />
              Loans
            </TabsTrigger>
          </TabsList>

          {/* SAVINGS */}
          <TabsContent value="savings" className="mt-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Savings Account Types</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create and manage savings products (Voluntary, Compulsory,
                    Junior, Fixed).
                  </p>
                </div>
                <Button
                  onClick={() => openCreateAccount(false)}
                  className="rounded-2xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </CardHeader>
              <CardContent>
                {renderAccountTypeTable(savingTypes, accountLoading)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SHARES */}
          <TabsContent value="shares" className="mt-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Share Account Types</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create and manage share accounts that earn dividends.
                  </p>
                </div>
                <Button
                  onClick={() => openCreateAccount(true)}
                  className="rounded-2xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Share Type
                </Button>
              </CardHeader>
              <CardContent>
                {renderAccountTypeTable(shareTypes, accountLoading)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOANS */}
          <TabsContent value="loans" className="mt-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Loan Products</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure commercial, asset, home improvement, payrolled
                    loans, etc.
                  </p>
                </div>
                <Button onClick={openCreateLoan} className="rounded-2xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Loan products define the interest rule that is frozen onto each loan at approval and followed through disbursement.
                  Flat-rate products stay flat globally, and reducing-balance products stay reducing globally.
                </div>
                <div className="rounded-xl border overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid grid-cols-12 bg-muted px-4 py-3 text-xs font-medium uppercase tracking-wide">
                      <div className="col-span-3">Name</div>
                      <div className="col-span-2">Interest</div>
                      <div className="col-span-2">Limits</div>
                      <div className="col-span-2">Repayment</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>
                    <div className="divide-y">
                      {loanLoading && (
                        <div className="p-6 text-sm text-muted-foreground">
                          Loading loan products…
                        </div>
                      )}
                      {!loanLoading && loanProducts.length === 0 && (
                        <div className="p-6 text-sm text-muted-foreground">
                          No loan products yet.
                        </div>
                      )}
                      {!loanLoading &&
                        loanProducts.map((row) => (
                          <div
                            key={row.id}
                            className="grid grid-cols-12 items-center px-4 py-3"
                          >
                            <div className="col-span-3">
                              <div className="font-medium">{row.name}</div>
                              {row.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {row.description}
                                </div>
                              )}
                               <div className="mt-1">
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                    {row.interestType === "REDUCING_BALANCE" ? "Reducing" : "Flat Rate"}
                                  </Badge>
                               </div>
                            </div>
                            <div className="col-span-2 flex flex-col justify-center">
                              <div className="flex items-center gap-2">
                                <Percent className="h-4 w-4" />
                                {fmtPercent(row.interestRate)} p.a.
                              </div>
                               <div className="text-xs text-muted-foreground ml-6">
                                 ({(row.interestRate/12).toFixed(2)}% p.m.)
                               </div>
                            </div>
                            <div className="col-span-2">
                              {fmtCurrency(row.minAmount)} –{" "}
                              {fmtCurrency(row.maxAmount)}
                            </div>
                            <div className="col-span-2">
                              {row.repaymentPeriodDays} days max
                            </div>
                            <div className="col-span-2">
                              {row.isActive ? (
                                <Badge>Active</Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </div>
                            <div className="col-span-1 flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditLoan(row)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => onDeleteLoan(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create / Edit Account Type Dialog */}
        <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] p-0">
            <div className="flex h-full max-h-[85vh] flex-col">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle>
                  {editingAccount
                    ? "Edit Account Type"
                    : accountForm.watch("isShareAccount")
                      ? "Create Share Account Type"
                      : "Create Savings Account Type"}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <form
                  id="account-form"
                  onSubmit={submitAccount}
                  className="space-y-6"
                >
                  {/* Basic details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        placeholder={
                          accountForm.watch("isShareAccount")
                            ? "Share Capital"
                            : "Voluntary Savings"
                        }
                        {...accountForm.register("name", {
                          required: true,
                          minLength: 3,
                        })}
                      />
                    </div>
                    <div>
                      <Label>Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...accountForm.register("interestRate", {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>
                    <div>
                      <Label>Minimum Balance (UGX)</Label>
                      <Input
                        type="number"
                        {...accountForm.register("minBalance", {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>
                    <div>
                      <Label>Max Withdrawal (UGX)</Label>
                      <Input
                        type="number"
                        placeholder="Optional"
                        {...accountForm.register("maxWithdrawal", {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Charges & Fees */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Charges & Fees</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Monthly Charge (UGX)</Label>
                        <Input
                          type="number"
                          min={0}
                          {...accountForm.register("monthlyCharge", {
                            valueAsNumber: true,
                            min: 0,
                          })}
                          placeholder="0 = none"
                        />
                      </div>
                      <div>
                        <Label>Flat Withdrawal Fee (UGX)</Label>
                        <Input
                          type="number"
                          min={0}
                          {...accountForm.register("flatWithdrawalFee", {
                            valueAsNumber: true,
                          })}
                          placeholder="Leave empty to use tiers"
                        />
                      </div>
                      <div>
                        <Label>Withdrawal Fee (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          {...accountForm.register("withdrawalFeePercentage", {
                            valueAsNumber: true,
                          })}
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground self-end">
                        Tiers can be managed under{" "}
                        <strong>Settings → Withdrawal Config</strong>.
                      </div>
                    </div>

                    {/* System Rates Reference */}
                    {systemRates && (
                        <div className="rounded-md border bg-muted/50 p-3 text-xs">
                           <div className="flex items-center gap-2 font-semibold mb-2 text-muted-foreground">
                             <Info className="h-3 w-3" />
                             <span>System Default Rates (Applied if overrides are empty)</span>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="font-medium underline mb-1">Member Rates</div>
                                {systemRates.memberRates.length === 0 ? (
                                    <div className="italic text-muted-foreground">No rates configured</div>
                                ) : (
                                    <ul className="space-y-0.5">
                                        {systemRates.memberRates.map((r, i) => (
                                            <li key={i} className="flex justify-between">
                                                <span>{fmtCurrency(r.min)} - {r.max ? fmtCurrency(r.max) : "∞"}</span>
                                                <span className="font-mono">{fmtCurrency(r.fee)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                              </div>
                              <div>
                                <div className="font-medium underline mb-1">Institution Rates</div>
                                {systemRates.institutionRates.length === 0 ? (
                                    <div className="italic text-muted-foreground">No rates configured</div>
                                ) : (
                                    <ul className="space-y-0.5">
                                        {systemRates.institutionRates.map((r, i) => (
                                            <li key={i} className="flex justify-between">
                                                <span>{fmtCurrency(r.min)} - {r.max ? fmtCurrency(r.max) : "∞"}</span>
                                                <span className="font-mono">{fmtCurrency(r.fee)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                              </div>
                           </div>
                        </div>
                    )}
                  </div>

                  {/* Withdrawal Rules */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Withdrawal Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          id="canWithdraw"
                          type="checkbox"
                          className="h-4 w-4"
                          {...accountForm.register("canWithdraw")}
                        />
                        <Label htmlFor="canWithdraw">Withdrawals Allowed</Label>
                      </div>
                      <div>
                        <Label>Cooldown (days)</Label>
                        <Input
                          type="number"
                          min={0}
                          {...accountForm.register("withdrawalFrequencyDays", {
                            valueAsNumber: true,
                          })}
                          placeholder="e.g. 90 for Junior"
                        />
                      </div>
                      <div>
                        <Label>Max Withdrawals / Day</Label>
                        <Input
                          type="number"
                          min={0}
                          {...accountForm.register("maxWithdrawalsPerDay", {
                            valueAsNumber: true,
                          })}
                          placeholder="Blank = no limit"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fixed Savings Options */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Fixed Savings Options</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          id="hasFixedPeriod"
                          type="checkbox"
                          className="h-4 w-4"
                          {...accountForm.register("hasFixedPeriod")}
                        />
                        <Label htmlFor="hasFixedPeriod">Fixed Period</Label>
                      </div>
                      <div>
                        <Label>Fixed Period (months)</Label>
                        <Input
                          type="number"
                          min={1}
                          {...accountForm.register("fixedPeriodMonths", {
                            valueAsNumber: true,
                          })}
                          placeholder="e.g. 12"
                        />
                      </div>
                      <div>
                        <Label>Maturity Transfer To</Label>
                        <Input
                          type="text"
                          {...accountForm.register(
                            "maturityTransferAccountType"
                          )}
                          placeholder="e.g. Voluntary Savings"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Share / Dividend Flags */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Shares & Dividends</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          id="isShareAccount"
                          type="checkbox"
                          className="h-4 w-4"
                          {...accountForm.register("isShareAccount")}
                          disabled={!!editingAccount}
                        />
                        <Label htmlFor="isShareAccount">Share Account</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="earnsDividends"
                          type="checkbox"
                          className="h-4 w-4"
                          {...accountForm.register("earnsDividends")}
                        />
                        <Label htmlFor="earnsDividends">Earns Dividends</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="isDefault"
                          type="checkbox"
                          className="h-4 w-4"
                          {...accountForm.register("isDefault")}
                        />
                        <Label htmlFor="isDefault">Set as default</Label>
                      </div>
                    </div>
                  </div>

                  {/* Eligibility */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Eligibility</h3>
                    <div className="flex items-center gap-2">
                      <input
                        id="isLoanEligible"
                        type="checkbox"
                        className="h-4 w-4"
                        {...accountForm.register("isLoanEligible")}
                      />
                      <Label htmlFor="isLoanEligible">Eligible for loans</Label>
                    </div>
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAccountModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" form="account-form">
                  {editingAccount ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create / Edit Loan Dialog */}
        <Dialog open={loanModalOpen} onOpenChange={setLoanModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] p-0">
            <div className="flex h-full max-h-[85vh] flex-col">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle>
                  {editingLoan ? "Edit Loan Product" : "Create Loan Product"}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <form
                  id="loan-form"
                  onSubmit={submitLoan}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        placeholder="Commercial Loan"
                        {...loanForm.register("name", { required: true })}
                      />
                    </div>
                    <div>
                      <Label>Interest Rate (% per month)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...loanForm.register("interestRate", {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>
                    <div>
                         <Label>Interest Type</Label>
                         <Select
                            onValueChange={(val) => loanForm.setValue("interestType", val as any)}
                            defaultValue={loanForm.watch("interestType")}
                            value={loanForm.watch("interestType")}
                          >
                           <SelectTrigger>
                             <SelectValue placeholder="Select interest type" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                             <SelectItem value="REDUCING_BALANCE">Reducing Balance</SelectItem>
                           </SelectContent>
                         </Select>
                         <p className="mt-1 text-xs text-muted-foreground">
                           This interest type is applied to approved and disbursed loans from this product.
                         </p>
                    </div>
                    <div>
                      <Label>Min Amount (UGX)</Label>
                      <Input
                        type="number"
                        {...loanForm.register("minAmount", {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>
                    <div>
                      <Label>Max Amount (UGX)</Label>
                      <Input
                        type="number"
                        {...loanForm.register("maxAmount", {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>
                    <div>
                      <Label>Max Period (days)</Label>
                      <Input
                        type="number"
                        {...loanForm.register("repaymentPeriodDays", {
                          valueAsNumber: true,
                          min: 1,
                        })}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        id="isActive"
                        type="checkbox"
                        className="h-4 w-4"
                        {...loanForm.register("isActive")}
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>
                  </div>
                  <div>
                    <Label>Purpose / Description</Label>
                    <Textarea
                      placeholder="Who is eligible? What is this loan for?"
                      {...loanForm.register("description")}
                    />
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLoanModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" form="loan-form">
                  {editingLoan ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
