"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  Lock,
  Baby,
  TrendingUp,
  Clock,
  ShieldCheck,
  ArrowRightLeft,
  CalendarDays,
  Banknote,
  AlertCircle,
  Star,
} from "lucide-react";

interface ProductSpec {
  name: string;
  tagline: string;
  icon: React.ElementType;
  iconColor: string;
  cardAccent: string;
  badges: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }[];
  rows: { label: string; value: string }[];
  note?: string;
}

const PRODUCTS: ProductSpec[] = [
  {
    name: "Voluntary Savings",
    tagline: "Default account — every member must hold this",
    icon: Wallet,
    iconColor: "text-sky-600",
    cardAccent: "border-t-4 border-t-sky-500",
    badges: [
      { label: "Default", variant: "default" },
      { label: "Loan Eligible", variant: "secondary" },
      { label: "Anytime Withdrawal", variant: "secondary" },
    ],
    rows: [
      { label: "Interest",        value: "None (0%)" },
      { label: "Minimum Deposit", value: "UGX 5,000" },
      { label: "Monthly Fee",     value: "UGX 500 service charge" },
      { label: "Withdrawal Fee",  value: "UGX 300 – 1,000 (tiered by amount)" },
      { label: "Lock Period",     value: "None — withdraw at any time" },
      { label: "Loan Eligible",   value: "Yes" },
    ],
    note: "This is the primary operating account. All other products are funded from or mature into this account.",
  },
  {
    name: "Compulsory Savings",
    tagline: "Interest-bearing savings locked for 12 months",
    icon: Lock,
    iconColor: "text-amber-600",
    cardAccent: "border-t-4 border-t-amber-500",
    badges: [
      { label: "18% p.a.", variant: "default" },
      { label: "12-Month Lock", variant: "outline" },
      { label: "Loan Eligible", variant: "secondary" },
    ],
    rows: [
      { label: "Interest",        value: "18% per annum" },
      { label: "Minimum Deposit", value: "None" },
      { label: "Monthly Fee",     value: "None" },
      { label: "Withdrawal Fee",  value: "Standard after lock period" },
      { label: "Lock Period",     value: "12 months from account opening" },
      { label: "Loan Eligible",   value: "Yes" },
    ],
    note: "Withdrawal is blocked for the first 12 months. After that, the member may withdraw freely.",
  },
  {
    name: "Fixed Savings",
    tagline: "Fixed-term deposit: 3 / 6 / 9 / 12 months",
    icon: TrendingUp,
    iconColor: "text-indigo-600",
    cardAccent: "border-t-4 border-t-indigo-500",
    badges: [
      { label: "10% p.a.", variant: "default" },
      { label: "Fixed Term", variant: "outline" },
      { label: "4 Variants", variant: "secondary" },
    ],
    rows: [
      { label: "Interest",          value: "10% per annum (only if held to maturity)" },
      { label: "Minimum Deposit",   value: "UGX 500,000" },
      { label: "Monthly Fee",       value: "None" },
      { label: "Early Withdrawal",  value: "Allowed but earns NO interest" },
      { label: "Term Options",      value: "3 months | 6 months | 9 months | 12 months" },
      { label: "Funding Source",    value: "Must be transferred from Voluntary Savings" },
      { label: "At Maturity",       value: "Funds returned to Voluntary Savings" },
      { label: "Loan Eligible",     value: "No" },
    ],
    note: "Each term is a separate product. Members choose their preferred period at opening.",
  },
  {
    name: "Junior Savings",
    tagline: "Children under 18 — attached to a guardian's account",
    icon: Baby,
    iconColor: "text-emerald-600",
    cardAccent: "border-t-4 border-t-emerald-500",
    badges: [
      { label: "10% p.a.", variant: "default" },
      { label: "Under 18 Only", variant: "secondary" },
      { label: "Once per 4 Months", variant: "outline" },
    ],
    rows: [
      { label: "Interest",           value: "10% per annum" },
      { label: "Minimum Deposit",    value: "None" },
      { label: "Monthly Fee",        value: "None" },
      { label: "Withdrawal Fee",     value: "UGX 300 – 1,000 (tiered by amount)" },
      { label: "Withdrawal Limit",   value: "Once every 4 months (120 days)" },
      { label: "Eligibility",        value: "Members under 18 years of age only" },
      { label: "Guardian Required",  value: "Linked to a parent/guardian member account" },
      { label: "Loan Eligible",      value: "No" },
    ],
    note: "The guardian (parent) must be an active BUTCS member. The child's account is linked to the guardian's member record.",
  },
];

function ProductCard({ spec }: { spec: ProductSpec }) {
  const Icon = spec.icon;
  return (
    <Card className={`h-full ${spec.cardAccent} shadow-sm`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className={`h-5 w-5 ${spec.iconColor}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{spec.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{spec.tagline}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {spec.badges.map((b) => (
            <Badge key={b.label} variant={b.variant} className="text-[10px] px-1.5 py-0">
              {b.label}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/50 divide-y text-xs">
          {spec.rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 px-3 py-1.5">
              <span className="text-muted-foreground shrink-0">{row.label}</span>
              <span className="font-medium text-right">{row.value}</span>
            </div>
          ))}
        </div>
        {spec.note && (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed">{spec.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductSpecsPanel() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border">
          <ShieldCheck className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            BUTCS Savings Product Specifications
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Official product conditions for Bukonzo United Teachers&apos; SACCO — staff reference guide
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> Default: Voluntary</span>
          <span className="flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500" /> Fixed ↔ Voluntary</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-emerald-500" /> Junior: 4-month cycle</span>
          <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5 text-sky-500" /> Fees: UGX 300–1,000</span>
        </div>
      </div>

      {/* Product cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRODUCTS.map((spec) => (
          <ProductCard key={spec.name} spec={spec} />
        ))}
      </div>

      {/* Withdrawal flow note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-semibold">Withdrawal Flow Rules</p>
            <ul className="space-y-0.5 list-disc ml-4">
              <li>Only <strong>Voluntary Savings</strong> accounts allow direct counter withdrawal.</li>
              <li><strong>Compulsory Savings</strong> — no withdrawal for the first 12 months from account opening.</li>
              <li><strong>Fixed Savings</strong> — funded by transferring from Voluntary Savings; matures back to Voluntary Savings. Early withdrawal forfeits interest.</li>
              <li><strong>Junior Savings</strong> — maximum one withdrawal per 4 months (120 days). Guardian must authorise.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
