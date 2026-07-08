"use client";

import Link from "next/link";
import { PiggyBank, TrendingUp, Users } from "lucide-react";

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
  icon: typeof Users;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "Account Lists",
    description: "Overview of savings accounts",
    sources: ["account opening", "active balances", "account status"],
    icon: Users,
    items: [
      {
        name: "Savings Account Listing",
        href: "/dashboard/reports/savings/savings-listing",
        source: "account openings and balances",
      },
      {
        name: "Savings Account Statement",
        href: "/dashboard/reports/savings/savings-account-statement",
        source: "transactions and running balances",
      },
      {
        name: "Balances Report",
        href: "/dashboard/reports/savings/savings-balances",
        source: "live savings balances",
      },
    ],
  },
  {
    title: "Account Status",
    description: "Tracking account statuses",
    sources: ["dormancy", "inactive states", "zero balances"],
    icon: PiggyBank,
    items: [
      {
        name: "Inactive Accounts",
        href: "/dashboard/reports/savings/inactive-accounts",
        source: "inactive account state",
      },
      {
        name: "Dormant Accounts",
        href: "/dashboard/reports/savings/dormant-accounts",
        source: "last activity and dormancy threshold",
      },
    ],
  },
  {
    title: "Transactions",
    description: "Daily cash movement and member activity",
    sources: ["deposits", "withdrawals", "reversals", "batch totals"],
    icon: TrendingUp,
    items: [
      {
        name: "Savings Transactions Report",
        href: "/dashboard/reports/savings-shares-reports/savings",
        source: "posted deposit and withdrawal transactions",
      },
      {
        name: "Savings Batch Totals Report",
        href: "/dashboard/reports/savings/savings-batch-totals",
        source: "grouped transaction batches",
      },
    ],
  },
  {
    title: "Performance",
    description: "Savings portfolio performance",
    sources: ["portfolio growth", "interest posting", "activity metrics"],
    icon: PiggyBank,
    items: [
      {
        name: "Performance Analysis",
        href: "/dashboard/reports/savings/savings-performance",
        source: "portfolio performance metrics",
      },
    ],
  },
];

export default function SavingsReportsMenu() {
  return (
    <ReportPageLayout
      title="Savings Reports"
      description="Detailed reporting on savings accounts and member deposits."
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
