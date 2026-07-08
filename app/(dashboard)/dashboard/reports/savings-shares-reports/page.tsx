"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Download,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  BarChart3,
  PieChart,
  Database,
  Loader2,
  Eye,
  FileDown,
  AlertCircle,
  Shield,
  UserCheck,
  Activity,
  Settings,
  Share2,
} from "lucide-react";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type ReportCategoryKey =
  | "savings"
  | "shares"
  | "loans"
  | "financial"
  | "operations"
  | "members"
  | "audit"
  | "performance";

type ReportRecord = Record<string, unknown>;

type ReportSummary = {
  totalRecords: number;
  totalAmount: number;
  averageAmount?: number;
  [key: string]: unknown;
};

type GeneratedReportData = {
  records: ReportRecord[];
  summary: ReportSummary;
  requiresDates?: boolean;
  [key: string]: unknown;
};

type GeneratedReport = {
  reportType: string;
  reportId: string;
  category: ReportCategoryKey;
  period: { startDate: string; endDate: string };
  generatedAt: Date;
  data: GeneratedReportData;
};

type ReportCategoryItem = {
  id: string;
  name: string;
  description: string;
  requiresDates?: boolean;
  href?: string;
};

type ReportCategory = {
  name: string;
  icon: React.ElementType;
  color: string;
  reports: ReportCategoryItem[];
};

type ReportCategories = Record<ReportCategoryKey, ReportCategory>;

