"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Calculator, Trash2 } from "lucide-react";
import Link from "next/link";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";

const reportGroups = [
  {
    title: "Asset Management",
    description: "Tracking of fixed assets",
    icon: Building,
    items: [
      { name: "Asset Register", href: "/dashboard/reports/fixed-assets/register" },
      { name: "Depreciation Schedule", href: "/dashboard/reports/fixed-assets/depreciation" },
      { name: "Disposal Report", href: "/dashboard/reports/fixed-assets/disposal" },
    ],
  },
];

export default function FixedAssetsReportsPage() {
  return (
    <ReportPageLayout
      title="Fixed Asset Reports"
      description="Manage equipment, furniture, and other fixed assets."
    >
      <div className="grid gap-6 md:grid-cols-2 p-1">
        {reportGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg">{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <group.icon className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="justify-start h-auto py-2 px-3 font-normal"
                    asChild
                  >
                    <Link href={item.href}>
                      <span className="flex-1">{item.name}</span>
                      <span className="text-muted-foreground">→</span>
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
