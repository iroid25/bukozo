"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  CreditCard,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Save,
  X,
  Trash2,
  Power,
  AlertTriangle,
  Filter,
  Download,
  Eye,
} from "lucide-react";


interface LoanProductDetailsProps {
  loanProduct: {
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number;
    interestRate: number;
    repaymentPeriodDays: number;
    description?: string | null;
    isActive: boolean;
    interestType: "FLAT_RATE" | "REDUCING_BALANCE";
    interestPeriod: "MONTHLY" | "ANNUAL";
    ledgerAccountId: string | null;
    interestAccountId: string | null;
    penaltyAccountId: string | null;
    feeAccountId: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    loanApplications: Array<{
      id: string;
      amountApplied: number;
      applicationDate: string | Date;
      status: string;
      purpose?: string | null;
      approvalDate?: Date | null;
      rejectionReason?: string | null;
      member: {
        memberNumber: string;
        user: {
          name: string;
          firstName: string;
          lastName: string;
          email: string | null;
          phone?: string | null;
        };
      };
      approver?: {
        name: string;
        firstName: string;
        lastName: string;
      } | null;
      loan?: {
        id: string;
        amountGranted: number;
        status: string;
        disbursementDate: string | Date | null;
        outstandingBalance: number;
      } | null;
    }>;
  };
  stats: {
    totalApplications: number;
    approvedApplications: number;
    rejectedApplications: number;
    pendingApplications: number;
    totalDisbursed: number;
    totalLoansCount: number;
    activeLoans: number;
    outstandingBalance: number;
    approvalRate: number;
  };
}

