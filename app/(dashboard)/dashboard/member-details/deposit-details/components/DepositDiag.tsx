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
  Plus,
} from "lucide-react";

interface AddDepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

const AddDepositDialog: React.FC<AddDepositDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [depositType, setDepositType] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    toAccountId: "",
    fromBankAccountId: "",
    amount: "",
    mobileNumber: "",
    mobileProvider: "",
    reference: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (depositType === "bank_transfer") {
      fetchBankAccounts();
    }
  }, [depositType]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/accounts/my-accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setErrors({ fetch: "Failed to load accounts" });
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.toAccountId) {
      newErrors.toAccountId = "Please select a destination account";
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if (depositType === "mobile_money") {
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

    if (depositType === "bank_transfer") {
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
      const payload: any = {
        toAccountId: formData.toAccountId,
        amount: parseFloat(formData.amount),
        channel: depositType === "mobile_money" ? "MOBILE_MONEY" : "BANK_TRANSFER",
        depositType,
        reference: formData.reference,
      };

      if (depositType === "mobile_money") {
        payload.mobileMoneyRef = formData.mobileNumber;
        payload.mobileProvider = formData.mobileProvider;
      } else if (depositType === "bank_transfer") {
        payload.fromBankAccountId = formData.fromBankAccountId;
      }

      const response = await fetch("/api/v1/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create deposit");
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
    setDepositType("");
    setFormData({
      toAccountId: "",
      fromBankAccountId: "",
      amount: "",
      mobileNumber: "",
      mobileProvider: "",
      reference: "",
    });
    setErrors({});
    onClose();
  };

  const handleTypeSelect = (type: string) => {
    setDepositType(type);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setDepositType("");
    setFormData({
      ...formData,
      mobileNumber: "",
      mobileProvider: "",
      fromBankAccountId: "",
    });
    setErrors({});
  };

  const selectedToAccount = accounts.find(
    (acc) => acc.id === formData.toAccountId
  );

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
            <h2 className="text-2xl font-bold text-gray-900">Add Deposit</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1
                ? "Choose deposit method"
                : `Via ${depositType === "mobile_money" ? "Mobile Money" : "Bank Transfer"}`}
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
              <p className="text-gray-600 mb-6">
                Select how you want to deposit money:
              </p>

              <button
                onClick={() => handleTypeSelect("mobile_money")}
                className="w-full group"
              >
                <div className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                    <Smartphone className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      Mobile Money
                    </h3>
                    <p className="text-sm text-gray-600">
                      Deposit via MTN or Airtel Money
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </div>
              </button>

              <button
                onClick={() => handleTypeSelect("bank_transfer")}
                className="w-full group"
              >
                <div className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
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
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-500" />
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Wallet className="w-4 h-4 inline mr-1" />
                  Deposit To Account *
                </label>
                <select
                  value={formData.toAccountId}
                  onChange={(e) =>
                    setFormData({ ...formData, toAccountId: e.target.value })
                  }
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
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

              {selectedToAccount && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Current Balance:
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      UGX {selectedToAccount.balance?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              )}

              {depositType === "mobile_money" && (
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

              {depositType === "bank_transfer" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    Transfer From Bank Account *
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Available Balance:
                    </span>
                    <span className="text-xl font-bold text-green-600">
                      UGX{" "}
                      {selectedFromBankAccount.balance?.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (UGX) *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="Enter amount"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg font-semibold ${
                    errors.amount ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.amount}
                  </p>
                )}
              </div>

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
                  placeholder="Transaction reference or note"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {errors.submit && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{errors.submit}</span>
                  </div>
                </div>
              )}

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
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    depositType === "mobile_money"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit Deposit
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

export default AddDepositDialog;
