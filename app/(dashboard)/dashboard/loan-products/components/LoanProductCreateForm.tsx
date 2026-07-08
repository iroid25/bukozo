// @ts-nocheck
"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  CreditCard,
  DollarSign,
  Percent,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";

import { LoanProductCreateDTO, LoanProduct } from "@/types/loanProduct";
import {
  getRepaymentPeriodDisplay,
  getRepaymentPeriodOptions,
} from "@/types/loanProduct";

// Validation schema matching your server-side schema
const loanProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  minAmount: z.coerce.number().min(0, "Minimum amount must be positive"),
  maxAmount: z.coerce.number().min(0, "Maximum amount must be positive"),
  interestRate: z.coerce
    .number()
    .min(0, "Interest rate must be positive")
    .max(100, "Interest rate cannot exceed 100%"), // This validation runs on the monthly input before conversion
  repaymentPeriodDays: z.coerce
    .number()
    .int()
    .min(1, "Repayment period must be at least 1 day"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).default("FLAT_RATE"),
  ledgerAccountId: z.string().min(1, "Ledger Account (Principal) is required"),
  interestAccountId: z.string().min(1, "Interest Account is required"),
  penaltyAccountId: z.string().optional().nullable(),
  feeAccountId: z.string().optional().nullable(),
  interestPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

type LoanProductFormData = z.infer<typeof loanProductSchema>;

interface LoanProductCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
}

// Get predefined repayment period options from types
const REPAYMENT_PERIOD_OPTIONS = getRepaymentPeriodOptions();

