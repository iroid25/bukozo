"use client";

import Link from "next/link";
import { BarChart, PieChart, ReceiptText } from "lucide-react";

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
  icon: typeof PieChart;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "Share Capital Listings",
    description: "Shareholder listings and balances",
    sources: ["share purchases", "current share balances", "member linkage"],
    icon: PieChart,
    items: [
      {
        name: "Share Account Balance Report",
        href: "/dashboard/reports/shares/share-account-balance",
        source: "share balances by member",
      },
      {
        name: "Shares Accounts Listing Report",
        href: "/dashboard/reports/shares/share-accounts-listing",
        source: "share account opening and status",
      },
      {
        name: "Shares Batch Totals Report",
        href: "/dashboard/reports/shares/share-batch-totals",
        source: "batch remittances and totals",
      },
      {
        name: "Top & Bottom Shareholders",
        href: "/dashboard/reports/shares/top-bottom-shareholders",
        source: "highest and lowest shareholders",
      },
    ],
  },
  {
    title: "Statements",
    description: "Member-level share statements and movements",
    sources: ["share movements", "share purchases", "share statements"],
    icon: ReceiptText,
    items: [
      {
        name: "Share Account Statement",
        href: "/dashboard/reports/shares/share-account-statement",
        source: "share movements and running balances",
      },
      {
        name: "Share Concentration Report",
        href: "/dashboard/reports/savings-shares-reports/shares",
        source: "shareholding concentration",
      },
    ],
  },
  {
    title: "Transfers",
    description: "Share transfer history and account status",
    sources: ["share transfers", "reversals", "zero balance", "on hold / closed"],
    icon: BarChart,
    items: [
      {
        name: "Shares Transactions Report",
        href: "/dashboard/reports/shares/share-transactions",
        source: "share purchases, transfers, and reversals",
      },
      {
        name: "Shares Zero Balance Report",
        href: "/dashboard/reports/shares/share-zero-balance",
        source: "zero-balance share accounts",
      },
      {
        name: "Accounts On Hold / Closed",
        href: "/dashboard/reports/shares/on-hold-closed",
        source: "on hold, suspended, or closed share accounts",
      },
    ],
  },
];

export default function SharesReportsMenu() {
  return (
    <ReportPageLayout
      title="Share Reporting"
      description="Manage share capital and shareholder registers."
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
