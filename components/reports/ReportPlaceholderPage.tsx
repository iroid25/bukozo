"use client";

import Link from "next/link";
import { ArrowRight, FileQuestion, Home, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportPlaceholderPageProps {
  title: string;
  description: string;
  statusLabel?: string;
  routePath?: string;
  backHref?: string;
}

export function ReportPlaceholderPage({
  title,
  description,
  statusLabel = "Coming Soon",
  routePath,
  backHref = "/dashboard/reports",
}: ReportPlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:text-slate-900">
            <Home className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <ArrowRight className="h-3.5 w-3.5" />
          <Link href={backHref} className="hover:text-slate-900">
            Reports
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-3 border-b border-slate-200/70 bg-white">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {statusLabel}
                </div>
                <CardTitle className="text-2xl">{title}</CardTitle>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <FileQuestion className="h-6 w-6" />
              </div>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">{description}</p>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Status
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">{statusLabel}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Route
                </div>
                <div className="mt-2 break-all text-sm font-medium text-slate-900">
                  {routePath || "Not assigned yet"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Type
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">Report</div>
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <FileQuestion className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    This report is registered, but the dedicated screen is still being built.
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    We keep the route alive so the catalog has a safe destination, and the
                    full reporting screen can be added without breaking links.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link href={backHref}>
                    Back to Reports
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="secondary" asChild className="rounded-full">
                  <Link href="/dashboard">Dashboard Home</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