export default function LoanProductDetails({
  loanProduct,
  stats,
}: LoanProductDetailsProps) {
  const STANDARD_LEDGER_ACCOUNT_CODES = ["107000", "102003"] as const;
  const STANDARD_LEDGER_ACCOUNT_NAME = "Loan Portfolio";
  const STANDARD_INTEREST_ACCOUNT_CODE = "401001";
  const STANDARD_INTEREST_ACCOUNT_NAME = "Interest paid";
  const STANDARD_FEE_ACCOUNT_CODE = "401002";
  const STANDARD_FEE_ACCOUNT_NAME = "Loan processing fees";
  const STANDARD_PENALTY_ACCOUNT_CODE = "401005";
  const STANDARD_PENALTY_ACCOUNT_NAME = "Loan penalty paid";
  const [isEditing, setIsEditing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [assetClassifications, setAssetClassifications] = useState<any[]>([]);
  const [incomeItems, setIncomeItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("applications");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [lastSaveSummary, setLastSaveSummary] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Fetch setup data for editing
  useEffect(() => {
    async function fetchSetupData() {
      try {
        const [accountsResponse, incomeItemsResponse, assetClassificationsResponse] = await Promise.all([
          fetch("/api/v1/accounting/coa"),
          fetch("/api/v1/income/categories"),
          fetch("/api/v1/accounts/classifications?type=CURRENT"),
        ]);

        const [accountsResult, incomeItemsResult, assetClassificationsResult] = await Promise.all([
          accountsResponse.json(),
          incomeItemsResponse.json(),
          assetClassificationsResponse.json(),
        ]);

        if (accountsResult.success) {
          setAccounts(accountsResult.data || []);
        }

        setIncomeItems(incomeItemsResult.data || []);
        setAssetClassifications(Array.isArray(assetClassificationsResult) ? assetClassificationsResult : []);
      } catch (error) {
        console.error("Error fetching setup data:", error);
      }
    }
    fetchSetupData();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    name: loanProduct.name,
    minAmount: loanProduct.minAmount.toString(),
    maxAmount: loanProduct.maxAmount.toString(),
    interestRate: loanProduct.interestRate.toString(), 
    repaymentPeriodDays: loanProduct.repaymentPeriodDays.toString(),
    description: loanProduct.description || "",
    isActive: loanProduct.isActive,
    interestType: loanProduct.interestType || "FLAT_RATE",
    interestPeriod: loanProduct.interestPeriod || "MONTHLY",
    ledgerAccountId: loanProduct.ledgerAccountId || "",
    interestAccountId: loanProduct.interestAccountId || "",
    penaltyAccountId: loanProduct.penaltyAccountId || "",
    feeAccountId: loanProduct.feeAccountId || "",
  });
  const standardLoanAssetClassification =
    accounts.find(
      (item) =>
        STANDARD_LEDGER_ACCOUNT_CODES.includes(item.accountCode) &&
        item.isActive !== false
    ) ||
    assetClassifications.find(
      (item) =>
        STANDARD_LEDGER_ACCOUNT_CODES.includes(item.accountCode) &&
        item.isActive !== false
    );
  const standardInterestAccount =
    accounts.find((item) => item.accountCode === STANDARD_INTEREST_ACCOUNT_CODE) ||
    incomeItems.find((item) => item.code === STANDARD_INTEREST_ACCOUNT_CODE);
  const standardFeeAccount =
    accounts.find((item) => item.accountCode === STANDARD_FEE_ACCOUNT_CODE) ||
    incomeItems.find((item) => item.code === STANDARD_FEE_ACCOUNT_CODE);
  const standardPenaltyAccount =
    accounts.find((item) => item.accountCode === STANDARD_PENALTY_ACCOUNT_CODE) ||
    incomeItems.find((item) => item.code === STANDARD_PENALTY_ACCOUNT_CODE);
  const mappedInterestAccount = accounts.find(
    (account) => account.id === loanProduct.interestAccountId
  );
  const mappedFeeAccount = accounts.find(
    (account) => account.id === loanProduct.feeAccountId
  );
  const mappedLedgerAccount = accounts.find(
    (account) => account.id === loanProduct.ledgerAccountId
  );
  const mappedPenaltyAccount = accounts.find(
    (account) => account.id === loanProduct.penaltyAccountId
  );

  const mappingHealth = [
    {
      label: "Principal",
      expected: STANDARD_LEDGER_ACCOUNT_CODES.includes(
        standardLoanAssetClassification?.accountCode || "",
      ),
      mapped: Boolean(mappedLedgerAccount),
      details: mappedLedgerAccount
        ? `${mappedLedgerAccount.accountCode} - ${mappedLedgerAccount.accountName}`
        : "Not mapped",
    },
    {
      label: "Interest",
      expected: Boolean(standardInterestAccount),
      mapped: Boolean(mappedInterestAccount),
      details: mappedInterestAccount
        ? `${mappedInterestAccount.accountCode} - ${mappedInterestAccount.accountName}`
        : "Not mapped",
    },
    {
      label: "Fee",
      expected: Boolean(standardFeeAccount),
      mapped: Boolean(mappedFeeAccount),
      details: mappedFeeAccount
        ? `${mappedFeeAccount.accountCode} - ${mappedFeeAccount.accountName}`
        : "Not mapped",
    },
    {
      label: "Penalty",
      expected: Boolean(standardPenaltyAccount),
      mapped: Boolean(mappedPenaltyAccount),
      details: mappedPenaltyAccount
        ? `${mappedPenaltyAccount.accountCode} - ${mappedPenaltyAccount.accountName}`
        : "Not mapped",
    },
  ];

  const buildUpdateSummary = (previous: typeof formData, next: typeof formData) => {
    const changes: string[] = [];

    const pushIfChanged = (label: string, before: string | boolean, after: string | boolean) => {
      if (before !== after) {
        changes.push(`${label}: ${before} -> ${after}`);
      }
    };

    pushIfChanged("Name", previous.name, next.name);
    pushIfChanged("Min amount", previous.minAmount, next.minAmount);
    pushIfChanged("Max amount", previous.maxAmount, next.maxAmount);
    pushIfChanged("Interest rate", previous.interestRate, next.interestRate);
    pushIfChanged("Repayment period", previous.repaymentPeriodDays, next.repaymentPeriodDays);
    pushIfChanged("Description", previous.description || "(empty)", next.description || "(empty)");
    pushIfChanged("Active", previous.isActive, next.isActive);
    pushIfChanged("Interest period", previous.interestPeriod, next.interestPeriod);
    pushIfChanged("Principal account", previous.ledgerAccountId, next.ledgerAccountId);
    pushIfChanged("Interest account", previous.interestAccountId, next.interestAccountId);
    pushIfChanged("Fee account", previous.feeAccountId, next.feeAccountId);
    pushIfChanged("Penalty account", previous.penaltyAccountId, next.penaltyAccountId);

    return changes;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      DISBURSED: "bg-blue-100 text-blue-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!standardLoanAssetClassification?.id) {
      setMessage({
        type: "error",
        text: "Loan portfolio account (107000 or 102003) is missing or inactive.",
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    if (!standardInterestAccount?.id) {
      setMessage({
        type: "error",
        text: "Interest paid income item (401001) is missing or inactive.",
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    if (!standardFeeAccount?.id) {
      setMessage({
        type: "error",
        text: "Loan processing fees income item (401002) is missing or inactive.",
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    if (!standardPenaltyAccount?.id) {
      setMessage({
        type: "error",
        text: "Loan penalty paid income item (401005) is missing or inactive.",
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    const payload = {
      name: formData.name,
      minAmount: Number(formData.minAmount),
      maxAmount: Number(formData.maxAmount),
      interestRate: Number(formData.interestRate), 
      repaymentPeriodDays: Number(formData.repaymentPeriodDays),
      description: formData.description,
      isActive: formData.isActive,
      interestType: formData.interestType,
      interestPeriod: formData.interestPeriod,
      ledgerAccountId: standardLoanAssetClassification.id,
      interestAccountId: standardInterestAccount.id,
      feeAccountId: standardFeeAccount.id,
      penaltyAccountId: standardPenaltyAccount.id,
    };

    startTransition(async () => {
      try {
        const previousState = { ...formData };
        const response = await fetch(`/api/v1/loan-products/${loanProduct.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
          setMessage({
            type: "success",
            text: "Loan product updated successfully!",
          });
          setIsEditing(false);
          // Update form data with latest values (and state if needed, though usually revalidatePath handles data refresh, client state update ensures immediate UI feedback)
          const updated = result.data;
          setLastSaveSummary(buildUpdateSummary(previousState, {
            name: updated.name,
            minAmount: updated.minAmount.toString(),
            maxAmount: updated.maxAmount.toString(),
            interestRate: updated.interestRate.toString(),
            repaymentPeriodDays: updated.repaymentPeriodDays.toString(),
            description: updated.description || "",
            isActive: updated.isActive,
            interestType: updated.interestType || "FLAT_RATE",
            interestPeriod: updated.interestPeriod || "MONTHLY",
            ledgerAccountId: updated.ledgerAccountId || "",
            interestAccountId: updated.interestAccountId || "",
            penaltyAccountId: updated.penaltyAccountId || "",
            feeAccountId: updated.feeAccountId || "",
          }));
          setLastSavedAt(new Date().toISOString());
          setFormData({
            name: updated.name,
            minAmount: updated.minAmount.toString(),
            maxAmount: updated.maxAmount.toString(),
            interestRate: updated.interestRate.toString(),
            repaymentPeriodDays: updated.repaymentPeriodDays.toString(),
            description: updated.description || "",
            isActive: updated.isActive,
            interestType: updated.interestType || "FLAT_RATE",
            interestPeriod: updated.interestPeriod || "MONTHLY",
            ledgerAccountId: updated.ledgerAccountId || "",
            interestAccountId: updated.interestAccountId || "",
            penaltyAccountId: updated.penaltyAccountId || "",
            feeAccountId: updated.feeAccountId || "",
          });
          router.refresh();
        } else {
          setMessage({
            type: "error",
            text: result.error || "Failed to update loan product",
          });
        }
      } catch (error) {
        setMessage({
          type: "error",
          text: "An unexpected error occurred",
        });
      }

      setTimeout(() => setMessage(null), 5000);
    });
  };

  const handleToggleStatus = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/loan-products/${loanProduct.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: !loanProduct.isActive }),
        });

        const result = await response.json();

        if (response.ok) {
          setMessage({
            type: "success",
            text: `Loan product ${!loanProduct.isActive ? "activated" : "deactivated"} successfully`,
          });
          setFormData((prev) => ({ ...prev, isActive: !prev.isActive }));
          router.refresh();
        } else {
           setMessage({
            type: "error",
            text: result.error || "Failed to update status",
          });
        }
      } catch (error) {
          setMessage({
            type: "error",
            text: "Failed to update status",
          });
      }

      setTimeout(() => setMessage(null), 5000);
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/loan-products/${loanProduct.id}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (response.ok) {
          setMessage({
            type: "success",
            text: "Loan product deleted successfully!",
          });
          setShowDeleteModal(false);
          router.push("/dashboard/loan-products");
        } else {
          setMessage({
            type: "error",
            text: result.error || "Failed to delete loan product",
          });
        }
      } catch (error) {
         setMessage({
            type: "error",
            text: "Failed to delete loan product",
          });
      }

      setTimeout(() => setMessage(null), 5000);
    });
  };

  const filteredApplications = loanProduct.loanApplications.filter(
    (application) => {
      if (applicationFilter === "all") return true;
      return application.status === applicationFilter;
    }
  );

  const handleExportApplications = () => {
    const rows = filteredApplications.map((a) => ({
      "Member Number": a.member.memberNumber,
      "Member Name": a.member.user.name,
      "Email": a.member.user.email || "",
      "Phone": a.member.user.phone || "",
      "Amount Applied": a.amountApplied,
      "Status": a.status,
      "Application Date": new Date(a.applicationDate).toLocaleDateString("en-UG"),
      "Purpose": a.purpose || "",
      "Approved By": a.approver ? `${a.approver.firstName} ${a.approver.lastName}` : "",
      "Loan Amount Granted": a.loan?.amountGranted ?? "",
      "Outstanding Balance": a.loan?.outstandingBalance ?? "",
      "Loan Status": a.loan?.status ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Applications");
    const filter = applicationFilter === "all" ? "All" : applicationFilter;
    XLSX.writeFile(wb, `${loanProduct.name}_Applications_${filter}.xlsx`);
  };

  useEffect(() => {
    if (!standardLoanAssetClassification?.id) return;
    setFormData((prev) =>
      prev.ledgerAccountId === standardLoanAssetClassification.id
        ? prev
        : { ...prev, ledgerAccountId: standardLoanAssetClassification.id }
    );
  }, [standardLoanAssetClassification?.id]);

  useEffect(() => {
    if (!standardInterestAccount?.id) return;
    setFormData((prev) =>
      prev.interestAccountId === standardInterestAccount.id
        ? prev
        : { ...prev, interestAccountId: standardInterestAccount.id }
    );
  }, [standardInterestAccount?.id]);

  useEffect(() => {
    if (!standardFeeAccount?.id) return;
    setFormData((prev) =>
      prev.feeAccountId === standardFeeAccount.id
        ? prev
        : { ...prev, feeAccountId: standardFeeAccount.id }
    );
  }, [standardFeeAccount?.id]);

  useEffect(() => {
    if (!standardPenaltyAccount?.id) return;
    setFormData((prev) =>
      prev.penaltyAccountId === standardPenaltyAccount.id
        ? prev
        : { ...prev, penaltyAccountId: standardPenaltyAccount.id }
    );
  }, [standardPenaltyAccount?.id]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Message Alert */}
        {message && (
          <div
            className={`p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
          >
            {message.text}
          </div>
        )}

        {(lastSavedAt || lastSaveSummary.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Last Save Summary</h2>
                <p className="text-sm text-gray-500">
                  {lastSavedAt ? `Saved at ${formatDate(lastSavedAt)}` : "Awaiting first save"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Sync healthy</span>
              </div>
            </div>
            {lastSaveSummary.length > 0 ? (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                {lastSaveSummary.map((item) => (
                  <li key={item} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No field changes recorded yet.</p>
            )}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {loanProduct.name}
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    loanProduct.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {loanProduct.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-gray-600">
                {formatCurrency(loanProduct.minAmount)} -{" "}
                {formatCurrency(loanProduct.maxAmount)} •{" "}
                {loanProduct.interestRate}% {loanProduct.interestPeriod === "ANNUAL" ? "p.a" : "per month"} • {loanProduct.repaymentPeriodDays}{" "}
                days • {loanProduct.interestType === "FLAT_RATE" ? "Flat Rate" : "Reducing Balance"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isPending}
              >
                {isEditing ? (
                  <X className="h-4 w-4 mr-2" />
                ) : (
                  <Edit className="h-4 w-4 mr-2" />
                )}
                {isEditing ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={handleToggleStatus}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  loanProduct.isActive
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
                disabled={isPending}
              >
                <Power className="h-4 w-4 mr-2" />
                {loanProduct.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Total Applications
              </h3>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalApplications}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.approvalRate.toFixed(1)}% approval rate
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Total Disbursed
              </h3>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalDisbursed)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.totalLoansCount} loans
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Outstanding</h3>
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.outstandingBalance)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.activeLoans} active loans
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Pending</h3>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pendingApplications}
            </p>
            <p className="text-xs text-gray-600 mt-1">Awaiting review</p>
          </div>
        </div>

        {/* Product Details and Edit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Product Details
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Name</span>
                <span className="text-gray-900">{loanProduct.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">
                  Minimum Amount
                </span>
                <span className="text-gray-900">
                  {formatCurrency(loanProduct.minAmount)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">
                  Maximum Amount
                </span>
                <span className="text-gray-900">
                  {formatCurrency(loanProduct.maxAmount)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Interest Rate</span>
                <span className="text-gray-900">
                  {loanProduct.interestRate}% {loanProduct.interestPeriod === "ANNUAL" ? "p.a" : "per month"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Interest Type</span>
                <span className="text-gray-900">
                  {loanProduct.interestType === "FLAT_RATE" ? "Flat Rate" : "Reducing Balance"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">
                  Repayment Period
                </span>
                <span className="text-gray-900">
                  {loanProduct.repaymentPeriodDays} days
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Status</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    loanProduct.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {loanProduct.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Accounting Mappings Display */}
              <div className="pt-4 mt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Accounting Mappings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Principal Account:</span>
                    <span className="font-medium">
                      {mappedLedgerAccount
                        ? `${mappedLedgerAccount.accountCode} - ${mappedLedgerAccount.accountName}`
                        : "Not mapped"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Interest Account:</span>
                    <span className="font-medium">
                      {mappedInterestAccount
                        ? `${mappedInterestAccount.accountCode} - ${mappedInterestAccount.accountName}`
                        : "Not mapped"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Penalty Account:</span>
                    <span className="font-medium">
                      {mappedPenaltyAccount
                        ? `${mappedPenaltyAccount.accountCode} - ${mappedPenaltyAccount.accountName}`
                        : "Not mapped"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fee Account:</span>
                    <span className="font-medium">
                      {mappedFeeAccount
                        ? `${mappedFeeAccount.accountCode} - ${mappedFeeAccount.accountName}`
                        : "Not mapped"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Mapping Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mappingHealth.map((item) => (
                    <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            item.expected && item.mapped
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {item.expected && item.mapped ? "OK" : "Check"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">{item.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Created</span>
                <span className="text-gray-900">
                  {formatDate(loanProduct.createdAt)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium text-gray-700">Last Updated</span>
                <span className="text-gray-900">
                  {formatDate(loanProduct.updatedAt)}
                </span>
              </div>
              {loanProduct.description && (
                <div className="pt-4">
                  <span className="font-medium text-gray-700 block mb-2">
                    Description
                  </span>
                  <p className="text-gray-900 text-sm leading-relaxed">
                    {loanProduct.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {isEditing ? "Edit Product" : "Product Information"}
            </h2>

            {isEditing ? (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.minAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          minAmount: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.maxAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxAmount: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.interestRate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          interestRate: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Interest Period *
                    </label>
                    <select
                        value={formData.interestPeriod}
                        onChange={(e) => setFormData(prev => ({ ...prev, interestPeriod: e.target.value as "MONTHLY" | "ANNUAL" }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                    >
                        <option value="MONTHLY">Monthly (% p.m.)</option>
                        <option value="ANNUAL">Annual (% p.a.)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Repayment Period (Days) *
                    </label>
                    <input
                      type="number"
                      value={formData.repaymentPeriodDays}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          repaymentPeriodDays: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optional description of the loan product..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Principal Account *
                    </label>
                    <input
                      type="text"
                      value={
                        standardLoanAssetClassification
                          ? `${standardLoanAssetClassification.accountCode} - ${standardLoanAssetClassification.accountName}`
                        : `${STANDARD_LEDGER_ACCOUNT_CODES[0]} - ${STANDARD_LEDGER_ACCOUNT_NAME} not configured`
                      }
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Loan principal always uses the standard loan asset account.
                    </p>
                    {!standardLoanAssetClassification && (
                      <p className="mt-2 text-xs text-red-600">
                        Create and activate the loan portfolio asset account before saving this product.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interest Account *
                    </label>
                    <input
                      type="text"
                      value={
                        standardInterestAccount
                          ? `${standardInterestAccount.accountCode} - ${standardInterestAccount.accountName}`
                          : `${STANDARD_INTEREST_ACCOUNT_NAME} (${STANDARD_INTEREST_ACCOUNT_CODE}) not configured`
                      }
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Loan interest always uses the standard Chart of Accounts item `401001 - Interest paid`.
                    </p>
                    {!standardInterestAccount && (
                      <p className="mt-2 text-xs text-red-600">
                        Create and activate `401001 - Interest paid` in the Chart of Accounts before saving this product.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Penalty Account
                    </label>
                    <input
                      type="text"
                      value={
                        standardPenaltyAccount
                          ? `${standardPenaltyAccount.accountCode} - ${standardPenaltyAccount.accountName}`
                          : `${STANDARD_PENALTY_ACCOUNT_NAME} (${STANDARD_PENALTY_ACCOUNT_CODE}) not configured`
                      }
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Loan penalties always use the standard Chart of Accounts item `401005 - Loan penalty paid`.
                    </p>
                    {!standardPenaltyAccount && (
                      <p className="mt-2 text-xs text-red-600">
                        Create and activate `401005 - Loan penalty paid` in the Chart of Accounts before saving this product.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fee Account
                    </label>
                    <input
                      type="text"
                      value={
                        standardFeeAccount
                          ? `${standardFeeAccount.accountCode} - ${standardFeeAccount.accountName}`
                          : `${STANDARD_FEE_ACCOUNT_NAME} (${STANDARD_FEE_ACCOUNT_CODE}) not configured`
                      }
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Loan processing fees always use the standard Chart of Accounts item `401002 - Loan processing fees`.
                    </p>
                    {!standardFeeAccount && (
                      <p className="mt-2 text-xs text-red-600">
                        Create and activate `401002 - Loan processing fees` in the Chart of Accounts before saving this product.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isActive"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Product is active
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isPending ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-12">
                <Edit className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  Click "Edit" to modify product details
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Product
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Applications Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Loan Applications
              </h2>
              <div className="flex gap-2">
                <select
                  value={applicationFilter}
                  onChange={(e) => setApplicationFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="DISBURSED">Disbursed</option>
                </select>
                <button
                  onClick={handleExportApplications}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {filteredApplications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applicant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applied
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purpose
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredApplications.map((application) => (
                      <tr key={application.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {application.member.user.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              #{application.member.memberNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(application.amountApplied)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(application.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(application.applicationDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {application.purpose || "Not specified"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => router.push(`/dashboard/loan-applications/${application.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View application"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No applications found</p>
                {applicationFilter !== "all" && (
                  <button
                    onClick={() => setApplicationFilter("all")}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                  >
                    Show all applications
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Loan Product
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this loan product? This action
                cannot be undone.
                {stats.totalApplications > 0 && (
                  <span className="block mt-2 text-red-600 font-medium">
                    Warning: This product has {stats.totalApplications}{" "}
                    associated applications.
                  </span>
                )}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