export default function BUTSACCOReportsPage() {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const lastLiveRefreshVersionRef = useRef(liveRefreshVersion);
  const [activeCategory, setActiveCategory] = useState<ReportCategoryKey>("savings");
  const [reportType, setReportType] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportCategories: ReportCategories = {
    savings: {
      name: "Savings Reports",
      icon: DollarSign,
      color: "emerald",
      reports: [
        {
          id: "savings-listing",
          name: "Account Listing",
          description: "Complete list of all savings accounts with status and balance.",
          requiresDates: false,
          href: "/dashboard/reports/savings/savings-listing",
        },
        {
          id: "savings-balance",
          name: "Account Balances",
          description: "Detailed balance report grouped by account type and branch.",
          requiresDates: false,
          href: "/dashboard/reports/savings/savings-balances",
        },
        {
          id: "savings-transactions",
          name: "Transaction History",
          description: "Full transaction logs with filtering by date and type.",
          href: "/dashboard/reports/savings-shares-reports/savings",
        },
        {
          id: "savings-dormant",
          name: "Dormant Accounts",
          description: "Identify inactive accounts based on dormancy threshold.",
          requiresDates: false,
          href: "/dashboard/reports/savings/dormant-accounts",
        },
        {
          id: "savings-zero-balance",
          name: "Zero Balance Accounts",
          description: "Accounts with zero balance or below minimum threshold.",
          requiresDates: false,
          href: "/dashboard/reports/savings/zero-balance",
        },
        {
          id: "savings-overdrawn",
          name: "Overdrawn Accounts",
          description: "Accounts with negative balances needing attention.",
          requiresDates: false,
          href: "/dashboard/reports/savings/overdrawn",
        },
        {
          id: "savings-interest",
          name: "Interest Paid",
          description: "Summary of interest payments distributed to accounts.",
          href: "/dashboard/reports/savings/interest-paid",
        },
        {
          id: "savings-top-bottom",
          name: "Top/Bottom Savers",
          description: "Ranking of accounts by balance magnitude.",
          requiresDates: false,
          href: "/dashboard/reports/member-ledger/top-bottom-savers",
        },
        {
          id: "savings-batch",
          name: "Batch Totals",
          description: "Summary of transaction batches processed.",
          href: "/dashboard/reports/savings/savings-batch-totals",
        },
      ],
    },
    shares: {
      name: "Shares Reports",
      icon: Share2,
      color: "blue",
      reports: [
        {
          id: "shares-statement",
          name: "Shares Account Statement",
          description: "Detailed statement of shares account",
          requiresDates: false,
          href: "/dashboard/reports/shares/share-account-statement",
        },
        {
          id: "shares-balance",
          name: "Share Capital Report",
          description: "Total capital analysis and breakdown.",
          requiresDates: false,
          href: "/dashboard/reports/shares/share-account-balance",
        },
        {
          id: "shares-concentration",
          name: "Shares Concentration Report",
          description: "Distribution of shares across members",
          requiresDates: false,
          href: "/dashboard/reports/savings-shares-reports/shares",
        },
        {
          id: "shares-listing",
          name: "Share Account Listing",
          description: "Registry of all shareholders and their holdings.",
          requiresDates: false,
          href: "/dashboard/reports/shares/share-accounts-listing",
        },
          {
          id: "shares-share-capital-remittances",
          name: "Share Capital Remittances",
          description: "Member names, remitted amounts, and dates for share capital purchases and loan deductions.",
          requiresDates: true,
          href: "/dashboard/reports/savings-shares-reports/share-capital-remittances",
        },
          {
            id: "shares-batch-totals",
            name: "Share Batch Totals Report",
            description: "Total shares by batch/period",
            requiresDates: false,
            href: "/dashboard/reports/shares/share-batch-totals",
          },
        {
          id: "shares-on-hold",
          name: "Accounts on Hold/Closed Status",
          description: "Share accounts that are on hold or closed",
          requiresDates: false,
        },
        {
          id: "shares-zero-balance",
          name: "Share Zero Balance Report",
          description: "Share accounts with zero balance",
          requiresDates: false,
          href: "/dashboard/reports/shares/share-zero-balance",
        },
        {
          id: "shares-top-holders",
          name: "Top Shareholders",
          description: "List of members with highest shareholding.",
          requiresDates: false,
          href: "/dashboard/reports/savings-shares-reports/shares",
        },
        {
          id: "shares-transactions",
          name: "Share Transactions",
          description: "History of share purchases and transfers.",
          href: "/dashboard/reports/shares/share-transactions",
        },
      ],
    },
    loans: {
      name: "Loan Reports",
      icon: TrendingUp,
      color: "purple",
      reports: [
        {
          id: "loan-disbursements",
          name: "Loan Disbursements Report",
          description: "Loans disbursed within the period",
        },
        {
          id: "loan-repayments",
          name: "Loan Repayments Report",
          description: "Loan repayments made within the period",
        },
        {
          id: "loan-outstanding",
          name: "Outstanding Loans Report",
          description: "All loans with outstanding balances",
          requiresDates: false,
        },
      ],
    },
    financial: {
      name: "Financial Reports",
      icon: BarChart3,
      color: "orange",
      reports: [
        {
          id: "income-report",
          name: "Income Report",
          description: "All income received within the period",
        },
        {
          id: "expenditure-report",
          name: "Expenditure Report",
          description: "All expenditure made within the period",
        },
        {
          id: "income-vs-expenditure",
          name: "Income vs Expenditure",
          description: "Comparison of income and expenditure",
        },
      ],
    },
    operations: {
      name: "Operations Reports",
      icon: Database,
      color: "indigo",
      reports: [
        {
          id: "float-transactions",
          name: "Float Transactions Report",
          description: "All float transactions within the period",
        },
        {
          id: "vault-transactions",
          name: "Vault Transactions Report",
          description: "All vault transactions within the period",
        },
        {
          id: "branch-performance",
          name: "Branch Performance Report",
          description: "Performance metrics by branch",
        },
      ],
    },
    members: {
      name: "Members Reports",
      icon: Users,
      color: "pink",
      reports: [
        {
          id: "customer-accounts-listing",
          name: "Customer Internal Accounts Listing",
          description: "Complete list of all customer accounts",
          requiresDates: false,
        },
        {
          id: "customer-contacts",
          name: "Customer Contacts Report",
          description: "Contact information for all customers",
          requiresDates: false,
        },
        {
          id: "blacklisted-clients",
          name: "Blacklisted Clients Report",
          description: "List of blacklisted or suspended members",
          requiresDates: false,
        },
        {
          id: "transferred-clients",
          name: "Transferred Clients Report",
          description: "Members transferred between branches",
        },
      ],
    },
    audit: {
      name: "Audit & Compliance",
      icon: Shield,
      color: "red",
      reports: [
        {
          id: "audit-trail",
          name: "Audit Trail Report",
          description: "Complete audit log of system activities",
        },
        {
          id: "error-corrected-transactions",
          name: "Error Corrected Transactions",
          description: "Transactions that were corrected or reversed",
        },
        {
          id: "transaction-authorization",
          name: "Transaction Authorization Report",
          description: "All transactions requiring authorization",
        },
        {
          id: "eod-supervision",
          name: "End of Day Transactions Supervision",
          description: "EOD transaction review and supervision",
        },
        {
          id: "system-users",
          name: "System Users Report",
          description: "All system users and their activities",
          requiresDates: false,
        },
      ],
    },
    performance: {
      name: "Performance & Analytics",
      icon: Activity,
      color: "cyan",
      reports: [
        {
          id: "performance-monitoring",
          name: "Performance Monitoring Tool",
          description: "Comprehensive performance metrics",
        },
        {
          id: "performance-indicators",
          name: "Performance Indicator Report",
          description: "Key performance indicators (KPIs)",
        },
      ],
    },
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const report = Object.values(reportCategories)
        .flatMap((cat) => cat.reports)
        .find((r) => r.id === reportType);

      if (!report) {
        throw new Error("Report not found");
      }

      const response = await fetch("/api/v1/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          reportId: reportType,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      const data = (await response.json()) as GeneratedReportData;

      setReportData({
        reportType: report.name,
        reportId: reportType,
        category: activeCategory,
        period: { startDate, endDate },
        generatedAt: new Date(),
        data: data,
      });
    } catch (err: unknown) {
      console.error("Report generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reportData) return;
    if (lastLiveRefreshVersionRef.current === liveRefreshVersion) return;
    lastLiveRefreshVersionRef.current = liveRefreshVersion;
    void handleGenerateReport();
  }, [handleGenerateReport, liveRefreshVersion, reportData]);

  const handleExportPDF = () => {
    if (!reportData) return;

    const tableHeaders =
      reportData.data.records.length > 0
        ? Object.keys(reportData.data.records[0])
        : [];

    const tableRows = reportData.data.records
      .map((record: ReportRecord) => {
        return `
          <tr>
            ${Object.entries(record)
              .map(([key, value]) => {
                let displayValue = value;
                if (
                  typeof value === "number" &&
                  (key.toLowerCase().includes("amount") ||
                    key.toLowerCase().includes("balance") ||
                    key.toLowerCase().includes("principal") ||
                    key.toLowerCase().includes("interest") ||
                    key.toLowerCase().includes("due") ||
                    key.toLowerCase().includes("granted") ||
                    key.toLowerCase().includes("paid") ||
                    key.toLowerCase().includes("shares") ||
                    key.toLowerCase().includes("value"))
                ) {
                  displayValue = `UGX ${value.toLocaleString()}`;
                } else if (value === null || value === undefined) {
                  displayValue = "N/A";
                }
                return `<td style="padding: 8px; border-bottom: 1px solid #ddd;">${displayValue}</td>`;
              })
              .join("")}
          </tr>
        `;
      })
      .join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BUTSACCO Report - ${reportData.reportType}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #16A34A; padding-bottom: 20px; }
          .header h1 { color: #16A34A; margin: 5px 0; font-size: 20px; }
          .header p { margin: 3px 0; font-size: 11px; color: #666; }
          .report-title { text-align: center; margin: 20px 0; font-size: 16px; font-weight: bold; color: #16A34A; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; }
          .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
          .summary-card .label { font-size: 12px; color: #666; }
          .summary-card .value { font-size: 20px; font-weight: bold; color: #16A34A; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
          th { background-color: #16A34A; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; text-align: center; color: #666; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BUKONZO UNITED TEACHERS SAVINGS AND CREDIT COOPERATIVE LTD</h1>
          <p>Plot 2 Main Street, Kisinga Bwera Road, Kisinga, Uganda</p>
          <p>Tel: +256 789 529810 / +256 779 021565 | Email: bukonzounitedteacherssacco@gmail.com</p>
          <p>P.O. Box 142 Kasese, Uganda</p>
        </div>
        
        <div class="report-title">${reportData.reportType}</div>
        ${
          reportData.data.requiresDates !== false
            ? `<p style="text-align: center; font-size: 11px; color: #666;">
          Period: ${reportData.period.startDate} to ${reportData.period.endDate}
        </p>`
            : ""
        }
        
        <div class="summary">
          <div class="summary-card">
            <div class="label">Total Records</div>
            <div class="value">${reportData.data.summary.totalRecords.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Amount</div>
            <div class="value">UGX ${reportData.data.summary.totalAmount.toLocaleString()}</div>
          </div>
          ${
            reportData.data.summary.averageAmount
              ? `
          <div class="summary-card">
            <div class="label">Average Amount</div>
            <div class="value">UGX ${Math.round(reportData.data.summary.averageAmount).toLocaleString()}</div>
          </div>
          `
              : ""
          }
        </div>
        
        <table>
          <thead>
            <tr>
              ${tableHeaders
                .map(
                  (header) => `
                <th>${header
                  .replace(/([A-Z])/g, " $1")
                  .trim()
                  .toUpperCase()}</th>
              `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Generated on: ${new Date(reportData.generatedAt).toLocaleString()}</p>
          <p>BUTSACCO - Empowering communities through financial inclusion since 2009</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

    const currentCategory = reportCategories[activeCategory];
  const CategoryIcon = currentCategory.icon;

  const selectedReport = currentCategory.reports.find(
    (r) => r.id === reportType
  );
  const selectedReportHref = selectedReport?.href;
  const requiresDates = selectedReport?.requiresDates !== false;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* BUTSACCO Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    BUTSACCO Reports System
                  </h1>
                  <p className="text-sm text-gray-600">
                    Bukonzo United Teachers Savings and Credit Cooperative Ltd
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-emerald-600">
                {Object.values(reportCategories).reduce(
                  (acc, cat) => acc + cat.reports.length,
                  0
                )}
              </div>
              <div className="text-sm text-gray-600">Available Reports</div>
            </div>
          </div>
        </div>

        {/* Category Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(reportCategories) as [ReportCategoryKey, ReportCategory][]).map(([key, category]) => {
            const Icon = category.icon;
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveCategory(key);
                  setReportType("");
                  setReportData(null);
                  setError(null);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-emerald-200"
                }`}
              >
                <Icon
                  className={`h-8 w-8 mb-2 ${isActive ? "text-emerald-600" : "text-gray-400"}`}
                />
                <div
                  className={`font-semibold text-sm ${isActive ? "text-emerald-900" : "text-gray-700"}`}
                >
                  {category.name}
                </div>
                <div
                  className={`text-2xl font-bold mt-1 ${isActive ? "text-emerald-600" : "text-gray-900"}`}
                >
                  {category.reports.length}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <CategoryIcon className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-gray-900">
                  {currentCategory.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentCategory.reports.length} reports available
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Report
                </label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                    setReportData(null);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Choose a report...</option>
                  {currentCategory.reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.name}
                    </option>
                  ))}
                </select>
                {reportType && (
                  <p className="text-xs text-gray-500 mt-1">
                    {
                      currentCategory.reports.find((r) => r.id === reportType)
                        ?.description
                    }
                  </p>
                )}
              </div>

              {reportType && !selectedReportHref && requiresDates && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {reportType &&
                (selectedReportHref ? (
                  <a
                    href={selectedReportHref}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="h-5 w-5" />
                    Open Report
                  </a>
                ) : (
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Eye className="h-5 w-5" />
                        Generate Report
                      </>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Report Preview */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Report Preview
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {reportData
                      ? reportData.reportType
                      : "Select and generate a report to preview"}
                  </p>
                </div>
                {reportData && (
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 max-h-[600px] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Error generating report
                    </p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {reportData ? (
                <div className="space-y-6">
                  {/* Report Header */}
                  <div className="text-center pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      BUKONZO UNITED TEACHERS SACCO LTD
                    </h2>
                    <p className="text-sm text-gray-600">
                      Plot 2 Main Street, Kisinga Bwera Road, Kisinga, Uganda
                    </p>
                    <p className="text-sm text-gray-600">
                      Tel: +256 789 529810 | Email:
                      bukonzounitedteacherssacco@gmail.com
                    </p>
                    <h3 className="text-lg font-semibold text-emerald-600 mt-3">
                      {reportData.reportType}
                    </h3>
                    {requiresDates && (
                      <p className="text-sm text-gray-600">
                        Period: {reportData.period.startDate} to{" "}
                        {reportData.period.endDate}
                      </p>
                    )}
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                      <div className="text-sm text-emerald-700 font-medium">
                        Total Records
                      </div>
                      <div className="text-2xl font-bold text-emerald-900 mt-1">
                        {reportData.data.summary.totalRecords.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-blue-700 font-medium">
                        Total Amount
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">
                        UGX{" "}
                        {reportData.data.summary.totalAmount.toLocaleString()}
                      </div>
                    </div>
                    {reportData.data.summary.averageAmount !== undefined && (
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 col-span-2">
                        <div className="text-sm text-purple-700 font-medium">
                          Average Amount
                        </div>
                        <div className="text-2xl font-bold text-purple-900 mt-1">
                          UGX{" "}
                          {Math.round(
                            reportData.data.summary.averageAmount
                          ).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Data Table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-emerald-600">
                          <tr>
                            {reportData.data.records.length > 0 &&
                              Object.keys(reportData.data.records[0]).map(
                                (key) => (
                                  <th
                                    key={key}
                                    className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap"
                                  >
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </th>
                                )
                              )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {reportData.data.records.map((record, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              {Object.entries(record).map(
                                ([key, value], idx) => (
                                  <td
                                    key={idx}
                                    className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap"
                                  >
                                    {typeof value === "number" &&
                                    (key.toLowerCase().includes("amount") ||
                                      key.toLowerCase().includes("balance") ||
                                      key.toLowerCase().includes("principal") ||
                                      key.toLowerCase().includes("interest") ||
                                      key.toLowerCase().includes("due") ||
                                      key.toLowerCase().includes("granted") ||
                                      key.toLowerCase().includes("paid") ||
                                      key.toLowerCase().includes("outstanding") ||
                                      key.toLowerCase().includes("shares") ||
                                      key.toLowerCase().includes("value"))
                                      ? `UGX ${value.toLocaleString()}`
                                      : value === null || value === undefined
                                        ? "N/A"
                                        : String(value)}
                                  </td>
                                )
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {reportData.data.records.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No records found for the selected period
                    </div>
                  )}

                  {/* Report Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
                    <div>
                      Generated:{" "}
                      {new Date(reportData.generatedAt).toLocaleString()}
                    </div>
                    <div>BUTSACCO Reports System</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-gray-100 rounded-full p-6 mb-4">
                    <FileText className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Report Generated
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md">
                    Select a report type from the dropdown, configure the date
                    range if applicable, and click "Generate Report" to view the
                    data.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
