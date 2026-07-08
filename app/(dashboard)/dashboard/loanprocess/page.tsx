// @ts-nocheck
"use client";

import React, { useState } from "react";
import {
  FileText,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Download,
  AlertCircle,
  DollarSign,
  Building,
  BarChart3,
  Users,
  Eye,
  Edit,
  Filter,
  Search,
  Plus,
  TrendingUp,
} from "lucide-react";

// Demo data
const demoApplications = [
  {
    id: "APP001",
    member: {
      memberNumber: "M001",
      user: { name: "John Musoke" },
      accounts: [
        { id: "ACC1", accountType: { name: "Savings" }, balance: 2500000 },
      ],
    },
    loanProduct: {
      name: "Personal Loan",
      interestRate: 12,
      repaymentPeriodDays: 365,
    },
    amountApplied: 5000000,
    approvedAmount: 4500000,
    stage: "DISBURSED",
    status: "Active",
    applicationDate: "2025-08-15",
    loanOfficer: { name: "Alice Kimbugwe" },
    approver: { name: "Robert Kabwire" },
    approvalDate: "2025-09-01",
    allocatedTeller: { name: "Sarah Namukasa" },
    loan: { outstandingBalance: 3200000 },
    decisionNotes: "Strong credit profile, approved for full amount",
    appraisalScore: 85,
    debtToIncomeRatio: 28,
  },
  {
    id: "APP002",
    member: {
      memberNumber: "M002",
      user: { name: "Grace Nakimuli" },
      accounts: [
        { id: "ACC2", accountType: { name: "Current" }, balance: 1200000 },
      ],
    },
    loanProduct: {
      name: "Business Loan",
      interestRate: 15,
      repaymentPeriodDays: 730,
    },
    amountApplied: 10000000,
    stage: "FORWARDED_TO_MANAGER",
    status: "Pending",
    applicationDate: "2025-10-01",
    loanOfficer: { name: "James Ouma" },
    decisionNotes:
      "Business plan reviewed, cash flow positive, recommended for approval",
    appraisalScore: 78,
    debtToIncomeRatio: 35,
    forwardedAt: "2025-10-10",
  },
  {
    id: "APP003",
    member: {
      memberNumber: "M003",
      user: { name: "Denis Katende" },
      accounts: [
        { id: "ACC3", accountType: { name: "Savings" }, balance: 800000 },
      ],
    },
    loanProduct: {
      name: "Emergency Loan",
      interestRate: 10,
      repaymentPeriodDays: 180,
    },
    amountApplied: 2000000,
    stage: "IN_ANALYSIS",
    status: "Pending",
    applicationDate: "2025-10-05",
    loanOfficer: { name: "Alice Kimbugwe" },
  },
  {
    id: "APP004",
    member: {
      memberNumber: "M004",
      user: { name: "Fatima Hassan" },
      accounts: [
        { id: "ACC4", accountType: { name: "Savings" }, balance: 500000 },
      ],
    },
    loanProduct: {
      name: "Personal Loan",
      interestRate: 12,
      repaymentPeriodDays: 365,
    },
    amountApplied: 3000000,
    stage: "REJECTED",
    status: "Rejected",
    applicationDate: "2025-09-20",
    loanOfficer: { name: "James Ouma" },
    rejectionReason: "Debt-to-income ratio exceeds maximum threshold",
  },
  {
    id: "APP005",
    member: {
      memberNumber: "M005",
      user: { name: "Peter Mwale" },
      accounts: [],
    },
    loanProduct: {
      name: "Salary Loan",
      interestRate: 8,
      repaymentPeriodDays: 270,
    },
    amountApplied: 4500000,
    stage: "APPROVED",
    status: "Approved",
    applicationDate: "2025-10-08",
    loanOfficer: { name: "Alice Kimbugwe" },
    approver: { name: "Robert Kabwire" },
    approvalDate: "2025-10-14",
    allocatedTeller: { name: "Marcus Okonkwo" },
  },
];

