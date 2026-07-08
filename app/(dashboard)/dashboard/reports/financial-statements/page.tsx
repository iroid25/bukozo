"use client";

import Link from "next/link";
import { FileBarChart, Scale } from "lucide-react";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ReportItem = {
  name: string;
  href: string;
  source: string;
};

type ReportGroup = {
  title: string;
  description: string;
  sources: string[];
  icon: typeof Scale;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "Financial Statements",
    description: "Core financial reporting",
    sources: ["ledger postings", "journals", "year-end closing entries"],
    icon: Scale,
    items: [
      { name: "Balance Sheet", href: "/dashboard/reports/financial-statements/balance-sheet", source: "current assets, liabilities, equity" },
      { name: "Balance Sheet Financial Year", href: "/dashboard/reports/financial-statements/balance-sheet-financial-year", source: "year-end balances and closing entries" },
      { name: "Trial Balance", href: "/dashboard/reports/financial-statements/trial-balance", source: "debit and credit journal totals" },
      { name: "Income Statement", href: "/dashboard/reports/financial-statements/income-statement", source: "period income and expenditure" },
    ],
  },
  {
    title: "Performance",
    description: "Analysis of financial performance",
    sources: ["cash flow", "budget variance", "liquidity analysis"],
    icon: FileBarChart,
    items: [
      { name: "Cash Flow", href: "/dashboard/reports/financial-statements/cash-flow", source: "cash movement and liquidity" },
      { name: "Cash Flow Review Balance Sheet", href: "/dashboard/reports/financial-statements/cash-flow-review-balance-sheet", source: "cash-linked balance sheet accounts" },
      { name: "Cash Flow Review Profit And Loss", href: "/dashboard/reports/financial-statements/cash-flow-review-profit-loss", source: "cash-linked income and expense activity" },
      { name: "Budget vs Actual", href: "/dashboard/reports/financial-statements/budget-variance", source: "budget records versus actuals" },
    ],
  },
];

export default function FinancialStatementsMenu() {
  return (
    <ReportPageLayout
      title="Financial Statements"
      description="API-backed financial position and performance reports."
    >
      <div className="grid gap-6 p-1 md:grid-cols-2">
        {reportGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg">{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Sources: {group.sources.join(" · ")}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <group.icon className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="h-auto justify-start px-3 py-2 font-normal"
                    asChild
                  >
                    <Link href={item.href}>
                      <span className="flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.source}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ReportPageLayout>
  );
}