export default function LoanProductCreateForm({
  isOpen,
  onClose,
}: LoanProductCreateFormProps) {
  const STANDARD_LEDGER_ACCOUNT_CODES = ["107000"] as const;
  const STANDARD_LEDGER_ACCOUNT_NAME = "Loans";
  const STANDARD_INTEREST_ACCOUNT_CODE = "401001";
  const STANDARD_INTEREST_ACCOUNT_NAME = "Interest paid";
  const STANDARD_FEE_ACCOUNT_CODE = "401002";
  const STANDARD_FEE_ACCOUNT_NAME = "Loan processing fees";
  const STANDARD_PENALTY_ACCOUNT_CODE = "401005";
  const STANDARD_PENALTY_ACCOUNT_NAME = "Loan penalty paid";
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [assetClassifications, setAssetClassifications] = useState<any[]>([]);
  const [incomeItems, setIncomeItems] = useState<any[]>([]);
  const [selectedRepaymentPeriod, setSelectedRepaymentPeriod] = useState<
    number | null
  >(null);
  const [customRepaymentPeriod, setCustomRepaymentPeriod] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);

  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoanProductFormData>({
    resolver: zodResolver(loanProductSchema),
    defaultValues: {
      isActive: true,
      interestType: "FLAT_RATE",
      interestPeriod: "MONTHLY",
    },
  });

  // Fetch setup data
  React.useEffect(() => {
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
    if (isOpen) {
      fetchSetupData();
    }
  }, [isOpen]);

  const watchedValues = watch();
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

  const [selectedInterestType, setSelectedInterestType] = useState<{
    label: string;
    value: string;
  } | null>({ label: "Flat Rate", value: "FLAT_RATE" });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get repayment period display - use imported function from types
  const getRepaymentPeriodDisplayLocal = getRepaymentPeriodDisplay;

  // Calculate loan example
  const calculateLoanExample = () => {
    const amount = Number(watchedValues.minAmount) || 0;
    const rate = Number(watchedValues.interestRate) || 0;
    const period = watchedValues.interestPeriod || "MONTHLY";
    const annualRate = period === "MONTHLY" ? rate * 12 : rate;
    const days = selectedRepaymentPeriod || Number(customRepaymentPeriod) || 30;

    if (amount > 0 && rate > 0) {
      const interest = (amount * annualRate * days) / (365 * 100);
      const totalPayable = amount + interest;
      return {
        principal: amount,
        interest: interest,
        totalPayable: totalPayable,
        dailyPayment: totalPayable / days,
      };
    }
    return null;
  };

  const handleRepaymentPeriodChange = (days: number) => {
    setSelectedRepaymentPeriod(days);
    setValue("repaymentPeriodDays", days);
    setUseCustomPeriod(false);
    setCustomRepaymentPeriod("");
  };

  const handleCustomPeriodChange = (value: string) => {
    setCustomRepaymentPeriod(value);
    const days = Number(value);
    if (days > 0) {
      setValue("repaymentPeriodDays", days);
      setSelectedRepaymentPeriod(null);
    }
  };

  const handleFormSubmit = async (data: LoanProductFormData) => {
    try {
      setLoading(true);

      if (!standardLoanAssetClassification?.id) {
        toast.error("Principal account setup is incomplete", {
          description:
            "Loan account (107000) is missing or inactive.",
        });
        setLoading(false);
        return;
      }

      if (!standardInterestAccount?.id) {
        toast.error("Interest account setup is incomplete", {
          description:
            "Interest paid (401001) is missing from Chart of Accounts.",
        });
        setLoading(false);
        return;
      }

      if (!standardFeeAccount?.id) {
        toast.error("Fee account setup is incomplete", {
          description:
            "Loan processing fees (401002) is missing from Chart of Accounts.",
        });
        setLoading(false);
        return;
      }

      if (!standardPenaltyAccount?.id) {
        toast.error("Penalty account setup is incomplete", {
          description:
            "Loan penalty paid (401005) is missing from Chart of Accounts.",
        });
        setLoading(false);
        return;
      }

      // Validate that max amount is greater than min amount
      if (data.maxAmount <= data.minAmount) {
        toast.error("Validation Error", {
          description: "Maximum amount must be greater than minimum amount",
        });
        setLoading(false);
        return;
      }

      // Set repayment period from selected option or custom input
      const repaymentDays =
        selectedRepaymentPeriod || Number(customRepaymentPeriod);
      if (!repaymentDays || repaymentDays < 1) {
        toast.error("Validation Error", {
          description: "Please select or enter a valid repayment period",
        });
        setLoading(false);
        return;
      }

      // Create the loan product data object matching LoanProductCreateDTO
      const loanProductData: LoanProductCreateDTO = {
        name: data.name,
        minAmount: Number(data.minAmount),
        maxAmount: Number(data.maxAmount),
        interestRate: Number(data.interestRate), 
        interestPeriod: data.interestPeriod,
        repaymentPeriodDays: repaymentDays,
        description: data.description || "",
        isActive: data.isActive,
        interestType: (data.interestType as "FLAT_RATE" | "REDUCING_BALANCE") || "FLAT_RATE",
        ledgerAccountId: standardLoanAssetClassification.id,
        interestAccountId: standardInterestAccount.id,
        penaltyAccountId: standardPenaltyAccount.id,
        feeAccountId: standardFeeAccount.id,
      };

      // Call the API endpoint
      const response = await fetch("/api/v1/loan-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loanProductData),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to Create Loan Product", {
          description: result.error || "An unexpected error occurred",
        });
        return;
      }

      toast.success("Loan Product Created Successfully!", {
        description: `${data.name} has been created and is ${
          data.isActive ? "active" : "inactive"
        }`,
      });

      // Reset form
      handleReset();

      // Redirect to loan product details
      if (result.data?.id) {
        setTimeout(() => {
          router.push(`/dashboard/loan-products/${result.data.id}`);
        }, 1000);
      }
    } catch (error) {
      toast.error("Something went wrong");
      console.error("Error creating loan product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedRepaymentPeriod(null);
    setCustomRepaymentPeriod("");
    setUseCustomPeriod(false);
    onClose();
  };

  React.useEffect(() => {
    if (standardLoanAssetClassification?.id) {
      setValue("ledgerAccountId", standardLoanAssetClassification.id, {
        shouldValidate: false,
      });
      return;
    }

    setValue("ledgerAccountId", "", {
      shouldValidate: false,
    });
  }, [setValue, standardLoanAssetClassification?.id]);

  React.useEffect(() => {
    if (standardInterestAccount?.id) {
      setValue("interestAccountId", standardInterestAccount.id, {
        shouldValidate: false,
      });
      return;
    }

    setValue("interestAccountId", "", {
      shouldValidate: false,
    });
  }, [setValue, standardInterestAccount?.id]);

  React.useEffect(() => {
    if (standardFeeAccount?.id) {
      setValue("feeAccountId", standardFeeAccount.id, {
        shouldValidate: false,
      });
      return;
    }

    setValue("feeAccountId", null, {
      shouldValidate: false,
    });
  }, [setValue, standardFeeAccount?.id]);

  React.useEffect(() => {
    if (standardPenaltyAccount?.id) {
      setValue("penaltyAccountId", standardPenaltyAccount.id, {
        shouldValidate: false,
      });
      return;
    }

    setValue("penaltyAccountId", null, {
      shouldValidate: false,
    });
  }, [setValue, standardPenaltyAccount?.id]);

  const loanExample = calculateLoanExample();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Create New Loan Product
          </DialogTitle>
          <DialogDescription>
            Create a new loan product with specific terms and conditions for
            SACCO members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Basic Information
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Loan Product Name *"
                    name="name"
                    icon={CreditCard}
                    placeholder="e.g., Emergency Loan, Business Loan"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Brief description of the loan product, its purpose, and target members..."
                    className="mt-1"
                    rows={3}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Loan Amount Range */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <DollarSign className="h-4 w-4 text-green-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Loan Amount Range
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Minimum Amount *"
                  name="minAmount"
                  type="number"
                  icon={TrendingDown}
                  placeholder="e.g., 50000"
                />

                <TextInput
                  register={register}
                  errors={errors}
                  label="Maximum Amount *"
                  name="maxAmount"
                  type="number"
                  icon={TrendingUp}
                  placeholder="e.g., 5000000"
                />
              </div>

              {watchedValues.minAmount && watchedValues.maxAmount && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Loan Range:</span>
                    <span className="font-medium text-green-800">
                      {formatCurrency(Number(watchedValues.minAmount))} -{" "}
                      {formatCurrency(Number(watchedValues.maxAmount))}
                    </span>
                  </div>
                </div>
              )}

              {watchedValues.minAmount &&
                watchedValues.maxAmount &&
                Number(watchedValues.maxAmount) <=
                  Number(watchedValues.minAmount) && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-700">
                      Maximum amount must be greater than minimum amount
                    </p>
                  </div>
                )}
            </div>

            {/* Interest Rate & Repayment */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Percent className="h-4 w-4 text-purple-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Interest Rate & Repayment Terms
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      register={register}
                      errors={errors}
                      label={`Interest Rate (% per ${watchedValues.interestPeriod === "ANNUAL" ? "year" : "month"}) *`}
                      name="interestRate"
                      type="number"
                      icon={Percent}
                      placeholder="e.g., 2.5 or 30"
                    />
                    
                    <div className="space-y-2">
                        <Label>Interest Period *</Label>
                        <select
                            {...register("interestPeriod")}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="MONTHLY">Monthly (% p.m.)</option>
                            <option value="ANNUAL">Annual (% p.a.)</option>
                        </select>
                        <p className="text-xs text-gray-500">
                            Choose if the rate is per month or per annum.
                        </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Repayment Period *</Label>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {REPAYMENT_PERIOD_OPTIONS.slice(0, 6).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            handleRepaymentPeriodChange(option.value)
                          }
                          className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                            selectedRepaymentPeriod === option.value
                              ? "bg-purple-100 border-purple-300 text-purple-800"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={useCustomPeriod}
                        onCheckedChange={(checked) => {
                          setUseCustomPeriod(checked);
                          if (!checked) {
                            setCustomRepaymentPeriod("");
                            if (selectedRepaymentPeriod) {
                              setValue(
                                "repaymentPeriodDays",
                                selectedRepaymentPeriod
                              );
                            }
                          }
                        }}
                      />
                      <Label className="text-sm">Use custom period</Label>
                    </div>

                    {useCustomPeriod && (
                      <Input
                        type="number"
                        min="1"
                        placeholder="Enter days (e.g., 45)"
                        value={customRepaymentPeriod}
                        onChange={(e) =>
                          handleCustomPeriodChange(e.target.value)
                        }
                        className="w-full"
                      />
                    )}
                  </div>

                  {errors.repaymentPeriodDays && (
                    <p className="text-sm text-red-600">
                      {errors.repaymentPeriodDays.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Interest Type */}
             <div className="space-y-4">
               <div className="flex items-center gap-2 pb-2 border-b">
                 <Percent className="h-4 w-4 text-purple-600" />
                 <h3 className="text-lg font-medium text-gray-900">
                   Interest Calculation Method
                 </h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="md:col-span-2">
                   <Label>Interest Type</Label>
                   <div className="mt-2">
                     <select
                       {...register("interestType")}
                       className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                     >
                       <option value="FLAT_RATE">Flat Rate</option>
                       <option value="REDUCING_BALANCE">Reducing Balance</option>
                     </select>
                   </div>
                   <p className="text-xs text-gray-500 mt-1">
                     Select how interest will be calculated for this product.
                   </p>
                 </div>
               </div>
            </div>

            {/* Accounting Mappings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="h-4 w-4 text-indigo-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Accounting Mappings
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Principal / Ledger Account */}
                <div className="space-y-2">
                  <Label htmlFor="ledgerAccountId">Principal Account (Asset) *</Label>
                  <Input
                    id="ledgerAccountId"
                    value={
                      standardLoanAssetClassification
                        ? `${standardLoanAssetClassification.accountCode} - ${standardLoanAssetClassification.accountName}`
                        : `${STANDARD_LEDGER_ACCOUNT_CODES[0]} - ${STANDARD_LEDGER_ACCOUNT_NAME} not configured`
                    }
                    readOnly
                    disabled
                    className="bg-gray-50 text-gray-700"
                  />
                  <input type="hidden" {...register("ledgerAccountId")} />
                  <p className="text-xs text-gray-500">
                    Loan principal is posted to the standard loan asset account.
                  </p>
                  {errors.ledgerAccountId && (
                    <p className="text-xs text-red-600">{errors.ledgerAccountId.message}</p>
                  )}
                  {!standardLoanAssetClassification && (
                    <p className="text-xs text-red-600">
                      Create and activate the loan portfolio asset account before saving this product.
                    </p>
                  )}
                </div>

                {/* Interest Account */}
                <div className="space-y-2">
                  <Label htmlFor="interestAccountId">Interest Account (Income) *</Label>
                    <Input
                      id="interestAccountId"
                      value={
                        standardInterestAccount
                          ? `${standardInterestAccount.accountCode} - ${standardInterestAccount.accountName}`
                          : `${STANDARD_INTEREST_ACCOUNT_NAME} (${STANDARD_INTEREST_ACCOUNT_CODE}) not configured`
                      }
                    readOnly
                    disabled
                    className="bg-gray-50 text-gray-700"
                  />
                  <input type="hidden" {...register("interestAccountId")} />
                    <p className="text-xs text-gray-500">
                    Loan interest is posted to the standard Chart of Accounts item `401001 - Interest paid`.
                    </p>
                  {errors.interestAccountId && (
                    <p className="text-xs text-red-600">{errors.interestAccountId.message}</p>
                  )}
                  {!standardInterestAccount && (
                    <p className="text-xs text-red-600">
                      Create and activate `401001 - Interest paid` in the Chart of Accounts before saving this product.
                    </p>
                  )}
                </div>

                {/* Penalty Account */}
                <div className="space-y-2">
                  <Label htmlFor="penaltyAccountId">Penalty Account (Income)</Label>
                    <Input
                      id="penaltyAccountId"
                      value={
                        standardPenaltyAccount
                          ? `${standardPenaltyAccount.accountCode} - ${standardPenaltyAccount.accountName}`
                          : `${STANDARD_PENALTY_ACCOUNT_NAME} (${STANDARD_PENALTY_ACCOUNT_CODE}) not configured`
                      }
                    readOnly
                    disabled
                    className="bg-gray-50 text-gray-700"
                  />
                  <input type="hidden" {...register("penaltyAccountId")} />
                    <p className="text-xs text-gray-500">
                    Loan penalties are posted to the standard Chart of Accounts item `401005 - Loan penalty paid`.
                    </p>
                  {!standardPenaltyAccount && (
                    <p className="text-xs text-red-600">
                      Create and activate `401005 - Loan penalty paid` in the Chart of Accounts before saving this product.
                    </p>
                  )}
                </div>

                {/* Fee Account */}
                <div className="space-y-2">
                  <Label htmlFor="feeAccountId">Fee Account (Income)</Label>
                    <Input
                      id="feeAccountId"
                      value={
                        standardFeeAccount
                          ? `${standardFeeAccount.accountCode} - ${standardFeeAccount.accountName}`
                          : `${STANDARD_FEE_ACCOUNT_NAME} (${STANDARD_FEE_ACCOUNT_CODE}) not configured`
                      }
                    readOnly
                    disabled
                    className="bg-gray-50 text-gray-700"
                  />
                  <input type="hidden" {...register("feeAccountId")} />
                    <p className="text-xs text-gray-500">
                    Loan processing fees are posted to the standard Chart of Accounts item `401002 - Loan processing fees`.
                    </p>
                  {!standardFeeAccount && (
                    <p className="text-xs text-red-600">
                      Create and activate `401002 - Loan processing fees` in the Chart of Accounts before saving this product.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}

            {/* Loan Calculation Preview */}
            {loanExample && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Loan Calculation Preview
                  </h3>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-4">
                    Example: Minimum Loan Amount (
                    {formatCurrency(loanExample.principal)})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">Principal Amount</p>
                      <p className="font-semibold text-lg text-blue-700">
                        {formatCurrency(loanExample.principal)}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-gray-600">
                        Interest ({watchedValues.interestRate}% per {watchedValues.interestPeriod === "ANNUAL" ? "year" : "month"})
                      </p>
                      <p className="font-semibold text-lg text-green-700">
                        {formatCurrency(loanExample.interest)}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-gray-600">Total Payable</p>
                      <p className="font-semibold text-lg text-purple-700">
                        {formatCurrency(loanExample.totalPayable)}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-gray-600">
                        Daily Payment (
                        {getRepaymentPeriodDisplayLocal(
                          selectedRepaymentPeriod ||
                            Number(customRepaymentPeriod) ||
                            30
                        )}
                        )
                      </p>
                      <p className="font-semibold text-lg text-orange-700">
                        {formatCurrency(loanExample.dailyPayment)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
              >
                Cancel
              </Button>
              <SubmitButton
                title={
                  watchedValues.isActive
                    ? "Create & Activate"
                    : "Create (Inactive)"
                }
                loading={loading}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
