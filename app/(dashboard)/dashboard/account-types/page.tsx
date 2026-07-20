"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TableLoading } from "@/components/ui/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AccountTypeListing from "./components/AccountTypeListing";
import type { AccountType } from "@/types/accountTypes";

const REQUIRED_SAVINGS = [
  "Voluntary Savings",
  "Compulsory Savings",
  "Fixed Savings",
  "Junior Savings",
  "Joint Savings",
];

const REQUIRED_SHARES = [
  "Ordinary Shares",
  "Affiliate Shares",
  "Associate Shares",
];
const REQUIRED_LOAN_INSURANCE = ["Loan Insurance"];

const isLoanInsuranceType = (accountType: AccountType) => {
  const name = accountType.name.trim().toLowerCase();
  const ledgerName = accountType.ledgerAccount?.accountName?.trim().toLowerCase() ?? "";
  const ledgerCode = accountType.ledgerAccount?.accountCode ?? "";

  return (
    name.includes("loan insurance") ||
    ledgerName.includes("loan insurance") ||
    ledgerCode === "200600"
  );
};

export default function AccountTypesPage() {
  const { data: session, status } = useSession();
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [activeTab, setActiveTab] = useState("savings");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role ?? "";

  const loadAccountTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/account-types", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch account types");
      setAccountTypes(data.data || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch account types");
      setAccountTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void loadAccountTypes();
  }, [status, loadAccountTypes]);

  async function handleInitialize() {
    try {
      setInitializing(true);
      const res = await fetch("/api/v1/account-types/initialize", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Initialization failed", { description: data.error });
        return;
      }
      toast.success("BUTCS products initialized", {
        description: `${data.upserted?.length ?? 0} products set up${data.removed?.length ? `, ${data.removed.length} legacy types removed` : ""}.`,
      });
      await loadAccountTypes();
    } catch {
      toast.error("Initialization failed");
    } finally {
      setInitializing(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <TableLoading />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <Alert>
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please sign in to view account types.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const savingsAccountTypes = accountTypes.filter(
    (at) =>
      !at.isShareAccount &&
      at.ledgerAccount?.ledgerType !== "EQUITY" &&
      !isLoanInsuranceType(at),
  );
  const shareAccountTypes = accountTypes.filter(
    (at) => at.isShareAccount || at.ledgerAccount?.ledgerType === "EQUITY",
  );
  const insurancePoolAccountTypes = accountTypes.filter(isLoanInsuranceType);

  const savingsNames = savingsAccountTypes.map((at) => at.name.trim());
  const shareNames = shareAccountTypes.map((at) => at.name.trim());
  const missingProducts = [
    ...REQUIRED_SAVINGS.filter((n) => !savingsNames.includes(n)),
    ...REQUIRED_SHARES.filter((n) => !shareNames.includes(n)),
    ...REQUIRED_LOAN_INSURANCE.filter(
      (n) => !insurancePoolAccountTypes.some((at) => at.name.trim() === n),
    ),
  ];
  const needsInit = missingProducts.length > 0 && userRole === "ADMIN";

  const savingsAccountsCreated = savingsAccountTypes.reduce(
    (sum, at) => sum + (at._count?.accounts || 0), 0,
  );
  const shareAccountsCreated = shareAccountTypes.reduce(
    (sum, at) => sum + (at._count?.accounts || 0), 0,
  );
  const insurancePoolAccountsCreated = insurancePoolAccountTypes.reduce(
    (sum, at) => sum + (at._count?.accounts || 0), 0,
  );
  const linkedToLedgerCount = accountTypes.filter((at) => !!at.ledgerAccountId).length;

  const activeTitle =
    activeTab === "shares"
      ? `Share Account Types (${shareAccountTypes.length})`
      : `Savings Account Types (${savingsAccountTypes.length})`;
  const activeSubtitle =
    activeTab === "shares"
      ? "Manage member share capital products mapped to equity."
      : "Manage member savings products mapped to liabilities.";

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load account types</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Missing BUTCS products banner */}
      {needsInit && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                BUTCS savings products not fully set up
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Missing:{" "}
                <span className="font-medium">{missingProducts.join(", ")}</span>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Click initialize to create all 8 required products with correct configurations.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleInitialize}
            disabled={initializing}
          >
            {initializing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Initializing…</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Initialize BUTCS Products</>
            )}
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Savings Products</div>
            <div className="mt-2 text-2xl font-semibold">{savingsAccountTypes.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {savingsAccountsCreated} member accounts under liabilities
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Share Products</div>
            <div className="mt-2 text-2xl font-semibold">{shareAccountTypes.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {shareAccountsCreated} member accounts under equity
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Loan Insurance</div>
            <div className="mt-2 text-2xl font-semibold">{insurancePoolAccountTypes.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {insurancePoolAccountsCreated} accounts tied to 200600 - Loan Insurance
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Linked Ledger Accounts</div>
            <div className="mt-2 text-2xl font-semibold">{linkedToLedgerCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {accountTypes.length - linkedToLedgerCount} types still need review
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-[620px]">
          <TabsTrigger value="savings">
            Savings Accounts ({savingsAccountTypes.length})
          </TabsTrigger>
          <TabsTrigger value="shares">
            Share Accounts ({shareAccountTypes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="savings" className="space-y-4">
          <AccountTypeListing
            title={activeTitle}
            subtitle={activeSubtitle}
            accountTypes={savingsAccountTypes}
            userRole={userRole || "ADMIN"}
            exportFilePrefix="Savings_Account_Types"
            createDefaults={{ isShareAccount: false, canWithdraw: true }}
          />
        </TabsContent>

        <TabsContent value="shares" className="space-y-4">
          <AccountTypeListing
            title={activeTitle}
            subtitle={activeSubtitle}
            accountTypes={shareAccountTypes}
            userRole={userRole || "ADMIN"}
            exportFilePrefix="Share_Account_Types"
            createDefaults={{ isShareAccount: true, canWithdraw: false }}
          />
        </TabsContent>

        <TabsContent value="loan-insurance" className="space-y-4">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="font-semibold">Loan Insurance is the deduction flow under Insurance Pool.</p>
                <p className="text-purple-800">
                  It is deducted from approved loans, posted to 200600 - Loan Insurance, and surfaced in liabilities and reporting in real time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/accounts/liabilities"
                  className="rounded-full border border-purple-300 bg-white px-4 py-2 text-xs font-semibold text-purple-800 transition hover:bg-purple-100"
                >
                  Open Liabilities
                </Link>
                <Link
                  href="/dashboard/reports/savings/savings-listing"
                  className="rounded-full border border-purple-300 bg-white px-4 py-2 text-xs font-semibold text-purple-800 transition hover:bg-purple-100"
                >
                  Open Savings Listing
                </Link>
              </div>
            </div>
          </div>

          <AccountTypeListing
            title={activeTitle}
            subtitle={activeSubtitle}
            accountTypes={insurancePoolAccountTypes}
            userRole={userRole || "ADMIN"}
            exportFilePrefix="Insurance_Pool_Account_Types"
            createDefaults={{
              isShareAccount: false,
              canWithdraw: false,
              isLoanEligible: false,
              minBalance: 0,
              interestRate: 0,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
