"use client";

import Link from "next/link";
import { Archive, Clock, FileText } from "lucide-react";

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
  icon: typeof Archive;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "General Listings",
    description: "Overview of fixed deposit accounts",
    sources: ["fixed deposit opening", "active balances", "portfolio grouping"],
    icon: Archive,
    items: [
      { name: "Fixed Concentration", href: "/dashboard/reports/fixed-concentration", source: "portfolio concentration" },
      { name: "FD Listing", href: "/dashboard/reports/fixed-deposits/listing", source: "opening balances and statuses" },
      { name: "Active Deposits", href: "/dashboard/reports/fixed-deposits/active", source: "active fixed deposit status" },
    ],
  },
  {
    title: "Statements & Activity",
    description: "Detailed account statements and history",
    sources: ["transaction history", "interest accrual", "account lifecycle"],
    icon: FileText,
    items: [
      { name: "Account Statement", href: "/dashboard/reports/fixed-deposits/statement", source: "fixed deposit statement history" },
    ],
  },
  {
    title: "Maturity & Withdrawals",
    description: "Tracking maturity dates and fluid capital",
    sources: ["maturity schedules", "withdrawals", "closures"],
    icon: Clock,
    items: [
      { name: "Maturing Deposits", href: "/dashboard/reports/fixed-deposits/maturing", source: "maturity schedule and due dates" },
      { name: "Withdrawn Deposits", href: "/dashboard/reports/fixed-deposits/withdrawn", source: "closure, payout, and early withdrawal" },
    ],
  },
];

export default function FixedDepositReportsPage() {
  return (
    <ReportPageLayout
      title="Fixed Deposit Reports"
      description="Manage and track fixed deposit portfolios, maturities, and interest."
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
