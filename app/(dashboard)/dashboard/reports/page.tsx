"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Home,
  LayoutGrid,
  Search,
  Shield,
  Sparkles,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { reportCatalog } from "@/config/report-catalog";
import LiabilityReportsList from "@/components/reports/LiabilityReportsList";

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>([
    reportCatalog[0].id,
  ]);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "audit">(
    "overview",
  );

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return reportCatalog
      .map((category) => {
        const reports = category.reports.filter((report) => {
          if (!query) return true;

          return (
            category.title.toLowerCase().includes(query) ||
            category.description.toLowerCase().includes(query) ||
            report.title.toLowerCase().includes(query) ||
            report.description.toLowerCase().includes(query)
          );
        });

        return {
          ...category,
          reports,
        };
      })
      .filter((category) => category.reports.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setOpenCategories(filteredCategories.map((category) => category.id));
      return;
    }

    setOpenCategories([reportCatalog[0].id]);
  }, [filteredCategories, searchQuery]);

  const totalReports = reportCatalog.reduce(
    (sum, category) => sum + category.reports.length,
    0,
  );
  const visibleReports = filteredCategories.reduce(
    (sum, category) => sum + category.reports.length,
    0,
  );

  const toggleCategory = (id: string) => {
    setOpenCategories((current) =>
      current.includes(id)
        ? current.filter((categoryId) => categoryId !== id)
        : [...current, id],
    );
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_36%),linear-gradient(to_bottom,_#f8fafc,_#ffffff_45%,_#f7f9fb)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-5 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Home
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-slate-700">Reports</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Reports Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                  A searchable catalog of the SACCO reports, grouped by business
                  function and linked to the API-backed pages and hubs that already exist.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Reports
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {totalReports}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Categories
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {reportCatalog.length}
                </div>
              </div>
              <Button className="h-auto rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-800">
                <Download className="mr-2 h-4 w-4" />
                Export All
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search reports, descriptions, or categories..."
                className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 pr-12 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: "overview", label: "Overview" },
                { id: "trends", label: "Trends" },
                { id: "audit", label: "Audit Logs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    activeTab === tab.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Coverage
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {visibleReports}/{totalReports}
              </div>
              <p className="mt-1 text-sm text-slate-600">Visible reports.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Open Groups
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {openCategories.length}
              </div>
              <p className="mt-1 text-sm text-slate-600">Expanded sections.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Search Mode
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                {searchQuery.trim() ? "Filtered" : "Browse"}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Auto-expands matches.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Status
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                Ready
              </div>
              <p className="mt-1 text-sm text-slate-600">
                API-backed pages and hubs linked.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-8">
          {filteredCategories.map((category) => {
            const CategoryIcon = category.icon;
            const isOpen = openCategories.includes(category.id);

            return (
              <section
                key={category.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 md:px-6",
                    isOpen && "border-b border-slate-200/80",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200",
                        category.iconTone,
                      )}
                    >
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-900 md:text-base">
                        {category.title}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 md:text-sm">
                        {category.reports.length} reports available
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        Sources: {category.sources.join(" · ")}
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-4 md:px-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {category.reports.map((report) => (
                        <Link
                          key={report.slug}
                          href={report.href}
                          className={cn(
                            "group rounded-xl border bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md",
                            category.reportTone,
                            category.accent,
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-700">
                                  {report.title}
                                </h3>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
                                    report.status === "ready"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500",
                                  )}
                                >
                                  {report.status}
                                </span>
                              </div>
                              <p className="text-xs leading-5 text-slate-600">
                                {report.description}
                              </p>
                            </div>
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-900">
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {filteredCategories.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">
                No reports matched your search
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
                Try broader words like "balance", "statement", or "journal".
              </p>
              <Button
                variant="secondary"
                onClick={() => setSearchQuery("")}
                className="mt-6 rounded-full"
              >
                Reset search
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200/80 py-4 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-slate-600">
              <Shield className="h-3.5 w-3.5" />
              Secure &amp; Licensed
            </span>
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-slate-600">
              <Home className="h-3.5 w-3.5" />
              Member Protection
            </span>
          </div>
          <div className="opacity-60">Bukonzo Emergency Sacco Reports</div>
        </div>
      </div>
    </div>
  );
}
