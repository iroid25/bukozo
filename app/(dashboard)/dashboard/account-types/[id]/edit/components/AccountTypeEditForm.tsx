// @ts-nocheck
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  Wallet, Percent, DollarSign, CreditCard, CheckCircle,
  XCircle, Lock, CalendarDays, ArrowRightLeft, Clock, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { toast } from "sonner";
import type { AccountType } from "@/types/accountTypes";

const UGX = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(n || 0);

const FIXED_PERIOD_OPTIONS = [3, 6, 9, 12] as const;

interface Props {
  accountType: AccountType & { interestPeriod?: string };
}

export default function AccountTypeEditForm({ accountType }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: accountType.name ?? "",
      interestRate: accountType.interestRate ?? 0,
      minBalance: accountType.minBalance ?? 0,
      monthlyCharge: (accountType as any).monthlyCharge ?? null,
      flatWithdrawalFee: (accountType as any).flatWithdrawalFee ?? null,
      withdrawalFrequencyDays: (accountType as any).withdrawalFrequencyDays ?? null,
      maxWithdrawal: accountType.maxWithdrawal ?? null,
      isLoanEligible: accountType.isLoanEligible ?? true,
      canWithdraw: accountType.canWithdraw ?? true,
      isShareAccount: accountType.isShareAccount ?? false,
      isDefault: accountType.isDefault ?? false,
      earnsDividends: (accountType as any).earnsDividends ?? false,
      sharePrice: (accountType as any).sharePrice ?? null,
      hasFixedPeriod: accountType.hasFixedPeriod ?? false,
      fixedPeriodMonths: accountType.fixedPeriodMonths ?? null,
      maturityTransferAccountType: accountType.maturityTransferAccountType ?? "",
      ledgerAccountId: accountType.ledgerAccountId ?? null,
    },
  });

  const [loading, setLoading] = useState(false);
  const [interestPeriod, setInterestPeriod] = useState<"MONTHLY" | "ANNUALLY">(
    (accountType.interestPeriod as any) ?? "ANNUALLY"
  );
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);

  const watchedIsLoanEligible = watch("isLoanEligible");
  const watchedCanWithdraw = watch("canWithdraw");
  const watchedIsShareAccount = watch("isShareAccount");
  const watchedIsDefault = watch("isDefault");
  const watchedEarnsDividends = watch("earnsDividends");
  const watchedHasFixedPeriod = watch("hasFixedPeriod");
  const watchedFixedPeriodMonths = watch("fixedPeriodMonths");

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const endpoint = watchedIsShareAccount
          ? "/api/v1/accounts/equity"
          : "/api/v1/accounts/liabilities";
        const res = await fetch(endpoint);
        if (res.ok) {
          const json = await res.json();
          setLedgerAccounts(json.data || []);
        }
      } catch {
        // non-critical
      }
    };
    void fetchAccounts();
  }, [watchedIsShareAccount]);

  async function onSubmit(data: any) {
    try {
      setLoading(true);

      const payload = {
        ...data,
        interestRate: Number(data.interestRate),
        interestPeriod,
        minBalance: Number(data.minBalance),
        monthlyCharge: data.monthlyCharge ? Number(data.monthlyCharge) : null,
        flatWithdrawalFee: data.flatWithdrawalFee ? Number(data.flatWithdrawalFee) : null,
        withdrawalFrequencyDays: data.withdrawalFrequencyDays ? Number(data.withdrawalFrequencyDays) : null,
        maxWithdrawal: data.maxWithdrawal ? Number(data.maxWithdrawal) : null,
        fixedPeriodMonths: data.fixedPeriodMonths ? Number(data.fixedPeriodMonths) : null,
        maturityTransferAccountType: (data.maturityTransferAccountType as string)?.trim() || null,
        sharePrice: data.sharePrice ? Number(data.sharePrice) : null,
        earnsDividends: data.earnsDividends ?? false,
      };

      const response = await fetch(`/api/v1/account-types/${accountType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to update account type", { description: result.error });
        return;
      }

      toast.success("Account type updated successfully");
      router.push(`/dashboard/account-types/${accountType.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b">
      {children}
    </h3>
  );

  const ToggleRow = ({
    id, label, description, checked, onChange, trueColor = "text-emerald-600", falseColor = "text-rose-600",
  }: {
    id: string; label: string; description?: string; checked: boolean;
    onChange: (v: boolean) => void; trueColor?: string; falseColor?: string;
  }) => (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3">
        {checked
          ? <CheckCircle className={`h-4 w-4 ${trueColor}`} />
          : <XCircle className={`h-4 w-4 ${falseColor}`} />}
        <div>
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">

          {/* ── 1. Basic Information ── */}
          <div>
            <SectionTitle>Basic Information</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                register={register}
                errors={errors}
                label="Account Type Name *"
                name="name"
                icon={Wallet}
                placeholder="e.g., Voluntary Savings"
                validation={{
                  required: "Name is required",
                  minLength: { value: 3, message: "At least 3 characters" },
                  maxLength: { value: 50, message: "Max 50 characters" },
                }}
              />
              <div className="space-y-2">
                <Label>Interest Period</Label>
                <Select
                  value={interestPeriod}
                  onValueChange={(v) => setInterestPeriod(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANNUALLY">Annually (p.a.)</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How often interest is compounded / paid.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <ToggleRow
                id="isShareAccount"
                label="Share / Equity Account"
                description="Tick for share capital; untick for savings (liability)"
                checked={watchedIsShareAccount}
                onChange={(v) => setValue("isShareAccount", v)}
                trueColor="text-violet-600"
                falseColor="text-slate-500"
              />
              <ToggleRow
                id="isDefault"
                label="Default Account Type"
                description="Auto-assigned to new members on registration"
                checked={watchedIsDefault}
                onChange={(v) => setValue("isDefault", v)}
                trueColor="text-sky-600"
                falseColor="text-slate-500"
              />
            </div>
          </div>

          {/* ── 2. Financial Settings ── */}
          <div>
            <SectionTitle>Financial Settings</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                register={register}
                errors={errors}
                label="Interest Rate (%)"
                name="interestRate"
                type="number"
                step="0.01"
                icon={Percent}
                validation={{
                  required: "Required",
                  min: { value: 0, message: "Cannot be negative" },
                  max: { value: 100, message: "Max 100%" },
                }}
              />
              <TextInput
                register={register}
                errors={errors}
                label="Minimum Balance (UGX)"
                name="minBalance"
                type="number"
                icon={DollarSign}
                validation={{
                  required: "Required",
                  min: { value: 0, message: "Cannot be negative" },
                }}
              />
              <TextInput
                register={register}
                errors={errors}
                label="Monthly Service Charge (UGX)"
                name="monthlyCharge"
                type="number"
                icon={CalendarDays}
                placeholder="0 = no charge"
              />
            </div>
          </div>

          {/* ── 3. Share Settings (only for share/equity accounts) ── */}
          {watchedIsShareAccount && (
            <div>
              <SectionTitle>Share Settings</SectionTitle>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Share Price (UGX per share)"
                    name="sharePrice"
                    type="number"
                    icon={DollarSign}
                    placeholder="e.g., 20000"
                    validation={{
                      min: { value: 1, message: "Share price must be positive" },
                    }}
                  />
                  <div className="flex flex-col justify-end pb-0.5">
                    <ToggleRow
                      id="earnsDividends"
                      label="Earns Dividends"
                      description="Share earns dividend from annual surplus"
                      checked={watchedEarnsDividends}
                      onChange={(v) => setValue("earnsDividends", v)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  Share accounts are <strong>not withdrawable</strong> but are transferable between share accounts. Dividend rate is determined at year-end based on surplus — not a fixed percentage.
                </p>
              </div>
            </div>
          )}

          {/* ── 4. Withdrawal Settings ── */}
          <div>
            <SectionTitle>Withdrawal Settings</SectionTitle>
            <div className="space-y-3">
              <ToggleRow
                id="canWithdraw"
                label="Allow Direct Withdrawal"
                description="Members can withdraw at the counter. Disable for compulsory / locked products."
                checked={watchedCanWithdraw}
                onChange={(v) => setValue("canWithdraw", v)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Flat Withdrawal Fee (UGX)"
                  name="flatWithdrawalFee"
                  type="number"
                  icon={DollarSign}
                  placeholder="Leave blank to use tiered fees"
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Max Single Withdrawal (UGX)"
                  name="maxWithdrawal"
                  type="number"
                  icon={CreditCard}
                  placeholder="Leave blank for no limit"
                />
              </div>
              <TextInput
                register={register}
                errors={errors}
                label="Withdrawal Cooldown (days)"
                name="withdrawalFrequencyDays"
                type="number"
                icon={Clock}
                placeholder="e.g., 120 for Junior Savings (once per 4 months)"
              />
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Tiered withdrawal fees (UGX 300 / 500 / 700 / 1,000 by amount) are managed on the <strong>Fees</strong> tab of this account type.
              </p>
            </div>
          </div>

          {/* ── 4. Fixed Term Settings ── */}
          <div>
            <SectionTitle>Fixed Term Settings</SectionTitle>
            <div className="space-y-3">
              <ToggleRow
                id="hasFixedPeriod"
                label="Fixed-Term Deposit"
                description="Funds locked for a set period; early withdrawal forfeits interest."
                checked={watchedHasFixedPeriod}
                onChange={(v) => {
                  setValue("hasFixedPeriod", v);
                  if (!v) {
                    setValue("fixedPeriodMonths", null);
                    setValue("maturityTransferAccountType", "");
                  }
                }}
                trueColor="text-amber-600"
                falseColor="text-slate-500"
              />
              {watchedHasFixedPeriod && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-amber-400 ml-1">
                  <div className="space-y-2">
                    <Label>Default Fixed Period (optional)</Label>
                    <Select
                      value={watchedFixedPeriodMonths?.toString() ?? ""}
                      onValueChange={(v) =>
                        setValue("fixedPeriodMonths", v ? Number(v) : null)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chosen at account opening" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Chosen at account opening</SelectItem>
                        {FIXED_PERIOD_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m.toString()}>{m} months</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Leave blank — teller picks 3 / 6 / 9 / 12 months when opening each account.
                    </p>
                  </div>
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Mature Into Account Type"
                    name="maturityTransferAccountType"
                    icon={ArrowRightLeft}
                    placeholder="e.g., Voluntary Savings"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Loan Settings ── */}
          <div>
            <SectionTitle>Loan Settings</SectionTitle>
            <ToggleRow
              id="isLoanEligible"
              label="Loan Eligible"
              description="Balance in this account type counts toward loan eligibility."
              checked={watchedIsLoanEligible}
              onChange={(v) => setValue("isLoanEligible", v)}
            />
          </div>

          {/* ── 6. GL Mapping ── */}
          <div>
            <SectionTitle>Chart of Accounts Mapping</SectionTitle>
            <div className="space-y-2">
              <Label>Linked GL Account</Label>
              <Select
                value={watch("ledgerAccountId") || undefined}
                onValueChange={(val) => setValue("ledgerAccountId", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GL account" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountCode} — {acc.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountType.ledgerAccount && (
                <p className="text-xs text-muted-foreground">
                  Currently linked to: <strong>{accountType.ledgerAccount.accountCode} — {accountType.ledgerAccount.accountName}</strong>
                </p>
              )}
            </div>
          </div>

          {/* ── Live Summary ── */}
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-sm mb-2">Current Configuration</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{watch("name") || "—"}</span>

              <span className="text-muted-foreground">Interest</span>
              <span className="font-medium">
                {watch("interestRate") || 0}% {interestPeriod === "ANNUALLY" ? "p.a." : "/ month"}
              </span>

              <span className="text-muted-foreground">Min Balance</span>
              <span className="font-medium">{UGX(Number(watch("minBalance")))}</span>

              <span className="text-muted-foreground">Monthly Charge</span>
              <span className="font-medium">
                {watch("monthlyCharge") ? UGX(Number(watch("monthlyCharge"))) : "None"}
              </span>

              <span className="text-muted-foreground">Can Withdraw</span>
              <span className={watchedCanWithdraw ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                {watchedCanWithdraw ? "Yes" : "No"}
              </span>

              {watchedHasFixedPeriod && (
                <>
                  <span className="text-muted-foreground">Fixed Period</span>
                  <span className="font-medium">
                    {watchedFixedPeriodMonths ? `${watchedFixedPeriodMonths} months` : "Not set"}
                  </span>
                </>
              )}

              {watch("withdrawalFrequencyDays") && (
                <>
                  <span className="text-muted-foreground">Withdrawal Cooldown</span>
                  <span className="font-medium">Every {watch("withdrawalFrequencyDays")} days</span>
                </>
              )}

              <span className="text-muted-foreground">Loan Eligible</span>
              <span className="font-medium">{watchedIsLoanEligible ? "Yes" : "No"}</span>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button type="button" variant="outline" asChild>
              <Link href={`/dashboard/account-types/${accountType.id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Link>
            </Button>
            <SubmitButton
              title="Save Changes"
              loading={loading}
            />
          </div>

        </CardContent>
      </Card>
    </form>
  );
}
