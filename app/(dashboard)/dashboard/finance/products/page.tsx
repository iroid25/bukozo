"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Calculator, PiggyBank, Coins, Landmark, Info } from "lucide-react";

type Currency = number;
type SavingsProductKey = "VOLUNTARY" | "COMPULSORY" | "JUNIOR" | "FIXED";
type ShareProductKey = "ORDINARY" | "AFFILIATE" | "ASSOCIATE";
type LoanProductKey = "COMMERCIAL" | "ASSET_ACQUISITION" | "HOME_IMPROVEMENT" | "EMPLOYED";
type ReducingOrFlat = "REDUCING" | "FLAT";

function ugx(n: number) {
  return `UGX ${n.toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function calculateVoluntaryWithdrawalFee(amount: Currency): Currency {
  if (amount <= 0) return 0;
  if (amount <= 4_000_000) return 300;
  if (amount <= 5_000_000) return 500;
  if (amount <= 10_000_000) return 1_000;
  return 2_000;
}

function calcReducingEMI(principal: number, ratePercent: number, months: number) {
  if (principal <= 0 || ratePercent <= 0 || months <= 0) {
    return { monthlyInstallment: 0, totalPayable: 0, totalInterest: 0 };
  }
  const r = ratePercent / 100;
  const factor = Math.pow(1 + r, months);
  const monthlyInstallment = (principal * r * factor) / (factor - 1);
  const totalPayable = monthlyInstallment * months;
  return { monthlyInstallment, totalPayable, totalInterest: totalPayable - principal };
}

function calcFlatLoan(principal: number, annualRatePercent: number, months: number) {
  if (principal <= 0 || annualRatePercent < 0 || months <= 0) {
    return { monthlyInstallment: 0, totalPayable: 0, totalInterest: 0 };
  }
  const interest = principal * (annualRatePercent / 100) * (months / 12);
  const totalPayable = principal + interest;
  return { monthlyInstallment: totalPayable / months, totalPayable, totalInterest: interest };
}

const savingsProducts: Record<SavingsProductKey, {
  name: string; eligible: string; minDeposit: Currency; interest: string;
  monthlyCharge?: Currency; withdrawalFee: (amount?: Currency) => Currency; rules: string[];
}> = {
  VOLUNTARY: {
    name: "Voluntary Savings", eligible: "All members", minDeposit: 5_000,
    interest: "No interest", monthlyCharge: 500,
    withdrawalFee: (amount = 0) => calculateVoluntaryWithdrawalFee(amount),
    rules: ["Withdraw fee varies by amount (see calculator)", "No withdraw limits (amount or frequency per day)"],
  },
  COMPULSORY: {
    name: "Compulsory Savings", eligible: "All members", minDeposit: 1_000,
    interest: "1.8% per month", withdrawalFee: () => 300,
    rules: ["No monthly charge", "No withdraw limit (amount or number of times per day)"],
  },
  JUNIOR: {
    name: "Junior Savings", eligible: "Minors", minDeposit: 1_000,
    interest: "10% (per annum)", withdrawalFee: () => 300,
    rules: ["No monthly charge", "Withdraw allowed once every 3 months"],
  },
  FIXED: {
    name: "Fixed Savings", eligible: "All members", minDeposit: 500_000,
    interest: "10% per annum", withdrawalFee: () => 300,
    rules: ["No withdrawals during fixing period", "At maturity, funds auto-transfer to Voluntary Savings", "No monthly charge"],
  },
};

const shareProducts: Record<ShareProductKey, { name: string; eligible: string; minimum: Currency; rules: string[] }> = {
  ORDINARY: { name: "Ordinary Shares", eligible: "Ordinary members", minimum: 20_000, rules: ["Not withdrawable (can transfer between share accounts)", "Earns dividends after year-end audit"] },
  AFFILIATE: { name: "Affiliate Shares", eligible: "Affiliate members", minimum: 10_000, rules: ["Not withdrawable (can transfer between share accounts)", "Earns dividends at year-end"] },
  ASSOCIATE: { name: "Associate Shares", eligible: "Associate members", minimum: 20_000, rules: ["Not withdrawable (can transfer between share accounts)", "Earns dividends at year-end"] },
};

const loanProducts: Record<LoanProductKey, {
  name: string; eligible: string; minAmount?: Currency; maxAmount?: Currency;
  maxMonths?: number; rateLabel: string; rateType: ReducingOrFlat;
  monthlyRatePct?: number; annualRatePct?: number; notes?: string[]; hasIncompleteSpec?: boolean;
}> = {
  COMMERCIAL: { name: "Commercial Loan", eligible: "All members", minAmount: 100_000, maxAmount: 30_000_000, maxMonths: 12, rateLabel: "2.5% per month (reducing balance)", rateType: "REDUCING", monthlyRatePct: 2.5 },
  ASSET_ACQUISITION: { name: "Asset Acquisition Loan", eligible: "All members", rateLabel: "— (specify product parameters)", rateType: "REDUCING", hasIncompleteSpec: true, notes: ["Please confirm min/max amount, rate, and maximum period."] },
  HOME_IMPROVEMENT: { name: "Home Improvement Loan", eligible: "All members", minAmount: 100_000, maxAmount: 15_000_000, maxMonths: 18, rateLabel: "2.5% per month (reducing balance)", rateType: "REDUCING", monthlyRatePct: 2.5 },
  EMPLOYED: { name: "Employed Loan", eligible: "Payrolled members", maxMonths: 30, maxAmount: 15_000_000, rateLabel: "20% per annum (flat rate)", rateType: "FLAT", annualRatePct: 20 },
};

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl p-2 bg-muted"><Icon className="h-5 w-5" /></div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function FinanceProductsPage() {
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1_000_000);
  const [loanKey, setLoanKey] = useState<LoanProductKey>("COMMERCIAL");
  const [loanAmount, setLoanAmount] = useState<number>(2_000_000);
  const [loanMonths, setLoanMonths] = useState<number>(12);

  const selectedLoan = loanProducts[loanKey];

  const loanCalc = useMemo(() => {
    let principal = loanAmount || 0;
    let months = loanMonths || 0;
    if (selectedLoan.minAmount != null && selectedLoan.maxAmount != null) {
      principal = clamp(principal, selectedLoan.minAmount, selectedLoan.maxAmount);
    } else if (selectedLoan.maxAmount != null) {
      principal = clamp(principal, 0, selectedLoan.maxAmount);
    }
    if (selectedLoan.maxMonths != null) months = clamp(months, 1, selectedLoan.maxMonths);
    if (selectedLoan.rateType === "REDUCING" && selectedLoan.monthlyRatePct) {
      return { ...calcReducingEMI(principal, selectedLoan.monthlyRatePct, months), principal, months };
    }
    if (selectedLoan.rateType === "FLAT" && selectedLoan.annualRatePct != null) {
      return { ...calcFlatLoan(principal, selectedLoan.annualRatePct, months), principal, months };
    }
    return { monthlyInstallment: 0, totalPayable: 0, totalInterest: 0, principal, months };
  }, [loanAmount, loanMonths, loanKey]);

  return (
    <div className="px-4 md:px-8 lg:px-12 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & Fees Overview</h1>
          <p className="text-sm text-muted-foreground">
            A concise, interactive view of Savings products, Share classes, and Loan products — with built-in fee/interest simulators.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <SectionHeader icon={PiggyBank} title="Savings Accounts" description="Rules, charges, and withdrawal fees per product." />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(savingsProducts) as [SavingsProductKey, (typeof savingsProducts)[SavingsProductKey]][]).map(([key, p]) => (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="text-xs">Eligible: {p.eligible}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Minimum deposit</span>
                    <span className="font-medium">{ugx(p.minDeposit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Interest</span>
                    <span className="font-medium">{p.interest}</span>
                  </div>
                  {"monthlyCharge" in p && p.monthlyCharge != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly charge</span>
                      <span className="font-medium">{ugx(p.monthlyCharge!)}</span>
                    </div>
                  )}
                  <div className="pt-2 space-y-1">
                    {p.rules.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <p className="text-xs leading-snug text-muted-foreground">{r}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />Voluntary Withdrawal Fee Calculator
                </CardTitle>
                <CardDescription>Tiered fee based on withdrawn amount.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="withdrawAmount">Withdrawal amount (UGX)</Label>
                  <Input id="withdrawAmount" type="number" min={0} step={1000} value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(parseInt(e.target.value || "0", 10))} />
                </div>
                <div className="rounded-xl border p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fee payable</span>
                  <Badge variant="secondary" className="text-base">{ugx(calculateVoluntaryWithdrawalFee(withdrawAmount))}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compulsory/Junior/Fixed withdrawal fee is <span className="font-medium">{ugx(300)}</span> where withdrawals are permitted by product rules.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-4 w-4" />Monthly Charges (Quick Reference)
                </CardTitle>
                <CardDescription>Products with maintenance fees.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Voluntary Savings</span>
                  <Badge variant="outline">{ugx(500)}/month</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Compulsory / Junior / Fixed</span>
                  <Badge variant="outline">No monthly charge</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader icon={Landmark} title="Share Classes" description="Minimums, eligibility, and dividend rules." />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {(Object.entries(shareProducts) as [ShareProductKey, (typeof shareProducts)[ShareProductKey]][]).map(([key, s]) => (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription className="text-xs">Eligible: {s.eligible}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Minimum</span>
                    <span className="font-medium">{ugx(s.minimum)}</span>
                  </div>
                  <div className="pt-2 space-y-1">
                    {s.rules.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <p className="text-xs leading-snug text-muted-foreground">{r}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader icon={Coins} title="Loan Products" description="Eligibility, limits, and interest methods, plus a repayment simulator." />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(loanProducts) as [LoanProductKey, (typeof loanProducts)[LoanProductKey]][]).map(([key, l]) => (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{l.name}</CardTitle>
                  <CardDescription className="text-xs">Eligible: {l.eligible}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium">{l.rateLabel}</span>
                  </div>
                  {l.minAmount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Min Amount</span>
                      <span className="font-medium">{ugx(l.minAmount)}</span>
                    </div>
                  )}
                  {l.maxAmount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Amount</span>
                      <span className="font-medium">{ugx(l.maxAmount)}</span>
                    </div>
                  )}
                  {l.maxMonths != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Tenure</span>
                      <span className="font-medium">{l.maxMonths} months</span>
                    </div>
                  )}
                  {l.hasIncompleteSpec && l.notes?.length ? (
                    <div className="pt-1 space-y-1">
                      {l.notes.map((n, i) => <p key={i} className="text-xs leading-snug text-muted-foreground">• {n}</p>)}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />Loan Repayment Simulator
              </CardTitle>
              <CardDescription>Calculates installments based on each product's method (reducing vs flat).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={loanKey} onValueChange={(v) => setLoanKey(v as LoanProductKey)}>
                <TabsList className="flex flex-wrap">
                  {Object.entries(loanProducts).map(([key, v]) => (
                    <TabsTrigger key={key} value={key}>{v.name}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={loanKey} className="mt-4 space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="loanAmount">Loan amount (UGX)</Label>
                      <Input id="loanAmount" type="number" min={0} step={10000} value={loanAmount}
                        onChange={(e) => setLoanAmount(parseInt(e.target.value || "0", 10))} />
                      {(selectedLoan.minAmount != null || selectedLoan.maxAmount != null) && (
                        <p className="text-xs text-muted-foreground">
                          {selectedLoan.minAmount != null && `Min ${ugx(selectedLoan.minAmount)} `}
                          {selectedLoan.maxAmount != null && `• Max ${ugx(selectedLoan.maxAmount)}`}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="loanMonths">Tenure (months)</Label>
                      <Input id="loanMonths" type="number" min={1} step={1} value={loanMonths}
                        onChange={(e) => setLoanMonths(parseInt(e.target.value || "0", 10))} />
                      {selectedLoan.maxMonths != null && (
                        <p className="text-xs text-muted-foreground">Max {selectedLoan.maxMonths} months</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Rate method</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {selectedLoan.rateType === "REDUCING"
                            ? `Reducing @ ${selectedLoan.monthlyRatePct}%/mo`
                            : `Flat @ ${selectedLoan.annualRatePct}% p.a.`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 grid md:grid-cols-4 gap-4">
                    <Stat label="Principal" value={ugx(loanCalc.principal || 0)} />
                    <Stat label="Tenure" value={`${loanCalc.months || 0} months`} />
                    <Stat label="Monthly Installment" value={ugx(Math.round(loanCalc.monthlyInstallment || 0))} />
                    <Stat label="Total Interest" value={ugx(Math.round(loanCalc.totalInterest || 0))} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: Reducing-balance EMI uses a standard amortization formula. Flat-rate spreads total interest evenly across all months.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
