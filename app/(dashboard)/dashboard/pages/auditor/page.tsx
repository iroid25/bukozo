"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpDown,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const cards = [
  { title: "System Integrity", value: "98.7%", icon: AlertCircle, change: "Overall system health" },
  { title: "Audit Logs", value: "2,847", icon: Clock, change: "Activities logged today" },
  { title: "Risk Score", value: "Low", icon: TrendingUp, change: "Current risk assessment", color: "text-green-600" },
  { title: "Compliance", value: "100%", icon: Users, change: "Regulatory compliance" },
];

export default function AuditorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (role !== "AUDITOR") { router.push("/dashboard"); return; }
  }, [session, status, router]);

  if (status === "loading") return null;

  return (
    <main className="p-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Auditor Dashboard</h1>
        <p className="text-gray-600">Monitor system integrity, compliance, and audit trail management.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color || ""}`}>{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Audit Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/audit/logs">
                <Button className="w-full" variant="outline">
                  <Clock className="mr-2 h-4 w-4" />
                  Audit Logs
                </Button>
              </Link>
              <Link href="/dashboard/audit/transactions">
                <Button className="w-full" variant="outline">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Transaction Audit
                </Button>
              </Link>
              <Link href="/dashboard/audit/compliance">
                <Button className="w-full" variant="outline">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Compliance Check
                </Button>
              </Link>
              <Link href="/dashboard/audit/reports">
                <Button className="w-full" variant="outline">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Audit Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
