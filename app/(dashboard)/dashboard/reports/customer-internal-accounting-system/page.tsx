"use client";

import Link from "next/link";
import { Shield, FileText, BookOpen } from "lucide-react";

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
  icon: typeof Shield;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "Branch Review",
    description: "Customer internal accounting visibility",
    sources: ["branch-scoped accounts", "account activity", "control checks"],
    icon: Shield,
    items: [
      {
        name: "Customer Internal Accounting System",
        href: "/dashboard/reports/customer-internal-accounting-system",
        source: "branch accounting review",
      },
    ],
  },
  {
    title: "Customer Snapshots",
    description: "Audit-style review and export",
    sources: ["member context", "transactions", "branch filters"],
    icon: FileText,
    items: [
      {
        name: "Customer Information Audit Trail",
        href: "/dashboard/reports/audit-trail/customer-information",
        source: "before/after customer snapshots",
      },
    ],
  },
  {
    title: "Control Visibility",
    description: "Branch control and ledger review",
    sources: ["control checklist", "ledger review", "branch signoff"],
    icon: BookOpen,
    items: [
      {
        name: "SACCO Internal Control Checklist",
        href: "/dashboard/reports/sacco-internal-control-checklist",
        source: "branch control checklist",
      },
    ],
  },
];

export default function CustomerInternalAccountingSystemPage() {
  return (
    <ReportPageLayout
      title="Customer Internal Accounting System"
      description="Branch-scoped accounting review with export and control visibility."
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
