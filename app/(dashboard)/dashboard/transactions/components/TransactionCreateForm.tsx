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
  DollarSign,
  User,
  CreditCard,
  Search,
  CheckCircle,
  AlertCircle,
  Building,
  TrendingUp,
  TrendingDown,
  Smartphone,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  TransactionCreateDTO,
  getTransactionTypeOptions,
  getTransactionChannelOptions,
  getTransactionTypeInfo,
  isPositiveTransaction,
} from "@/types/transactions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { TransactionType } from "@prisma/client";

type MemberData = any;

type Option = {
  label: string;
  value: string;
};

// Form data type for react-hook-form
type FormData = {
  memberId?: string;
  accountId?: string;
  amount?: string;
  description?: string;
  externalReference?: string;
  mobileMoneyRef?: string;
};

export default function TransactionCreateForm({
  isOpen,
  onClose,
  currentUserId,
  currentUserBranchId,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserBranchId?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [selectedTransactionType, setSelectedTransactionType] =
    useState<Option | null>(null);
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
      const res = await fetch("/api/v1/members/active");
      const json = await res.json();
      setMembers(json.data || []);
    } catch (error) {
      console.error("Error loading form data:", error);
      toast.error("Failed to load form data");
    }
  };

  // Transaction type and channel options
  const transactionTypeOptions = getTransactionTypeOptions();
  const channelOptions = getTransactionChannelOptions();

  // Get account options for selected member
  const getAccountOptions = (): Option[] => {
    if (!selectedMember?.accounts) return [];

    return selectedMember.accounts.map((account: any) => ({
      label: `${account.accountNumber} - ${account.accountType.name.replace(/_/g, " ")} (${formatCurrency(account.balance)})`,
      value: account.id,
    }));
  };

  // Get selected account object
  const getSelectedAccountObject = () => {
    if (!selectedMember?.accounts || !watchedValues.accountId) return null;

    const account = selectedMember.accounts.find(
      (acc: any) => acc.id === watchedValues.accountId
    );
    return account || null;
  };

  // Validate transaction amount against account balance for withdrawals
  const validateAmount = (): {
    valid: boolean;
    message: string | null;
  } | null => {
    if (!selectedAccount || !selectedTransactionType || !watchedValues.amount)
      return null;

    const amount = Number(watchedValues.amount);
    const transactionType = selectedTransactionType.value as TransactionType;

    if (
      transactionType === TransactionType.WITHDRAWAL &&
      amount > selectedAccount.balance
    ) {
      return {
        valid: false,
        message: `Insufficient balance. Available: ${formatCurrency(selectedAccount.balance)}`,
      };
    }

    return { valid: true, message: null };
  };

  // Get transaction impact preview
  const getTransactionImpact = () => {
    if (!selectedAccount || !selectedTransactionType || !watchedValues.amount)
      return null;

    const amount = Number(watchedValues.amount);
    const transactionType = selectedTransactionType.value as TransactionType;
    const isPositive = isPositiveTransaction(transactionType, amount);

    const currentBalance = selectedAccount.balance;
    const newBalance = isPositive
      ? currentBalance + amount
      : Math.max(0, currentBalance - amount);

    return {
      currentBalance,
      newBalance,
      isPositive,
      balanceChange: isPositive ? amount : -amount,
    };
  };

  async function saveTransaction(data: FormData) {
    try {
      setLoading(true);

      if (
        !selectedMember ||
        !selectedAccount ||
        !selectedTransactionType ||
        !selectedChannel ||
        !data.amount
      ) {
        toast.error("Please fill all required fields");
        setLoading(false);
        return;
      }

      // Validate amount for withdrawals
      const validation = validateAmount();
      if (validation && !validation.valid) {
        toast.error("Transaction Error", {
          description: validation.message || "Invalid amount",
        });
        setLoading(false);
        return;
      }

      // Prepare transaction data with all required fields
      const transactionData: TransactionCreateDTO = {
        memberId: selectedMember.id,
        accountId: selectedAccount.id,
        type: selectedTransactionType.value as TransactionType,
        amount: Number(data.amount),
        currency: "UGX",
        description:
          data.description?.trim() ||
          `${selectedTransactionType.value} transaction`,
        userId: currentUserId,
        branchId: currentUserBranchId || selectedAccount.branch.id,
        paymentMethod: selectedChannel.value,
        channel: selectedChannel.value,
        paymentReference:
          selectedChannel.value === "Mobile Money"
            ? data.mobileMoneyRef?.trim()
            : data.externalReference?.trim(),
        notes: data.externalReference?.trim(),
        mobileMoneyRef: data.mobileMoneyRef?.trim(),
        externalReference: data.externalReference?.trim(),
      };

      const response = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Failed to Create Transaction", {
          description: result.error || "Unknown error occurred",
        });
        setLoading(false);
        return;
      }

      toast.success("Transaction Created Successfully!", {
        description: `${getTransactionTypeInfo(transactionData.type).label} of ${formatCurrency(transactionData.amount)} processed for ${selectedMember.user?.name || "member"}`,
      });

      // Reset form
      reset();
      setSelectedMember(null);
      setSelectedAccount(null);
      setSelectedTransactionType(null);
      setSelectedChannel(null);
      setLoading(false);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
      setLoading(false);
      console.error(error);
    }
  }

  const handleReset = () => {
    reset();
    setSelectedMember(null);
    setSelectedAccount(null);
    setSelectedTransactionType(null);
    setSelectedChannel(null);
    onClose();
  };

  // Update selected account when account selection changes
  useEffect(() => {
    const accountObject = getSelectedAccountObject();
    setSelectedAccount(accountObject);
  }, [watchedValues.accountId, selectedMember]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Create Transaction
          </DialogTitle>
          <DialogDescription>
            Process a new transaction for a SACCO member account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(saveTransaction)}>
          <div className="space-y-8">
            {/* Member Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Select Member & Account
                </h3>
              </div>

              <div className="space-y-3">
                <Label>SACCO Member *</Label>
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
                            {selectedMember.user?.image ? (
                              <img
                                src={selectedMember.user.image}
                                alt={selectedMember.user?.name || "Member"}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {selectedMember.user?.name || "Unknown Member"}
                            </span>
                            <span className="text-sm text-gray-500">
                              #{selectedMember.memberNumber} •{" "}
                              {selectedMember.accounts?.length || 0} accounts
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Search className="h-4 w-4" />
                          <span>Search and select a member...</span>
                        </div>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[800px] p-0">
                    <Command className="w-full">
                      <CommandInput
                        placeholder="Search members by name, number, phone, or email..."
                        className="h-12 text-base"
                      />
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup className="max-h-80 overflow-y-auto">
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setSelectedMember(member);
                              setValue("memberId", member.id);
                              setValue("accountId", "");
                              setSelectedAccount(null);
                              setMemberSearchOpen(false);
                            }}
                            className="p-4 cursor-pointer hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-4 w-full">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                {member.user?.image ? (
                                  <img
                                    src={member.user.image}
                                    alt={member.user?.name || "Member"}
                                    className="h-12 w-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6" />
                                )}
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-lg truncate">
                                    {member.user?.name || "Unknown Member"}
                                  </span>
                                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    <span className="text-sm font-medium text-green-600">
                                      {member.accounts?.length || 0} accounts
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                  <span className="font-mono">
                                    #{member.memberNumber}
                                  </span>
                                  {member.user?.email && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">
                                        {member.user.email}
                                      </span>
                                    </>
                                  )}
                                  {member.user?.phone && (
                                    <>
                                      <span>•</span>
                                      <span>{member.user.phone}</span>
                                    </>
                                  )}
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

              {selectedMember?.accounts &&
                selectedMember.accounts.length > 0 && (
                  <div className="space-y-3">
                    <FormSelectInput
                      label="Select Account *"
                      options={getAccountOptions()}
                      option={
                        watchedValues.accountId && selectedAccount
                          ? {
                              label: `${selectedAccount.accountNumber} - ${selectedAccount.accountType.name.replace(/_/g, " ")} (${formatCurrency(selectedAccount.balance)})`,
                              value: watchedValues.accountId,
                            }
                          : null
                      }
                      setOption={(option: Option | null) => {
                        if (option) {
                          setValue("accountId", option.value);
                        }
                      }}
                    />

                    {selectedAccount && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-blue-900 mb-1">
                              Account Details
                            </h4>
                            <p className="text-blue-700">
                              {selectedAccount.accountNumber}
                            </p>
                            <p className="text-blue-700">
                              {selectedAccount.accountType.name.replace(
                                /_/g,
                                " "
                              )}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-blue-900 mb-1">
                              Current Balance
                            </h4>
                            <p className="text-blue-700 text-lg font-bold">
                              {formatCurrency(selectedAccount.balance)}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-blue-900 mb-1">
                              Branch
                            </h4>
                            <p className="text-blue-700">
                              {selectedAccount.branch.name}
                            </p>
                            <p className="text-blue-600 text-xs">
                              {selectedAccount.branch.location}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Transaction Details */}
            {selectedAccount && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Transaction Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormSelectInput
                    label="Transaction Type *"
                    options={transactionTypeOptions}
                    option={selectedTransactionType}
                    setOption={setSelectedTransactionType}
                  />

                  <TextInput
                    register={register}
                    errors={errors}
                    label="Amount *"
                    name="amount"
                    type="number"
                    icon={DollarSign}
                    placeholder="Enter transaction amount"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <FormSelectInput
                    label="Payment Channel *"
                    options={channelOptions}
                    option={selectedChannel}
                    setOption={setSelectedChannel}
                  />

                  <TextInput
                    register={register}
                    errors={errors}
                    label="External Reference"
                    name="externalReference"
                    placeholder="External transaction reference (optional)"
                  />
                </div>

                {selectedChannel?.value === "Mobile Money" && (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Mobile Money Reference *"
                    name="mobileMoneyRef"
                    icon={Smartphone}
                    placeholder="Enter mobile money transaction reference"
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional transaction description or notes..."
                    className="min-h-[80px] resize-none"
                    {...register("description")}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Optional - Transaction notes</span>
                    <span>{watchedValues.description?.length || 0}/500</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Impact Preview */}
            {getTransactionImpact() && selectedTransactionType && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Building className="h-4 w-4 text-orange-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Transaction Impact
                  </h3>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-lg border">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-600">Transaction Type:</span>
                      <div className="flex items-center gap-2">
                        {getTransactionImpact()!.isPositive ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <p className="font-medium">
                          {
                            getTransactionTypeInfo(
                              selectedTransactionType.value as TransactionType
                            ).label
                          }
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">Current Balance:</span>
                      <p className="font-medium text-lg">
                        {formatCurrency(getTransactionImpact()!.currentBalance)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">Transaction Amount:</span>
                      <p
                        className={`font-medium text-lg ${getTransactionImpact()!.isPositive ? "text-green-600" : "text-red-600"}`}
                      >
                        {getTransactionImpact()!.isPositive ? "+" : "-"}
                        {formatCurrency(Number(watchedValues.amount) || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600">New Balance:</span>
                      <p className="font-medium text-lg text-blue-600">
                        {formatCurrency(getTransactionImpact()!.newBalance)}
                      </p>
                    </div>
                  </div>

                  {/* Validation Messages */}
                  {validateAmount() && !validateAmount()!.valid && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium">Insufficient Balance</p>
                        <p>{validateAmount()!.message}</p>
                      </div>
                    </div>
                  )}

                  {getTransactionImpact()!.isPositive && (
                    <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-800 font-medium">
                        This transaction will increase the account balance.
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
                title="Process Transaction"
                loading={loading}
                disabled={
                  !selectedMember ||
                  !selectedAccount ||
                  !selectedTransactionType ||
                  !selectedChannel ||
                  !watchedValues.amount ||
                  (selectedChannel?.value === "Mobile Money" &&
                    !watchedValues.mobileMoneyRef) ||
                  (validateAmount() && !validateAmount()!.valid)
                }
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
