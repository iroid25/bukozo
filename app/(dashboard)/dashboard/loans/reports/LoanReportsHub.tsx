"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  PieChart,
  BarChart3,
  Activity,
  Clock,
  Shield,
  Briefcase,
  FileCheck,
  UserCheck,
  ChevronRight,
  Search,
  BookOpen,
  Target,
  History,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ReportItem {
  id: string;
  name: string;
  description: string;
  path: string;
  badge?: string;
  requiredRole?: string[];
  icon?: any;
}

interface ReportCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  reports: ReportItem[];
}

export default function LoanReportsHub({
  userRole,
  userName,
}: {
  userRole: string;
  userName: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const reportCategories: ReportCategory[] = useMemo(() => [
    {
      id: "financial",
      name: "Financial Operations",
      description: "Disbursements, cash flows, and balance sheets",
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      reports: [
        {
          id: "disbursement",
          name: "Disbursement Ledger",
          description: "Full track of all loan disbursements with product & branch breakdown",
          path: "/dashboard/loans/reports/disbursement",
          badge: "Popular",
          icon: Briefcase,
        },
        {
          id: "repayment",
          name: "Repayment History",
          description: "Analyze daily/monthly repayments by channel and officer",
          path: "/dashboard/loans/reports/repayment",
          badge: "Popular",
          icon: History,
        },
        {
          id: "outstanding",
          name: "Outstanding Portfolio",
          description: "Live view of all outstanding balances and interest accruals",
          path: "/dashboard/loans/reports/outstanding",
          icon: Activity,
        },
        {
          id: "dues-vs-repayment",
          name: "Recovery Performance",
          description: "Comparison of expected dues vs actual collected amounts",
          path: "/dashboard/loans/reports/dues-vs-repayment",
          icon: Target,
        },
        {
          id: "penalty-collection",
          name: "Penalty Collections",
          description: "Track all penalty charges and collections as loan income",
          path: "/dashboard/loans/reports/penalty-collection",
          icon: AlertTriangle,
        },
      ],
    },
    {
      id: "risk",
      name: "Risk & Portfolio Health",
      description: "Portfolio analysis and delinquency tracking",
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-50",
      reports: [
        {
          id: "portfolio-at-risk",
          name: "PAR Analysis",
          description: "Strategic breakdown of PAR 30/60/90 days for risk profiling",
          path: "/dashboard/loans/reports/portfolio-at-risk",
          badge: "Critical",
          icon: AlertTriangle,
        },
        {
          id: "arrears",
          name: "Delinquency Report",
          description: "All loans in arrears with precise days past due and impact",
          path: "/dashboard/loans/reports/arrears",
          badge: "Action Required",
          icon: Clock,
        },
        {
          id: "arrears-by-age",
          name: "Aging Analysis",
          description: "Categorisation of arrears by aging buckets and severity",
          path: "/dashboard/loans/reports/arrears-by-age",
          icon: BarChart3,
        },
        {
          id: "daily-demand",
          name: "Daily Collection Sheet",
          description: "Targeted list of collections due for the current day",
          path: "/dashboard/loans/reports/daily-demand",
          badge: "Daily",
          icon: ClipboardList,
        },
      ],
    },
    {
      id: "performance",
      name: "Performance Analytics",
      description: "Strategic metrics and officer performance",
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      reports: [
        {
          id: "loan-officer-analysis",
          name: "Officer Audit",
          description: "Performance metrics and recovery rates for individual officers",
          path: "/dashboard/loans/reports/loan-officer-analysis",
          requiredRole: ["ADMIN", "BRANCHMANAGER"],
          icon: UserCheck,
        },
        {
          id: "portfolio-concentration",
          name: "Market Concentration",
          description: "Distribution of risk by product, branch, and demographics",
          path: "/dashboard/loans/reports/portfolio-concentration",
          icon: PieChart,
        },
      ],
    },
    {
      id: "member",
      name: "Member & Application",
      description: "Borrower profiles and application lifecycle",
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      reports: [
        {
          id: "borrowers-details",
          name: "Borrower Census",
          description: "Comprehensive borrower information and historical performance",
          path: "/dashboard/loans/reports/borrowers-details",
          icon: Users,
        },
        {
          id: "applications",
          name: "Lifecycle Tracking",
          description: "Application throughput: from submission to disbursement/rejection",
          path: "/dashboard/loans/reports/applications",
          icon: FileCheck,
        },
        {
          id: "active-by-officer",
          name: "Officer Assignment",
          description: "Current member loan distribution among active staff",
          path: "/dashboard/loans/reports/active-by-officer",
          icon: UserCheck,
        },
      ],
    },
    {
      id: "specialized",
      name: "Specialized Ledger",
      description: "Write-offs, reschedules and closed cases",
      icon: BookOpen,
      color: "text-neutral-600",
      bgColor: "bg-neutral-50",
      reports: [
        {
          id: "ledger",
          name: "Ledger Transactions",
          description: "Full transaction history for specific loan accounts with total summations",
          path: "/dashboard/loans/reports/ledger",
          icon: FileText,
        },
        {
          id: "rescheduled",
          name: "Reschedule Registry",
          description: "Tracking of all loan agreement adjustments and reschedules",
          path: "/dashboard/loans/reports/rescheduled",
          icon: Activity,
        },
        {
          id: "written-off",
          name: "Write-Off Disposal",
          description: "Formal record of loans disposed through writing off",
          path: "/dashboard/loans/reports/written-off",
          requiredRole: ["ADMIN", "ACCOUNTANT"],
          icon: AlertTriangle,
        },
        {
          id: "paid-off",
          name: "Closure Report",
          description: "Registry of all successfully completed and closed loan accounts",
          path: "/dashboard/loans/reports/paid-off",
          icon: CheckCircle,
        },
      ],
    },
  ], []);

  // Filter reports based on search query and user role
  const filteredCategories = reportCategories
    .map((category) => ({
      ...category,
      reports: category.reports.filter((report) => {
        const matchesSearch =
          report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.description.toLowerCase().includes(searchQuery.toLowerCase());

        const hasAccess =
          !report.requiredRole || report.requiredRole.includes(userRole);

        return matchesSearch && hasAccess;
      }),
    }))
    .filter((category) => category.reports.length > 0);

  return (
    <div className="space-y-10 pb-20">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Loan Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Strategic visibility into portfolio health, recovery performance, and operational efficiency.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="hidden lg:flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Session Data</span>
              <span className="text-sm font-bold text-indigo-900 leading-none capitalize">{userName}</span>
           </div>
           <div className="h-10 w-10 rounded-2xl bg-indigo-900 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Shield className="h-5 w-5" />
           </div>
        </div>
      </div>

      {/* Modern Search Section */}
      <div className="relative max-w-2xl group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none group-focus-within:text-indigo-600 transition-colors">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <Input
          type="text"
          placeholder="Filter analytical reports by name or description..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-12 py-7 rounded-2xl border-neutral-200 shadow-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 text-lg transition-all font-medium placeholder:text-muted-foreground/60"
        />
        {searchQuery && (
           <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-widest bg-neutral-100 px-2 py-1 rounded-md"
           >
              Clear
           </button>
        )}
      </div>

      {/* Reports Grid */}
      <div className="space-y-16">
        {filteredCategories.map((category) => (
          <div key={category.id} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-indigo-600 pl-6">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                  <category.icon className={`h-5 w-5 ${category.color}`} />
                  {category.name}
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {category.description}
                </p>
              </div>
              <div className="w-fit bg-neutral-100 text-neutral-600 font-bold px-3 py-1 text-[11px] h-fit rounded-md border">
                {category.reports.length} Modules
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.reports.map((report) => (
                <Card
                  key={report.id}
                  className="group cursor-pointer transition-all duration-300 hover:border-indigo-400 border-neutral-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 rounded-2xl overflow-hidden active:scale-[0.98]"
                  onClick={() => router.push(report.path)}
                >
                  <CardHeader className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-2xl ${category.bgColor} ${category.color} group-hover:bg-indigo-900 group-hover:text-white transition-colors duration-500 shadow-sm`}>
                        {report.icon ? <report.icon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      {report.badge && (
                        <div
                          className={`
                            text-[9px] font-bold uppercase tracking-tighter px-2 py-0 h-5 inline-flex items-center rounded-md border
                            ${report.badge === "Critical" || report.badge === "Action Required"
                                ? "bg-red-500 text-white border-transparent"
                                : "bg-indigo-50 text-indigo-700 border-indigo-100"}
                          `}
                        >
                          {report.badge}
                        </div>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-neutral-800 leading-tight group-hover:text-indigo-600 transition-colors">
                        {report.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {report.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <div className="p-4 bg-neutral-50/50 border-t group-hover:bg-indigo-50/50 transition-colors duration-500 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-muted-foreground group-hover:text-indigo-600 transition-colors tracking-widest flex items-center gap-1.5 uppercase">
                       View Analytics <ArrowRight className="h-3 w-3" />
                     </span>
                     <div className="h-6 w-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-300 transition-all shadow-sm">
                        <ChevronRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-indigo-600" />
                     </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* No Results Fallback */}
      {filteredCategories.length === 0 && (
        <Card className="p-20 bg-neutral-50/50 border-dashed border-2 border-neutral-200 rounded-3xl">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="p-6 bg-white rounded-full shadow-inner mb-6">
              <Search className="h-16 w-16 text-muted-foreground/20" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-800 tracking-tight">Analytical Index Empty</h3>
            <p className="mt-2 text-muted-foreground font-medium italic">
              No reports match your current query "{searchQuery}". <br/>Try using broader terms like "Risk", "Portfolio", or "Officer".
            </p>
            <button 
              onClick={() => setSearchQuery("")}
              className="mt-8 text-indigo-600 font-bold text-xs uppercase tracking-[0.2em] hover:underline underline-offset-4"
            >
              Reset Analytical Filter
            </button>
          </div>
        </Card>
      )}

      {/* Footer System Info */}
      <div className="pt-10 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold text-muted-foreground tracking-[0.3em] uppercase">
         <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> SECURE AUDIT ENABLED</span>
            <span className="flex items-center gap-1.5"><Activity className="h-3 w-3" /> REAL-TIME AGGREGATION</span>
         </div>
         <div className="opacity-40 italic">Bukonzo Emergency Sacco v4.2</div>
      </div>
    </div>
  );
}
