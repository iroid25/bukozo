"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Smartphone,
  User,
  CreditCard,
  DollarSign,
  Phone,
  CheckCircle,
  Search,
  AlertTriangle,
  Repeat,
  Calendar,
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

import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatISODate } from "@/lib/utils";
import { MobileMoneyLoanRepaymentCreateDTO } from "@/types/mobileMoney";

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
    image: string | null;
  };
  loans: Array<{
    id: string;
    amountGranted: number;
    outstandingBalance: number;
    dueDate: Date;
    loanApplication: {
      loanProduct: {
        name: string;
      };
    };
  }>;
}

interface Loan {
  id: string;
  amountGranted: number;
  outstandingBalance: number;
  amountPaid: number;
  dueDate: Date;
  disbursementDate: Date | null;
  loanApplication: {
    loanProduct: {
      name: string;
    };
  };
}

type Option = {
  label: string;
  value: string;
};

export default function MobileLoanRepaymentCreateForm({
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
  } = useForm<MobileMoneyLoanRepaymentCreateDTO>();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberLoans, setMemberLoans] = useState<Loan[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Option | null>(null);

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
      loadMembers();
    }
  }, [isOpen]);

  // Load member loans when member is selected
  useEffect(() => {
    if (selectedMember) {
      loadMemberLoans(selectedMember.id);
    }
  }, [selectedMember]);

  const loadMembers = async () => {
    try {
      const res = await fetch("/api/v1/members/with-active-loans");
      const json = await res.json();
      setMembers(json.data || json || []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members with active loans");
    }
  };

  const loadMemberLoans = async (memberId: string) => {
    try {
      const res = await fetch(`/api/v1/loans?memberId=${memberId}&status=DISBURSED`);
      const json = await res.json();
      setMemberLoans(json.data || json?.loans || json || []);
    } catch (error) {
      console.error("Error loading member loans:", error);
      toast.error("Failed to load member loans");
    }
  };

  // Create options for FormSelectInput
  const loanOptions: Option[] = memberLoans.map((loan) => ({
    label: `${loan.loanApplication.loanProduct.name} - Outstanding: ${formatCurrency(loan.outstandingBalance)}`,
    value: loan.id,
  }));

  // Get selected loan object
  const getSelectedLoan = () => {
    return memberLoans.find((loan) => loan.id === selectedLoan?.value) || null;
  };

  // Check if repayment is valid
  const isRepaymentValid = () => {
    const loan = getSelectedLoan();
    const amount = Number(watchedValues.amount) || 0;

    if (!loan || amount <= 0) return true; // Don't show warning if no data yet

    return amount <= loan.outstandingBalance;
  };

  const getRepaymentWarning = () => {
    const loan = getSelectedLoan();
    const amount = Number(watchedValues.amount) || 0;

    if (!loan || amount <= 0) return null;

    if (amount > loan.outstandingBalance) {
      return `Repayment amount cannot exceed outstanding balance of ${formatCurrency(loan.outstandingBalance)}`;
    }

    return null;
  };

  // Check if loan will be fully paid
  const willLoanBeFullyPaid = () => {
    const loan = getSelectedLoan();
    const amount = Number(watchedValues.amount) || 0;

    if (!loan || amount <= 0) return false;

    return amount >= loan.outstandingBalance;
  };

  async function saveMobileLoanRepayment(
    data: MobileMoneyLoanRepaymentCreateDTO
  ) {
    try {
      setLoading(true);

      if (!selectedMember || !selectedLoan) {
        toast.error("Please select all required fields");
        return;
      }

      if (!isRepaymentValid()) {
        toast.error("Invalid repayment amount");
        return;
      }

      const formData = {
        memberId: selectedMember.id,
        loanId: selectedLoan.value,
        amount: Number(data.amount),
        channel: "MOBILE_MONEY", // ✅ ADD THIS LINE
        mobileMoneyRef: data.mobileMoneyRef.trim(),
      };

      // Submit to API instead of Server Action
      const response = await fetch("/api/loan-repayments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loanId: selectedLoan.value,
          memberId: selectedMember.id,
          amount: Number(data.amount),
          paymentMethod: "Mobile Money",
          transactionReference: data.mobileMoneyRef.trim(),
          handlerUserId: currentUserId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Failed to Process Mobile Loan Repayment", {
          description: result.error || "An unexpected error occurred",
        });
        setLoading(false);
        return;
      }

      setLoading(false);

      const loan = getSelectedLoan();
      const isFullyPaid = willLoanBeFullyPaid();

      toast.success(
        isFullyPaid
          ? "Loan Fully Repaid!"
          : "Mobile Loan Repayment Processed Successfully!",
        {
          description: isFullyPaid
            ? `${formatCurrency(formData.amount)} paid via mobile money. Loan is now fully repaid!`
            : `${formatCurrency(formData.amount)} paid via mobile money for ${loan?.loanApplication.loanProduct.name}`,
        }
      );

      // Reset form
      reset();
      setSelectedMember(null);
      setSelectedLoan(null);
      setMemberLoans([]);
      onClose();
    } catch (error) {
      toast.error("Something went wrong");
      setLoading(false);
      console.log(error);
    }
  }

  const handleReset = () => {
    reset();
    setSelectedMember(null);
    setSelectedLoan(null);
    setMemberLoans([]);
    onClose();
  };

  // Check if loan is overdue
  const isLoanOverdue = (loan: Loan) => {
    return new Date() > new Date(loan.dueDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Process Mobile Loan Repayment
          </DialogTitle>
          <DialogDescription>
            Process a mobile money loan repayment for a SACCO member. All fields
            are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(saveMobileLoanRepayment)}>
          <div className="space-y-8">
            {/* Member Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Select Member
                </h3>
              </div>

              <div className="space-y-3">
                <Label>SACCO Member with Active Loans *</Label>
                <Popover
                  open={memberSearchOpen}
                  onOpenChange={setMemberSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={memberSearchOpen}
                      className="w-full justify-between h-16 px-4 text-left"
                    >
                      {selectedMember ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            {selectedMember.user.image ? (
                              <img
                                src={selectedMember.user.image}
                                alt={selectedMember.user.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {selectedMember.user.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              #{selectedMember.memberNumber} •{" "}
                              {selectedMember.loans.length} active loans
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Search className="h-4 w-4" />
                          <span>Search members with active loans...</span>
                        </div>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[800px] p-0">
                    <Command className="w-full">
                      <CommandInput
                        placeholder="Search members by name, member number, phone, or email..."
                        className="h-12 text-base"
                      />
                      <CommandEmpty>
                        No members with active loans found.
                      </CommandEmpty>
                      <CommandGroup className="max-h-80 overflow-y-auto">
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setSelectedMember(member);
                              setValue("memberId", member.id);
                              setSelectedLoan(null);
                              setMemberSearchOpen(false);
                            }}
                            className="p-4 cursor-pointer hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-4 w-full">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                {member.user.image ? (
                                  <img
                                    src={member.user.image}
                                    alt={member.user.name}
                                    className="h-12 w-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6" />
                                )}
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-lg truncate">
                                    {member.user.name}
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline">
                                      {member.loans.length} active loans
                                    </Badge>
                                    <Badge variant="secondary">
                                      {formatCurrency(
                                        member.loans.reduce(
                                          (sum, loan) =>
                                            sum + loan.outstandingBalance,
                                          0
                                        )
                                      )}{" "}
                                      outstanding
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                  <span className="font-mono">
                                    #{member.memberNumber}
                                  </span>
                                  {member.user.email && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">
                                        {member.user.email}
                                      </span>
                                    </>
                                  )}
                                  {member.user.phone && (
                                    <>
                                      <span>•</span>
                                      <span>{member.user.phone}</span>
                                    </>
                                  )}
                                </div>
                                {member.loans.length > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-gray-400">
                                      Loans:
                                    </span>
                                    <div className="flex gap-1 flex-wrap">
                                      {member.loans
                                        .slice(0, 2)
                                        .map((loan, index) => (
                                          <Badge
                                            key={loan.id}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {
                                              loan.loanApplication.loanProduct
                                                .name
                                            }
                                          </Badge>
                                        ))}
                                      {member.loans.length > 2 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          +{member.loans.length - 2} more
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedMember && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900">
                        Selected Member
                      </h4>
                      <p className="text-sm text-blue-700">
                        {selectedMember.user.name} (#
                        {selectedMember.memberNumber}) •{" "}
                        {selectedMember.loans.length} active loans •{" "}
                        {formatCurrency(
                          selectedMember.loans.reduce(
                            (sum, loan) => sum + loan.outstandingBalance,
                            0
                          )
                        )}{" "}
                        total outstanding
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Loan Selection */}
            {selectedMember && memberLoans.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Select Loan
                  </h3>
                </div>

                <div className="grid gap-3">
                  <FormSelectInput
                    label="Loan to Repay *"
                    options={loanOptions}
                    option={selectedLoan as Option}
                    setOption={setSelectedLoan}
                  />
                </div>

                {selectedLoan && getSelectedLoan() && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-purple-600" />
                        <div>
                          <span className="text-gray-600">Loan Product:</span>
                          <p className="font-medium">
                            {
                              getSelectedLoan()!.loanApplication.loanProduct
                                .name
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <div>
                          <span className="text-gray-600">Loan Amount:</span>
                          <p className="font-medium">
                            {formatCurrency(getSelectedLoan()!.amountGranted)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-purple-600" />
                        <div>
                          <span className="text-gray-600">Outstanding:</span>
                          <p className="font-medium text-red-600">
                            {formatCurrency(
                              getSelectedLoan()!.outstandingBalance
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <div>
                          <span className="text-gray-600">Due Date:</span>
                          <p
                            className={`font-medium ${isLoanOverdue(getSelectedLoan()!) ? "text-red-600" : "text-gray-900"}`}
                          >
                            {formatISODate(getSelectedLoan()!.dueDate)}
                            {isLoanOverdue(getSelectedLoan()!) && (
                              <span className="ml-1 text-red-600 text-xs">
                                (OVERDUE)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isLoanOverdue(getSelectedLoan()!) && (
                      <div className="mt-3 p-2 bg-red-100 rounded border border-red-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-700 font-medium">
                            This loan is overdue and requires immediate
                            attention.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Money Details */}
            {selectedLoan && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Smartphone className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Mobile Money Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Repayment Amount *"
                    name="amount"
                    icon={DollarSign}
                    placeholder="Enter repayment amount"
                  />

                  <TextInput
                    register={register}
                    errors={errors}
                    label="Mobile Money Reference *"
                    name="mobileMoneyRef"
                    icon={Phone}
                    placeholder="Enter mobile money transaction reference"
                  />
                </div>

                {/* Repayment Warning */}
                {watchedValues.amount && getRepaymentWarning() && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <h4 className="font-medium text-red-900">
                          Invalid Repayment Amount
                        </h4>
                        <p className="text-sm text-red-700">
                          {getRepaymentWarning()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Payment Notice */}
                {watchedValues.amount &&
                  willLoanBeFullyPaid() &&
                  isRepaymentValid() && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-medium text-green-900">
                            Loan Will Be Fully Repaid
                          </h4>
                          <p className="text-sm text-green-700">
                            This payment will fully settle the loan. The loan
                            status will be updated to "REPAID".
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Transaction Summary */}
            {selectedMember &&
              selectedLoan &&
              watchedValues.amount &&
              watchedValues.mobileMoneyRef &&
              isRepaymentValid() && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Repayment Summary
                    </h3>
                  </div>

                  <div className="bg-gradient-to-r from-gray-50 to-purple-50 p-6 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Member:</span>
                          <span className="font-medium">
                            {selectedMember.user.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Loan Product:</span>
                          <span className="font-medium">
                            {
                              getSelectedLoan()?.loanApplication.loanProduct
                                .name
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Outstanding Balance:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(
                              getSelectedLoan()?.outstandingBalance || 0
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Repayment Amount:
                          </span>
                          <span className="font-medium text-purple-600">
                            {formatCurrency(Number(watchedValues.amount) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Method:</span>
                          <span className="font-medium">Mobile Money</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Remaining Balance:
                          </span>
                          <span
                            className={`font-medium ${
                              willLoanBeFullyPaid()
                                ? "text-green-600"
                                : "text-blue-600"
                            }`}
                          >
                            {formatCurrency(
                              Math.max(
                                0,
                                (getSelectedLoan()?.outstandingBalance || 0) -
                                  (Number(watchedValues.amount) || 0)
                              )
                            )}
                            {willLoanBeFullyPaid() && (
                              <span className="ml-2 text-green-600 text-xs">
                                (FULLY PAID)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">
                          Mobile Money Reference:
                        </span>
                        <span className="font-mono text-sm bg-purple-100 px-2 py-1 rounded">
                          {watchedValues.mobileMoneyRef}
                        </span>
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
                title="Process Mobile Loan Repayment"
                loading={loading}
                disabled={!isRepaymentValid()}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
