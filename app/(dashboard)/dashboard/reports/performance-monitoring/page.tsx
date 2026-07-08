"use client";

import Link from "next/link";
import { Activity, BarChart3, Shield } from "lucide-react";

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
  icon: typeof Activity;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "KPIs",
    description: "Branch-level performance monitoring",
    sources: ["deposits", "withdrawals", "transactions", "branch throughput"],
    icon: Activity,
    items: [
      {
        name: "Performance Monitoring Report",
        href: "/dashboard/reports/performance-monitoring",
        source: "operational KPI monitoring",
      },
    ],
  },
  {
    title: "Exposure & Health",
    description: "Portfolio exposure and operational health",
    sources: ["loan exposure", "interest exposure", "portfolio health"],
    icon: Shield,
    items: [
      {
        name: "Interest Exposure Report",
        href: "/dashboard/reports/interest-exposure",
        source: "interest-risk and exposure monitoring",
      },
    ],
  },
  {
    title: "Ledger Performance",
    description: "General ledger throughput and health",
    sources: ["journal throughput", "ledger balances", "account health"],
    icon: BarChart3,
    items: [
      {
        name: "GL Performance",
        href: "/dashboard/reports/gl-performance",
        source: "general ledger performance",
      },
    ],
  },
];

export default function PerformanceMonitoringPage() {
  return (
    <ReportPageLayout
      title="Performance Monitoring"
      description="Operational KPI, exposure, and ledger-health reporting."
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
                  <Button key={item.href} variant="ghost" className="h-auto justify-start px-3 py-2 font-normal" asChild>
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
