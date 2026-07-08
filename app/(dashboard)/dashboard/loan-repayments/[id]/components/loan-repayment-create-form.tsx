// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DollarSign,
  User,
  CreditCard,
  Calculator,
  CheckCircle,
  AlertCircle,
  Search,
  Smartphone,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import TextInput from "@/components/FormInputs/TextInput";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import {
  type LoanRepaymentCreateDTO,
  calculateRepaymentImpact,
  getPaymentChannelOptions,
} from "@/types/loanRepayment";
import { toast } from "sonner";

import axios from "axios";
import { formatISODate } from "@/lib/utils";

interface ActiveLoan {
  id: string;
  amountGranted: number;
  totalAmountDue: number;
  outstandingBalance: number;
  dueDate: Date;
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
      image: string | null;
    };
  };
  loanApplication: {
    loanProduct: {
      name: string;
      interestRate: number;
    };
  };
  repayments: Array<{
    id: string;
    amount: number;
    repaymentDate: Date;
  }>;
}

type Option = {
  label: string;
  value: string;
};

export default function LoanRepaymentCreateForm({
  isOpen,
  onClose,
  currentUserId,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoanRepaymentCreateDTO>();

  const [loading, setLoading] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loanSearchOpen, setLoanSearchOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Option | null>(null);

  const router = useRouter();
  const watchedValues = watch();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen]);

  const loadFormData = async () => {
    try {
      const response = await axios.get("/api/v1/loans/active");
      setActiveLoans(response.data);
    } catch (error) {
      console.error("Error loading form data:", error);
      toast.error("Failed to load form data");
    }
  };

  // Payment channel options
  const channelOptions = getPaymentChannelOptions();

  // Calculate repayment impact
  const getRepaymentImpact = () => {
    if (!selectedLoan || !watchedValues.amount) return null;

    const amount = Number(watchedValues.amount);
    if (amount <= 0) return null;

    return calculateRepaymentImpact(amount, selectedLoan.outstandingBalance);
  };

  // Check if loan is overdue
  const isLoanOverdue = (dueDate: Date) => {
    return new Date() > new Date(dueDate);
  };

    async function saveRepayment(data: LoanRepaymentCreateDTO) {
    try {
      setLoading(true);

      if (!selectedLoan || !selectedChannel) {
        toast.error("Please select both loan and payment channel");
        return;
      }

      const payload = {
        loanId: selectedLoan.id,
        amount: Number(data.amount),
        paymentMethod: selectedChannel.value,
        transactionReference:
          selectedChannel.value === "Mobile Money"
            ? data.mobileMoneyRef?.trim()
            : `REC-${Date.now().toString().slice(-6)}`,
        notes: `Loan repayment for ${selectedLoan.member.user.name}`,
      };

      const response = await axios.post("/api/v1/loans/repayments", payload);

      if (!response.data.id) {
        toast.error("Failed to Record Payment", {
          description: response.data.error || "Unknown error occurred",
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success("Payment Recorded Successfully!", {
        description: `Payment of ${formatCurrency(
          payload.amount
        )} recorded for ${selectedLoan.member.user.name}`,
      });

      // Reset form
      reset();
      setSelectedLoan(null);
      setSelectedChannel(null);
      onClose();

      // Redirect to repayment details
      if (response.data) {
        setTimeout(() => {
          router.push(`/dashboard/loan-repayments/${response.data.id}`);
        }, 1000);
      }
    } catch (error: any) {
      toast.error("Something went wrong", {
        description: error.response?.data?.error || "Failed to record payment",
      });
      setLoading(false);
      console.error(error);
    }
  }

  const handleReset = () => {
    reset();
    setSelectedLoan(null);
    setSelectedChannel(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Loan Repayment
          </DialogTitle>
          <DialogDescription>
            Record a loan repayment for a SACCO member. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(saveRepayment)}>
          <div className="space-y-8">
            {/* Loan Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Select Active Loan
                </h3>
              </div>

              <div className="space-y-3">
                <Label>Active Loan *</Label>
                <Popover open={loanSearchOpen} onOpenChange={setLoanSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={loanSearchOpen}
                      className="w-full justify-between h-16 px-4 text-left bg-transparent"
                    >
                      {selectedLoan ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            {selectedLoan.member.user.image ? (
                              <img
                                src={selectedLoan.member.user.image}
                                alt={selectedLoan.member.user.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {selectedLoan.member.user.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {selectedLoan.loanApplication.loanProduct.name} •
                              Outstanding:{" "}
                              {formatCurrency(selectedLoan.outstandingBalance)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Search className="h-4 w-4" />
                          <span>Search and select an active loan...</span>
                        </div>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[800px] p-0">
                    <Command className="w-full">
                      <CommandInput
                        placeholder="Search loans by member name, number, or loan product..."
                        className="h-12 text-base"
                      />
                      <CommandEmpty>No active loans found.</CommandEmpty>
                      <CommandGroup className="max-h-80 overflow-y-auto">
                        {activeLoans.map((loan) => (
                          <CommandItem
                            key={loan.id}
                            onSelect={() => {
                              setSelectedLoan(loan);
                              setValue("loanId", loan.id);
                              setLoanSearchOpen(false);
                            }}
                            className="p-4 cursor-pointer hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-4 w-full">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                {loan.member.user.image ? (
                                  <img
                                    src={loan.member.user.image}
                                    alt={loan.member.user.name}
                                    className="h-12 w-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6" />
                                )}
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-lg truncate">
                                    {loan.member.user.name}
                                  </span>
                                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    <span className="text-sm font-medium text-red-600">
                                      {formatCurrency(loan.outstandingBalance)}
                                    </span>
                                    {isLoanOverdue(loan.dueDate) && (
                                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                        OVERDUE
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                  <span className="font-mono">
                                    #{loan.member.memberNumber}
                                  </span>
                                  <span>•</span>
                                  <span className="truncate">
                                    {loan.loanApplication.loanProduct.name}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Due: {formatISODate(loan.dueDate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedLoan && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">
                        Loan Details
                      </h4>
                      <p className="text-blue-700">
                        Product: {selectedLoan.loanApplication.loanProduct.name}
                      </p>
                      <p className="text-blue-700">
                        Amount Granted:{" "}
                        {formatCurrency(selectedLoan.amountGranted)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">
                        Outstanding
                      </h4>
                      <p className="text-blue-700 text-lg font-bold">
                        {formatCurrency(selectedLoan.outstandingBalance)}
                      </p>
                      <p className="text-blue-600 text-xs">
                        Total Due: {formatCurrency(selectedLoan.totalAmountDue)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">
                        Due Date
                      </h4>
                      <p
                        className={`${
                          isLoanOverdue(selectedLoan.dueDate)
                            ? "text-red-700"
                            : "text-blue-700"
                        }`}
                      >
                        {formatISODate(selectedLoan.dueDate)}
                      </p>
                      {isLoanOverdue(selectedLoan.dueDate) && (
                        <p className="text-red-600 text-xs font-medium">
                          OVERDUE
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedLoan.repayments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <h4 className="font-medium text-blue-900 mb-1">
                        Last Payment
                      </h4>
                      <p className="text-blue-700 text-sm">
                        {formatCurrency(selectedLoan.repayments[0].amount)} on{" "}
                        {formatISODate(
                          selectedLoan.repayments[0].repaymentDate
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Details */}
            {selectedLoan && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Payment Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Payment Amount *"
                    name="amount"
                    type="number"
                    icon={DollarSign}
                    placeholder="Enter payment amount"
                  />

                  <FormSelectInput
                    label="Payment Channel *"
                    options={channelOptions}
                    option={selectedChannel as Option}
                    setOption={setSelectedChannel}
                  />
                </div>

                {selectedChannel?.value === "Mobile Money" && (
                  <div className="grid grid-cols-1 gap-4">
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Mobile Money Reference *"
                      name="mobileMoneyRef"
                      icon={Smartphone}
                      placeholder="Enter mobile money transaction reference"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Payment Impact Preview */}
            {getRepaymentImpact() && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Calculator className="h-4 w-4 text-orange-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Payment Impact
                  </h3>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-green-50 p-6 rounded-lg border">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-600">Payment Amount:</span>
                      <p className="font-medium text-lg text-green-600">
                        {formatCurrency(Number(watchedValues.amount) || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">
                        Current Outstanding:
                      </span>
                      <p className="font-medium text-lg text-red-600">
                        {formatCurrency(selectedLoan?.outstandingBalance || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">New Balance:</span>
                      <p className="font-medium text-lg text-blue-600">
                        {formatCurrency(getRepaymentImpact()!.newBalance)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">Progress:</span>
                      <p className="font-medium text-lg text-purple-600">
                        {getRepaymentImpact()!.percentagePaid.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {getRepaymentImpact()!.isFullyPaid && (
                    <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        This payment will fully settle the loan!
                      </p>
                    </div>
                  )}

                  {getRepaymentImpact()!.overpayment > 0 && (
                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">Overpayment Alert:</p>
                        <p>
                          This payment exceeds the outstanding balance by{" "}
                          {formatCurrency(getRepaymentImpact()!.overpayment)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Summary */}
            {selectedLoan && selectedChannel && watchedValues.amount && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Payment Summary
                  </h3>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-green-50 p-6 rounded-lg border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Member:</span>
                        <span className="font-medium">
                          {selectedLoan.member.user.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Member Number:</span>
                        <span className="font-medium">
                          #{selectedLoan.member.memberNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loan Product:</span>
                        <span className="font-medium">
                          {selectedLoan.loanApplication.loanProduct.name}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Amount:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(Number(watchedValues.amount) || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Channel:</span>
                        <span className="font-medium">
                          {selectedChannel.label}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Outstanding Balance:
                        </span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(selectedLoan.outstandingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedChannel?.value === "Mobile Money" &&
                    watchedValues.mobileMoneyRef && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <span className="text-gray-600 text-sm">
                          Mobile Money Reference:
                        </span>
                        <p className="mt-1 text-sm text-gray-800 font-mono">
                          {watchedValues.mobileMoneyRef}
                        </p>
                      </div>
                    )}
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
                title="Record Payment"
                loading={loading}
                disabled={
                  !selectedLoan ||
                  !selectedChannel ||
                  !watchedValues.amount ||
                  (selectedChannel?.value === "Mobile Money" &&
                    !watchedValues.mobileMoneyRef)
                }
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
