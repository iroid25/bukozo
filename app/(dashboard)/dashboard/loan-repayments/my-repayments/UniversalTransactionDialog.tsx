// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Building2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  Wallet,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  DollarSign,
  Target,
} from "lucide-react";

type TransactionType = "deposit" | "withdrawal" | "transfer" | "repayment";

interface UniversalTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  transactionType: TransactionType;
}

const UniversalTransactionDialog: React.FC<UniversalTransactionDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  transactionType,
}) => {
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    accountId: "",
    toAccountId: "",
    loanId: "",
    fromBankAccountId: "",
    amount: "",
    mobileNumber: "",
    mobileProvider: "",
    reference: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = {
    deposit: {
      title: "Add Deposit",
      color: "green",
      icon: <ArrowDownRight className="w-6 h-6" />,
      endpoint: "/api/v1/deposits", // Unified endpoint
    },
    withdrawal: {
      title: "Make Withdrawal",
      color: "red",
      icon: <ArrowUpRight className="w-6 h-6" />,
      endpoint: "/api/v1/transactions/withdrawals",
    },
    transfer: {
      title: "Transfer Money",
      color: "blue",
      icon: <ArrowRight className="w-6 h-6" />,
      endpoint: "/api/v1/transactions/transfers",
    },
    repayment: {
      title: "Make Loan Repayment",
      color: "orange",
      icon: <Target className="w-6 h-6" />,
      endpoint: "/api/v1/loans/repayments",
    },
  }[transactionType];

  const colorClasses = {
    green: {
      button:
        "from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700",
      mobileBg: "from-blue-500 to-blue-600",
      mobileHover:
        "hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-500",
      bankBg: "from-green-500 to-green-600",
      bankHover:
        "hover:border-green-500 hover:bg-green-50 group-hover:text-green-500",
      badge: "from-blue-50 to-indigo-50 border-blue-200 text-blue-600",
      bankBadge: "from-green-50 to-emerald-50 border-green-200 text-green-600",
    },
    red: {
      button: "from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700",
      mobileBg: "from-blue-500 to-blue-600",
      mobileHover:
        "hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-500",
      bankBg: "from-purple-500 to-purple-600",
      bankHover:
        "hover:border-purple-500 hover:bg-purple-50 group-hover:text-purple-500",
      badge: "from-blue-50 to-indigo-50 border-blue-200 text-blue-600",
      bankBadge:
        "from-purple-50 to-indigo-50 border-purple-200 text-purple-600",
    },
    blue: {
      button:
        "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
      mobileBg: "from-blue-500 to-blue-600",
      mobileHover:
        "hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-500",
      bankBg: "from-indigo-500 to-indigo-600",
      bankHover:
        "hover:border-indigo-500 hover:bg-indigo-50 group-hover:text-indigo-500",
      badge: "from-blue-50 to-indigo-50 border-blue-200 text-blue-600",
      bankBadge:
        "from-indigo-50 to-purple-50 border-indigo-200 text-indigo-600",
    },
    orange: {
      button:
        "from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700",
      mobileBg: "from-blue-500 to-blue-600",
      mobileHover:
        "hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-500",
      bankBg: "from-green-500 to-green-600",
      bankHover:
        "hover:border-green-500 hover:bg-green-50 group-hover:text-green-500",
      badge: "from-orange-50 to-red-50 border-orange-200 text-orange-600",
      bankBadge: "from-green-50 to-emerald-50 border-green-200 text-green-600",
    },
  }[config.color];

  useEffect(() => {
    if (isOpen) {
      if (transactionType === "repayment") {
        fetchLoans();
      } else {
        fetchAccounts();
      }
    }
  }, [isOpen, transactionType]);

  useEffect(() => {
    if (paymentMethod === "bank_transfer") {
      fetchBankAccounts();
    }
  }, [paymentMethod]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/accounts/my-account");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setAccounts(data.data?.accounts || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setErrors({ fetch: "Failed to load accounts" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/loans/my-loans");
      if (!response.ok) throw new Error("Failed to fetch loans");
      const data = await response.json();

      // Filter only active loans with outstanding balance
      const activeLoans = (data.data || []).filter(
        (loan: any) =>
          loan.status === "DISBURSED" && loan.outstandingBalance > 0
      );

      setLoans(activeLoans);
    } catch (err) {
      console.error("Error fetching loans:", err);
      setErrors({ fetch: "Failed to load loans" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/bank-accounts");
      if (!response.ok) throw new Error("Failed to fetch bank accounts");
      const data = await response.json();
      setBankAccounts(data.bankAccounts || []);
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
      setErrors({ fetch: "Failed to load bank accounts" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate based on transaction type
    if (transactionType === "repayment") {
      if (!formData.loanId) {
        newErrors.loanId = "Please select a loan";
      }

      const selectedLoan = loans.find((l) => l.id === formData.loanId);
      if (
        selectedLoan &&
        parseFloat(formData.amount) > selectedLoan.outstandingBalance
      ) {
        newErrors.amount = `Amount cannot exceed outstanding balance (${formatCurrency(selectedLoan.outstandingBalance)})`;
      }
    } else if (transactionType === "transfer") {
      if (!formData.accountId) {
        newErrors.accountId = "Please select source account";
      }
      if (!formData.toAccountId) {
        newErrors.toAccountId = "Please select destination account";
      }
      if (formData.accountId === formData.toAccountId) {
        newErrors.toAccountId = "Cannot transfer to the same account";
      }
    } else {
      // Deposit or Withdrawal
      if (!formData.accountId) {
        newErrors.accountId = "Please select an account";
      }
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if (paymentMethod === "mobile_money") {
      if (!formData.mobileNumber) {
        newErrors.mobileNumber = "Mobile number is required";
      } else {
        const mobileRegex = /^0[7][0-9]{8}$/;
        if (!mobileRegex.test(formData.mobileNumber)) {
          newErrors.mobileNumber = "Invalid format (e.g., 0700123456)";
        }
      }

      if (!formData.mobileProvider) {
        newErrors.mobileProvider = "Please select a mobile money provider";
      }
    }

    if (paymentMethod === "bank_transfer") {
      if (!formData.fromBankAccountId) {
        newErrors.fromBankAccountId = "Please select a source bank account";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors({});

    try {
      // Mobile Money is now handled by the standard transaction flow (STK Push)

      const payload: any = {
        amount: parseFloat(formData.amount),
        paymentMethod,
        channel: paymentMethod === "mobile_money" ? "MOBILE_MONEY" : "BANK_TRANSFER",
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      if (paymentMethod === "mobile_money") {
        payload.mobileMoneyRef = formData.mobileNumber;
        payload.mobileProvider = formData.mobileProvider;
      }

      // Add fields based on transaction type
      if (transactionType === "repayment") {
        payload.loanId = formData.loanId;
      } else if (transactionType === "transfer") {
        payload.fromAccountId = formData.accountId;
        payload.toAccountId = formData.toAccountId;
      } else {
        payload.accountId = formData.accountId;
      }

      // Add payment method details
      if (paymentMethod === "bank_transfer") {
        payload.fromBankAccountId = formData.fromBankAccountId;
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to process ${transactionType}`
        );
      }

      const result = await response.json();

      if (onSuccess) {
        onSuccess(result);
      }
      handleClose();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setPaymentMethod("");
    setFormData({
      accountId: "",
      toAccountId: "",
      loanId: "",
      fromBankAccountId: "",
      amount: "",
      mobileNumber: "",
      mobileProvider: "",
      reference: "",
      notes: "",
    });
    setErrors({});
    onClose();
  };

  const handleMethodSelect = (method: string) => {
    setPaymentMethod(method);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setPaymentMethod("");
    setFormData({
      ...formData,
      mobileNumber: "",
      mobileProvider: "",
      fromBankAccountId: "",
    });
    setErrors({});
  };

  const selectedAccount = accounts.find((acc) => acc.id === formData.accountId);
  const selectedToAccount = accounts.find(
    (acc) => acc.id === formData.toAccountId
  );
  const selectedLoan = loans.find((l) => l.id === formData.loanId);
  const selectedFromBankAccount = bankAccounts.find(
    (acc) => acc.id === formData.fromBankAccountId
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{config.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1
                ? "Choose payment method"
                : `Via ${paymentMethod === "mobile_money" ? "Mobile Money" : "Bank Transfer"}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && step === 1 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">Select payment method:</p>

              <button
                onClick={() => handleMethodSelect("mobile_money")}
                className="w-full group"
              >
                <div
                  className={`flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl ${colorClasses.mobileHover} transition-all`}
                >
                  <div
                    className={`bg-gradient-to-br ${colorClasses.mobileBg} p-4 rounded-xl group-hover:scale-110 transition-transform`}
                  >
                    <Smartphone className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      Mobile Money
                    </h3>
                    <p className="text-sm text-gray-600">
                      Pay via MTN or Airtel Money
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect("bank_transfer")}
                className="w-full group"
              >
                <div
                  className={`flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl ${colorClasses.bankHover} transition-all`}
                >
                  <div
                    className={`bg-gradient-to-br ${colorClasses.bankBg} p-4 rounded-xl group-hover:scale-110 transition-transform`}
                  >
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      Bank Transfer
                    </h3>
                    <p className="text-sm text-gray-600">
                      Transfer from your bank account
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Loan Selection (for repayments) */}
              {transactionType === "repayment" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Wallet className="w-4 h-4 inline mr-1" />
                    Select Loan *
                  </label>
                  <select
                    value={formData.loanId}
                    onChange={(e) =>
                      setFormData({ ...formData, loanId: e.target.value })
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-${config.color}-500 focus:border-transparent transition-all ${
                      errors.loanId ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    <option value="">Choose a loan to repay</option>
                    {loans.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        Loan #{loan.loanNumber} - Outstanding:{" "}
                        {formatCurrency(loan.outstandingBalance)}
                      </option>
                    ))}
                  </select>
                  {errors.loanId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.loanId}
                    </p>
                  )}
                </div>
              )}

              {/* Loan Details Card (for repayments) */}
              {selectedLoan && (
                <div
                  className={`bg-gradient-to-r ${colorClasses.badge} p-4 rounded-lg border space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Loan Amount:
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedLoan.loanAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Outstanding:
                    </span>
                    <span className="text-xl font-bold text-red-600">
                      {formatCurrency(selectedLoan.outstandingBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Amount Paid:
                    </span>
                    <span className="text-lg font-semibold text-green-600">
                      {formatCurrency(selectedLoan.amountPaid || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium text-gray-700">
                      Interest Rate:
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedLoan.interestRate}% p.a.
                    </span>
                  </div>
                </div>
              )}

              {/* Account Selection (for non-repayments) */}
              {transactionType !== "repayment" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Wallet className="w-4 h-4 inline mr-1" />
                    {transactionType === "transfer"
                      ? "From Account *"
                      : "Select Account *"}
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) =>
                      setFormData({ ...formData, accountId: e.target.value })
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-${config.color}-500 focus:border-transparent transition-all ${
                      errors.accountId ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountNumber} - {account.accountType} (UGX{" "}
                        {account.balance?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.accountId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.accountId}
                    </p>
                  )}
                </div>
              )}

              {/* To Account (for transfers) */}
              {transactionType === "transfer" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Wallet className="w-4 h-4 inline mr-1" />
                    To Account *
                  </label>
                  <select
                    value={formData.toAccountId}
                    onChange={(e) =>
                      setFormData({ ...formData, toAccountId: e.target.value })
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-${config.color}-500 focus:border-transparent transition-all ${
                      errors.toAccountId ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    <option value="">Select destination account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountNumber} - {account.accountType} (UGX{" "}
                        {account.balance?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.toAccountId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.toAccountId}
                    </p>
                  )}
                </div>
              )}

              {/* Account Balance Display */}
              {selectedAccount && transactionType !== "transfer" && (
                <div
                  className={`bg-gradient-to-r ${colorClasses.badge} p-4 rounded-lg border`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Current Balance:
                    </span>
                    <span className="text-xl font-bold">
                      UGX {selectedAccount.balance?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              )}

              {/* Mobile Money Fields */}
              {paymentMethod === "mobile_money" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mobile Money Provider *
                    </label>
                    <select
                      value={formData.mobileProvider}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobileProvider: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.mobileProvider
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select provider</option>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                    {errors.mobileProvider && (
                      <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.mobileProvider}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      value={formData.mobileNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobileNumber: e.target.value,
                        })
                      }
                      placeholder="0700123456"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.mobileNumber
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {errors.mobileNumber && (
                      <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.mobileNumber}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Bank Transfer Fields */}
              {paymentMethod === "bank_transfer" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    {transactionType === "deposit"
                      ? "Transfer From "
                      : "Pay From "}
                    Bank Account *
                  </label>
                  <select
                    value={formData.fromBankAccountId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fromBankAccountId: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                      errors.fromBankAccountId
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select source bank account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber} (UGX{" "}
                        {account.balance?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.fromBankAccountId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.fromBankAccountId}
                    </p>
                  )}
                </div>
              )}

              {selectedFromBankAccount && (
                <div
                  className={`bg-gradient-to-r ${colorClasses.bankBadge} p-4 rounded-lg border`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Available Balance:
                    </span>
                    <span className="text-xl font-bold">
                      UGX{" "}
                      {selectedFromBankAccount.balance?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Amount (UGX) *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="Enter amount"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-${config.color}-500 focus:border-transparent transition-all text-lg font-semibold ${
                    errors.amount ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.amount}
                  </p>
                )}
                {/* Remaining balance for repayments */}
                {selectedLoan && formData.amount && (
                  <p className="text-sm text-gray-600 mt-2">
                    Remaining after payment:{" "}
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(
                        Math.max(
                          0,
                          selectedLoan.outstandingBalance -
                            parseFloat(formData.amount)
                        )
                      )}
                    </span>
                  </p>
                )}
              </div>

              {/* Reference Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData({ ...formData, reference: e.target.value })
                  }
                  placeholder="Transaction reference"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Notes Field (for repayments) */}
              {transactionType === "repayment" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Add any additional notes..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              )}

              {/* Error Message */}
              {errors.submit && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{errors.submit}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`flex-1 px-6 py-3 bg-gradient-to-r ${colorClasses.button} rounded-lg font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit{" "}
                      {transactionType === "repayment"
                        ? "Payment"
                        : config.title.split(" ")[1]}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UniversalTransactionDialog;
