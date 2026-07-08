// app/dashboard/my-float/components/EnhancedTellerDashboard.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EndOfDayReconciliationForm from "./EndOfDayReconciliationForm";

interface DayStatus {
  status: string;
  message: string;
  canOperate: boolean;
  needsReconciliation: boolean;
  daysOverdue?: number;
}

interface DayActivity {
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
  openingBalance: number;
  expectedBalance: number;
  transactions: any[];
}

interface CashActivity {
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  date: Date;
}

export default function EnhancedTellerDashboard({
  userFloat,
  floatTransactions = [],
  floatReconciliations = [],
  currentUser,
  cashActivity,
}: {
  userFloat: any;
  floatTransactions: any[];
  floatReconciliations: any[];
  currentUser: any;
  cashActivity?: CashActivity;
}) {
  const router = useRouter();
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);

  useEffect(() => {
    checkDayStatus();
  }, [userFloat]);

  const checkDayStatus = () => {
    if (!userFloat) {
      setDayStatus({
        status: "NO_FLOAT",
        message: "No float assigned",
        canOperate: false,
        needsReconciliation: false,
      });
      return;
    }

    let daysOverdue = 0;
    if (userFloat.currentDayStarted) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayStarted = new Date(userFloat.currentDayStarted);
      dayStarted.setHours(0, 0, 0, 0);
      daysOverdue = Math.floor(
        (today.getTime() - dayStarted.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    if (userFloat.pendingReconciliation) {
      setDayStatus({
        status: "PENDING_APPROVAL",
        message: "End-of-day reconciliation pending accountant approval",
        canOperate: false,
        needsReconciliation: false,
      });
      return;
    }

    if (!userFloat.canStartNewDay && !userFloat.isActiveForDay) {
      setDayStatus({
        status: "BLOCKED",
        message:
          daysOverdue > 0
            ? `Day started ${daysOverdue} day(s) ago needs reconciliation`
            : "Previous day not reconciled. Complete end-of-day reconciliation.",
        canOperate: false,
        needsReconciliation: true,
        daysOverdue,
      });
      return;
    }

    if (!userFloat.isActiveForDay) {
      setDayStatus({
        status: "NOT_STARTED",
        message: "Day not started. Request float allocation from accountant.",
        canOperate: false,
        needsReconciliation: false,
      });
      return;
    }

    if (daysOverdue > 0) {
      setDayStatus({
        status: "ACTIVE_OVERDUE",
        message: `Float active but day started ${daysOverdue} day(s) ago. Consider reconciling.`,
        canOperate: true,
        needsReconciliation: true,
        daysOverdue,
      });
      return;
    }

    setDayStatus({
      status: "ACTIVE",
      message: "Float active - You can process transactions",
      canOperate: true,
      needsReconciliation: false,
    });
  };

  const dayActivity: DayActivity = useMemo(() => {
    if (!userFloat?.currentDayStarted) {
      return {
        openingBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        transactionCount: 0,
        expectedBalance: 0,
        transactions: [],
      };
    }

    const dayStarted = new Date(userFloat.currentDayStarted);
    dayStarted.setHours(0, 0, 0, 0);

    const dayTransactions = floatTransactions.filter((t) => {
      const txDate = new Date(t.transactionDate);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === dayStarted.getTime();
    });

    let openingBalance = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    const sortedTransactions = [...dayTransactions].sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() -
        new Date(b.transactionDate).getTime()
    );

    if (sortedTransactions.length > 0) {
      const firstTx = sortedTransactions[0];
      if (
        firstTx.type === "FLOAT_ALLOCATION" &&
        firstTx.description?.toLowerCase().includes("start")
      ) {
        openingBalance = firstTx.amount;
      }
    }

    if (openingBalance === 0 && userFloat) {
      const netChange = dayTransactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
      openingBalance = Number(userFloat.balance) - netChange;
    }

    dayTransactions.forEach((tx) => {
      if (
        tx.type === "FLOAT_ALLOCATION" &&
        tx.description?.toLowerCase().includes("start")
      ) {
        return;
      }

      if (tx.amount > 0) {
        totalDeposits += tx.amount;
      } else if (tx.amount < 0) {
        totalWithdrawals += Math.abs(tx.amount);
      }
    });

    const expectedBalance = openingBalance + totalDeposits - totalWithdrawals;

    return {
      openingBalance,
      totalDeposits,
      totalWithdrawals,
      transactionCount: dayTransactions.length,
      expectedBalance,
      transactions: dayTransactions,
    };
  }, [floatTransactions, userFloat]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getStatusColor = () => {
    switch (dayStatus?.status) {
      case "ACTIVE":
        return "bg-green-50 border-green-300 text-green-900";
      case "ACTIVE_OVERDUE":
        return "bg-yellow-50 border-yellow-300 text-yellow-900";
      case "PENDING_APPROVAL":
        return "bg-orange-50 border-orange-300 text-orange-900";
      case "BLOCKED":
      case "NOT_STARTED":
        return "bg-red-50 border-red-300 text-red-900";
      default:
        return "bg-gray-50 border-gray-300 text-gray-900";
    }
  };

  const getStatusIcon = () => {
    switch (dayStatus?.status) {
      case "ACTIVE":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "ACTIVE_OVERDUE":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case "PENDING_APPROVAL":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "BLOCKED":
      case "NOT_STARTED":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const latestReconciliation =
    floatReconciliations.length > 0 ? floatReconciliations[0] : null;

  const handleEndOfDay = () => {
    if (!userFloat) {
      toast.error("No float assigned", {
        description: "You need an active float to perform reconciliation.",
      });
      return;
    }

    if (!userFloat.currentDayStarted) {
      toast.info("Opening Reconciliation Form", {
        description:
          "You can fill in reconciliation details. Note: No active day has been started yet.",
        duration: 4000,
      });
    } else if (dayStatus?.daysOverdue && dayStatus.daysOverdue > 0) {
      const dayLabel =
        dayStatus.daysOverdue === 1
          ? "yesterday"
          : `${dayStatus.daysOverdue} days ago`;
      toast.info("Reconciling Previous Day", {
        description: `You're reconciling the day started ${dayLabel} (${formatDate(userFloat.currentDayStarted)})`,
        duration: 5000,
      });
    }

    setShowEndOfDayModal(true);
  };

  const handleReconciliationSuccess = () => {
    setShowEndOfDayModal(false);
    toast.success("Reconciliation submitted successfully!", {
      description: "Refreshing your dashboard...",
      duration: 2000,
    });

    // Use router.refresh() instead of window.location.reload()
    setTimeout(() => {
      router.refresh();
    }, 1000);
  };

  const handleManualRefresh = () => {
    toast.loading("Refreshing data...", { id: "refresh-toast" });
    router.refresh();
    setTimeout(() => {
      toast.dismiss("refresh-toast");
      toast.success("Data refreshed");
    }, 500);
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "FLOAT_ALLOCATION":
        return "bg-green-100 text-green-800";
      case "DEPOSIT":
        return "bg-blue-100 text-blue-800";
      case "WITHDRAWAL":
        return "bg-red-100 text-red-800";
      case "FLOAT_RECONCILIATION":
        return "bg-purple-100 text-purple-800";
      case "LOAN_DISBURSEMENT":
        return "bg-orange-100 text-orange-800";
      case "LOAN_REPAYMENT":
        return "bg-indigo-100 text-indigo-800";
      case "SHARES_PURCHASE":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getReconciliationStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "UNDER_REVIEW":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Critical Status Banner */}
      <div className={`border-2 rounded-lg p-6 ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={
                dayStatus?.status === "ACTIVE"
                  ? "text-green-600"
                  : dayStatus?.status === "ACTIVE_OVERDUE"
                    ? "text-yellow-600"
                    : dayStatus?.status === "PENDING_APPROVAL"
                      ? "text-orange-600"
                      : "text-red-600"
              }
            >
              {getStatusIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                Float Status: {dayStatus?.status?.replace(/_/g, " ")}
              </h2>
              <p className="text-sm mt-1">{dayStatus?.message}</p>
              {userFloat?.currentDayStarted && (
                <p className="text-xs mt-1 opacity-75">
                  Day started: {formatDate(userFloat.currentDayStarted)}
                  {dayStatus?.daysOverdue && dayStatus.daysOverdue > 0 && (
                    <span className="ml-2 font-semibold text-red-600">
                      ({dayStatus.daysOverdue} day
                      {dayStatus.daysOverdue > 1 ? "s" : ""} ago)
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 rounded-lg font-medium transition-colors shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="Refresh data"
            >
              <svg
                className="w-5 h-5 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {userFloat && (
              <button
                onClick={handleEndOfDay}
                className={`px-6 py-3 rounded-lg font-medium transition-colors shadow-sm ${
                  userFloat.pendingReconciliation
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : dayStatus?.status === "BLOCKED"
                      ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                      : dayStatus?.status === "ACTIVE_OVERDUE"
                        ? "bg-yellow-600 text-white hover:bg-yellow-700"
                        : userFloat?.currentDayStarted
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
              >
                <svg
                  className="w-5 h-5 inline mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                {userFloat.pendingReconciliation
                  ? "View Pending Reconciliation"
                  : !userFloat?.currentDayStarted
                    ? "Open Reconciliation Form"
                    : dayStatus?.status === "BLOCKED"
                      ? "Submit Overdue Reconciliation"
                      : dayStatus?.daysOverdue && dayStatus.daysOverdue > 0
                        ? `Reconcile Day (${dayStatus.daysOverdue} day${dayStatus.daysOverdue > 1 ? "s" : ""} old)`
                        : "End Day & Reconcile"}
              </button>
            )}
          </div>
        </div>
      </div>

      {dayStatus?.status === "ACTIVE_OVERDUE" && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-yellow-600 rounded-full p-3">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">
                ⚠️ Reconciliation Recommended
              </h3>
              <div className="text-sm text-yellow-800 space-y-2">
                <p>
                  Your current float day was started{" "}
                  <strong>
                    {dayStatus.daysOverdue} day
                    {dayStatus.daysOverdue! > 1 ? "s" : ""} ago
                  </strong>{" "}
                  on {formatDate(userFloat.currentDayStarted)}.
                </p>
                <p>
                  While you can continue processing transactions, it's
                  recommended to reconcile to maintain accurate daily records.
                </p>
                <div className="mt-3 p-3 bg-white border border-yellow-300 rounded-lg">
                  <p className="font-semibold text-yellow-900 mb-1">
                    💡 You can reconcile anytime - there's no time limit!
                  </p>
                  <p className="text-xs">
                    Click the reconciliation button above whenever you're ready.
                    Your float will remain active.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!dayStatus?.canOperate && dayStatus?.status !== "NO_FLOAT" && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-600 rounded-full p-3">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                Transaction Processing Blocked
              </h3>
              <div className="text-sm text-red-800 space-y-2">
                {dayStatus?.status === "BLOCKED" && (
                  <>
                    <p className="font-semibold text-base">
                      ⚠️ You cannot process any new transactions
                    </p>
                    <p>
                      Your float is blocked because you have an unreconciled day
                      from{" "}
                      <strong>{formatDate(userFloat.currentDayStarted)}</strong>
                      {dayStatus.daysOverdue && dayStatus.daysOverdue > 0 && (
                        <span>
                          {" "}
                          ({dayStatus.daysOverdue} day
                          {dayStatus.daysOverdue > 1 ? "s" : ""} ago)
                        </span>
                      )}
                      .
                    </p>
                    <div className="bg-white border-2 border-red-400 rounded-lg p-3 mt-3">
                      <p className="font-bold text-red-900 mb-1">
                        ✅ How to unblock:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-red-800">
                        <li>
                          Click "Submit Overdue Reconciliation" button above
                        </li>
                        <li>Count your physical cash and complete the form</li>
                        <li>Submit for processing</li>
                        <li>
                          Once processed, you can start new days and process
                          transactions
                        </li>
                      </ul>
                    </div>
                  </>
                )}
                {dayStatus?.status === "PENDING_APPROVAL" &&
                  latestReconciliation && (
                    <>
                      <p>Your end-of-day reconciliation is being processed.</p>
                      <p className="font-medium">
                        Please wait for the system to complete the
                        reconciliation.
                      </p>
                    </>
                  )}
                {dayStatus?.status === "NOT_STARTED" && (
                  <>
                    <p>Your float has not been allocated for today.</p>
                    <p className="font-medium">
                      Required Action: Contact your accountant to receive your
                      start-of-day float allocation.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Float Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-700">
              Current Float Balance
            </span>
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {userFloat ? formatCurrency(userFloat.balance) : formatCurrency(0)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {userFloat ? (
              <>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  LIVE
                </span>
                <span className="text-xs text-blue-600">
                  Updates with transactions
                </span>
              </>
            ) : (
              <span className="text-xs text-blue-600">No float assigned</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Opening Balance</span>
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(dayActivity.openingBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {userFloat?.currentDayStarted
              ? "Start of day amount"
              : "No active day"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Deposits</span>
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-green-700">
            +{formatCurrency(cashActivity?.totalDeposits ?? dayActivity.totalDeposits)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(cashActivity?.totalDeposits ?? 0) > 0
              ? `From ${cashActivity?.depositCount ?? 0} customer deposits`
              : "No transactions yet"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Withdrawals</span>
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8V4m0 0L13 8m4-4l4 4m-6 0v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-red-700">
            -{formatCurrency(cashActivity?.totalWithdrawals ?? dayActivity.totalWithdrawals)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(cashActivity?.totalWithdrawals ?? 0) > 0
              ? `Across ${cashActivity?.withdrawalCount ?? 0} customer withdrawals`
              : "No withdrawals yet"}
          </p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Transactions
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {floatTransactions.length > 0
              ? `Showing ${Math.min(10, floatTransactions.length)} most recent transactions`
              : userFloat
                ? "No transactions recorded yet"
                : "No float assigned - transactions will appear here once you have an active float"}
          </p>
        </div>
        <div className="overflow-x-auto">
          {floatTransactions.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance After
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {floatTransactions.slice(0, 10).map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTransactionTypeColor(transaction.type)}`}
                      >
                        {transaction.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {transaction.description || "—"}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        transaction.amount >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.amount >= 0 ? "+" : ""}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                      {formatCurrency(transaction.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                No Transactions Yet
              </h4>
              <p className="text-sm text-gray-500 text-center max-w-md">
                {userFloat
                  ? "Your transaction history will appear here once you start processing deposits, withdrawals, or other float activities."
                  : "You need an assigned float to start processing transactions. Contact your accountant to get a float assigned."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reconciliation History */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Reconciliation History
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {floatReconciliations.length > 0
              ? `${floatReconciliations.length} reconciliation${floatReconciliations.length === 1 ? "" : "s"} on record`
              : userFloat
                ? "No reconciliations submitted yet"
                : "No float assigned - reconciliation history will appear here"}
          </p>
        </div>
        <div className="overflow-x-auto">
          {floatReconciliations.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    For Day
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviewed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {floatReconciliations.map((reconciliation) => {
                  const variance =
                    reconciliation.actualBalance -
                    reconciliation.expectedBalance;
                  const hasVariance = Math.abs(variance) > 0.01;

                  return (
                    <tr
                      key={reconciliation.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(reconciliation.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(reconciliation.reconciliationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(reconciliation.expectedBalance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(reconciliation.actualBalance)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                          hasVariance
                            ? variance > 0
                              ? "text-green-600"
                              : "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {hasVariance ? (
                          <>
                            {variance > 0 ? "+" : ""}
                            {formatCurrency(variance)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getReconciliationStatusColor(reconciliation.status)}`}
                        >
                          {reconciliation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {reconciliation.reviewedBy?.name || "—"}
                        {reconciliation.reviewedAt && (
                          <div className="text-xs text-gray-500">
                            {formatDate(reconciliation.reviewedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h.01M9 16h.01M13 12h2m-2 4h2"
                />
              </svg>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                No Reconciliations Yet
              </h4>
              <p className="text-sm text-gray-500 text-center max-w-md">
                {userFloat
                  ? "Your end-of-day reconciliation history will appear here after you submit your first reconciliation."
                  : "You need an assigned float to perform reconciliations. Contact your accountant to get started."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* End of Day Modal */}
      {showEndOfDayModal && userFloat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <EndOfDayReconciliationForm
              floatId={userFloat.id}
              userId={currentUser.id}
              expectedBalance={dayActivity.expectedBalance}
              openingBalance={dayActivity.openingBalance}
              totalDeposits={dayActivity.totalDeposits}
              totalWithdrawals={dayActivity.totalWithdrawals}
              currentBalance={userFloat.balance}
              onSuccess={handleReconciliationSuccess}
              onClose={() => setShowEndOfDayModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