export default function LoanManagementSystem() {
  const [activeView, setActiveView] = useState("member");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("all");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStageColor = (stage) => {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      IN_ANALYSIS: "bg-purple-100 text-purple-700",
      FORWARDED_TO_MANAGER: "bg-orange-100 text-orange-700",
      APPROVED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
      DISBURSED: "bg-emerald-100 text-emerald-700",
    };
    return colors[stage] || "bg-gray-100 text-gray-700";
  };

  const getStageIcon = (stage) => {
    const icons = {
      DRAFT: <FileText className="h-4 w-4" />,
      SUBMITTED: <Send className="h-4 w-4" />,
      IN_ANALYSIS: <Clock className="h-4 w-4" />,
      FORWARDED_TO_MANAGER: <User className="h-4 w-4" />,
      APPROVED: <CheckCircle className="h-4 w-4" />,
      REJECTED: <XCircle className="h-4 w-4" />,
      DISBURSED: <DollarSign className="h-4 w-4" />,
    };
    return icons[stage];
  };

  const getProgressPercentage = (stage) => {
    const stages = {
      DRAFT: 10,
      SUBMITTED: 25,
      IN_ANALYSIS: 50,
      FORWARDED_TO_MANAGER: 75,
      APPROVED: 90,
      DISBURSED: 100,
      REJECTED: 100,
    };
    return stages[stage] || 0;
  };

  // MEMBER VIEW
  const MemberView = () => {
    const currentMember = "M001";
    const memberApps = demoApplications.filter(
      (app) => app.member?.memberNumber === currentMember
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              My Loan Applications
            </h2>
            <p className="text-gray-600 mt-1">
              Track the status of your loan applications
            </p>
          </div>
        </div>

        {memberApps.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Loan Applications
            </h3>
            <p className="text-gray-600 mb-6">
              You haven't applied for any loans yet
            </p>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Apply for Loan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {memberApps.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {app.loanProduct?.name}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStageColor(app.stage)}`}
                        >
                          {getStageIcon(app.stage)}
                          {app.stage?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Applied on {formatDate(app.applicationDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(app.amountApplied)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Amount Requested
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Progress
                      </span>
                      <span className="text-sm text-gray-600">
                        {getProgressPercentage(app.stage)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          app.stage === "REJECTED"
                            ? "bg-red-600"
                            : app.stage === "DISBURSED"
                              ? "bg-green-600"
                              : "bg-blue-600"
                        }`}
                        style={{
                          width: `${getProgressPercentage(app.stage)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-lg mb-4 ${
                      app.stage === "REJECTED"
                        ? "bg-red-50 border border-red-200"
                        : app.stage === "APPROVED"
                          ? "bg-green-50 border border-green-200"
                          : app.stage === "DISBURSED"
                            ? "bg-emerald-50 border border-emerald-200"
                            : "bg-blue-50 border border-blue-200"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        app.stage === "REJECTED"
                          ? "text-red-900"
                          : app.stage === "APPROVED" ||
                              app.stage === "DISBURSED"
                            ? "text-green-900"
                            : "text-blue-900"
                      }`}
                    >
                      {app.stage === "DISBURSED" &&
                        "Your loan has been disbursed successfully"}
                      {app.stage === "APPROVED" &&
                        "Congratulations! Your loan has been approved"}
                      {app.stage === "FORWARDED_TO_MANAGER" &&
                        "Your application is under management review"}
                      {app.stage === "IN_ANALYSIS" &&
                        "Your loan officer is analyzing your application"}
                      {app.stage === "SUBMITTED" &&
                        "Your application has been received"}
                      {app.stage === "REJECTED" &&
                        "Unfortunately, your application was not approved"}
                    </p>
                    {app.rejectionReason && (
                      <p className="text-sm text-red-700 mt-1">
                        Reason: {app.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        Interest Rate
                      </div>
                      <div className="font-semibold text-gray-900">
                        {app.loanProduct?.interestRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        Repayment Period
                      </div>
                      <div className="font-semibold text-gray-900">
                        {Math.floor(app.loanProduct?.repaymentPeriodDays / 30)}{" "}
                        months
                      </div>
                    </div>
                    {app.approvedAmount && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          Approved Amount
                        </div>
                        <div className="font-semibold text-green-600">
                          {formatCurrency(app.approvedAmount)}
                        </div>
                      </div>
                    )}
                    {app.loan && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          Outstanding Balance
                        </div>
                        <div className="font-semibold text-orange-600">
                          {formatCurrency(app.loan.outstandingBalance)}
                        </div>
                      </div>
                    )}
                  </div>

                  {(app.loanOfficer || app.approver) && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Processing Timeline
                      </h4>
                      <div className="space-y-2">
                        {app.loanOfficer && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">Loan Officer:</span>
                            <span className="font-medium text-gray-900">
                              {app.loanOfficer.name}
                            </span>
                          </div>
                        )}
                        {app.approver && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-gray-600">Approved by:</span>
                            <span className="font-medium text-gray-900">
                              {app.approver.name}
                            </span>
                            {app.approvalDate && (
                              <span className="text-gray-500">
                                on {formatDate(app.approvalDate)}
                              </span>
                            )}
                          </div>
                        )}
                        {app.allocatedTeller && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="h-4 w-4 text-blue-500" />
                            <span className="text-gray-600">Teller:</span>
                            <span className="font-medium text-gray-900">
                              {app.allocatedTeller.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <button className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                      View Details
                    </button>
                    {app.stage === "DISBURSED" && (
                      <button className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        View Loan Statement
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // TELLER VIEW
  const TellerView = () => {
    const filtered = demoApplications.filter(
      (app) =>
        (filterStage === "all" || app.stage === filterStage) &&
        (app.member?.user?.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
          app.member?.memberNumber.includes(searchTerm))
    );

    const stats = {
      total: demoApplications.length,
      pending: demoApplications.filter((a) =>
        ["SUBMITTED", "IN_ANALYSIS", "FORWARDED_TO_MANAGER"].includes(a.stage)
      ).length,
      approved: demoApplications.filter((a) => a.stage === "APPROVED").length,
      disbursed: demoApplications.filter((a) => a.stage === "DISBURSED").length,
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Loan Applications Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor all loan applications and their processing status
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 text-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-sm opacity-75">Total</div>
          </div>
          <div className="bg-orange-50 text-orange-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-6 w-6" />
            </div>
            <div className="text-3xl font-bold">{stats.pending}</div>
            <div className="text-sm opacity-75">Pending</div>
          </div>
          <div className="bg-green-50 text-green-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="text-3xl font-bold">{stats.approved}</div>
            <div className="text-sm opacity-75">Approved</div>
          </div>
          <div className="bg-emerald-50 text-emerald-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="text-3xl font-bold">{stats.disbursed}</div>
            <div className="text-sm opacity-75">Disbursed</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or member number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stages</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_ANALYSIS">In Analysis</option>
              <option value="FORWARDED_TO_MANAGER">Forwarded</option>
              <option value="APPROVED">Approved</option>
              <option value="DISBURSED">Disbursed</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-gray-900">
                      {app.member?.user?.name}
                    </h4>
                    <span className="text-sm text-gray-600">
                      #{app.member?.memberNumber}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStageColor(app.stage)}`}
                    >
                      {app.stage?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{app.loanProduct?.name}</span>
                    <span>Applied: {formatDate(app.applicationDate)}</span>
                    {app.loanOfficer && (
                      <span>Officer: {app.loanOfficer.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(app.amountApplied)}
                  </div>
                  <button className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No applications found
            </div>
          )}
        </div>
      </div>
    );
  };

  // MANAGER VIEW
  const ManagerView = () => {
    const pending = demoApplications.filter(
      (a) => a.stage === "FORWARDED_TO_MANAGER"
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Pending Loan Approvals
            </h2>
            <p className="text-gray-600 mt-1">
              Review and approve loan applications
            </p>
          </div>
          <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-semibold">
            {pending.length} Pending
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              All Caught Up!
            </h3>
            <p className="text-gray-600">
              No loan applications pending your approval
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pending.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {app.member?.user?.name}
                        </h3>
                        {app.forwardedAt &&
                          new Date() - new Date(app.forwardedAt) >
                            2 * 24 * 60 * 60 * 1000 && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                              URGENT
                            </span>
                          )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Member #{app.member?.memberNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(app.amountApplied)}
                      </div>
                      <div className="text-xs text-gray-500">Requested</div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-900">
                        {app.loanProduct?.name}
                      </span>
                    </div>
                    <div className="text-sm text-purple-700">
                      {app.loanProduct?.interestRate}% interest •{" "}
                      {Math.floor(app.loanProduct?.repaymentPeriodDays / 30)}{" "}
                      months
                    </div>
                  </div>

                  {app.decisionNotes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-blue-900 mb-1">
                            Officer Analysis
                          </div>
                          <p className="text-sm text-blue-800">
                            {app.decisionNotes}
                          </p>
                          {app.loanOfficer && (
                            <p className="text-xs text-blue-600 mt-2">
                              By {app.loanOfficer.name} •{" "}
                              {formatDate(app.forwardedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {app.appraisalScore && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1">
                          Appraisal Score
                        </div>
                        <div className="font-semibold text-gray-900">
                          {app.appraisalScore}/100
                        </div>
                      </div>
                    )}
                    {app.debtToIncomeRatio !== undefined && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-600 mb-1">
                          Debt-to-Income
                        </div>
                        <div
                          className={`font-semibold ${app.debtToIncomeRatio > 45 ? "text-red-600" : "text-green-600"}`}
                        >
                          {app.debtToIncomeRatio.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mb-3">
                    <button className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium flex items-center justify-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                    <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                  </div>

                  <button className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm text-gray-700 font-medium flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // LOAN OFFICER VIEW
  const LoanOfficerView = () => {
    const submittedByOfficers = demoApplications.filter((a) => a.loanOfficer);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              My Loan Applications
            </h2>
            <p className="text-gray-600 mt-1">
              Submit and track loan applications
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Application
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 text-blue-700 rounded-lg p-4">
            <div className="text-3xl font-bold">
              {submittedByOfficers.length}
            </div>
            <div className="text-sm opacity-75">Total Submitted</div>
          </div>
          <div className="bg-orange-50 text-orange-700 rounded-lg p-4">
            <div className="text-3xl font-bold">
              {
                submittedByOfficers.filter((a) =>
                  ["IN_ANALYSIS", "FORWARDED_TO_MANAGER"].includes(a.stage)
                ).length
              }
            </div>
            <div className="text-sm opacity-75">Pending Review</div>
          </div>
          <div className="bg-green-50 text-green-700 rounded-lg p-4">
            <div className="text-3xl font-bold">
              {submittedByOfficers.filter((a) => a.stage === "APPROVED").length}
            </div>
            <div className="text-sm opacity-75">Approved</div>
          </div>
          <div className="bg-red-50 text-red-700 rounded-lg p-4">
            <div className="text-3xl font-bold">
              {submittedByOfficers.filter((a) => a.stage === "REJECTED").length}
            </div>
            <div className="text-sm opacity-75">Rejected</div>
          </div>
        </div>

        <div className="space-y-3">
          {submittedByOfficers.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-gray-900">
                      {app.member?.user?.name}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStageColor(app.stage)}`}
                    >
                      {app.stage?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{app.loanProduct?.name}</span>
                    <span>Submitted: {formatDate(app.applicationDate)}</span>
                    {app.approver && (
                      <span className="text-green-600">
                        ✓ Approved by {app.approver.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(app.amountApplied)}
                  </div>
                  <button className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Loan Management System
            </h1>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveView("member")}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeView === "member"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Member View
            </button>
            <button
              onClick={() => setActiveView("teller")}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeView === "teller"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Building className="h-4 w-4 inline mr-2" />
              Teller View
            </button>
            <button
              onClick={() => setActiveView("manager")}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeView === "manager"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Manager View
            </button>
            <button
              onClick={() => setActiveView("officer")}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeView === "officer"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Loan Officer View
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === "member" && <MemberView />}
        {activeView === "teller" && <TellerView />}
        {activeView === "manager" && <ManagerView />}
        {activeView === "officer" && <LoanOfficerView />}
      </div>
    </div>
  );
}
