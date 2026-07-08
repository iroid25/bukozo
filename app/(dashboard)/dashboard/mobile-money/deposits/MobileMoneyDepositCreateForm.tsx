// @ts-nocheck
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
  FileText,
  CheckCircle,
  Search,
  Wallet,
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

import { toast } from "sonner";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { MobileMoneyDepositCreateDTO } from "@/types/mobileMoney";

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
    image: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
    };
    branch: {
      name: string;
    };
  }>;
}

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  accountType: {
    name: string;
    minBalance: number;
  };
  branch: {
    name: string;
    location: string;
  };
}

type Option = {
  label: string;
  value: string;
};

export default function MobileMoneyDepositCreateForm({
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
  } = useForm<MobileMoneyDepositCreateDTO>();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberAccounts, setMemberAccounts] = useState<Account[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Option | null>(null);

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

  // Get account type display name
  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  // Load member accounts when member is selected
  useEffect(() => {
    if (selectedMember) {
      loadMemberAccounts(selectedMember.id);
    }
  }, [selectedMember]);

  const loadMembers = async () => {
    try {
      const res = await fetch("/api/v1/members/active");
      const json = await res.json();
      setMembers(json.data || json || []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
    }
  };

  const loadMemberAccounts = async (memberId: string) => {
    try {
      const res = await fetch(`/api/v1/deposits/accounts?memberId=${memberId}`);
      const json = await res.json();
      setMemberAccounts(json.data || json || []);
    } catch (error) {
      console.error("Error loading member accounts:", error);
      toast.error("Failed to load member accounts");
    }
  };

  // Create options for FormSelectInput
  const accountOptions: Option[] = memberAccounts.map((account) => ({
    label: `${account.accountNumber} - ${getAccountTypeDisplayName(account.accountType.name)} (${formatCurrency(account.balance)})`,
    value: account.id,
  }));

  // Get selected account object
  const getSelectedAccount = () => {
    return (
      memberAccounts.find((acc) => acc.id === selectedAccount?.value) || null
    );
  };

  async function saveMobileMoneyDeposit(data: MobileMoneyDepositCreateDTO) {
    try {
      setLoading(true);

      if (!selectedMember || !selectedAccount) {
        toast.error("Please select all required fields");
        return;
      }

      const formData = {
        memberId: selectedMember.id,
        accountId: selectedAccount.value,
        amount: Number(data.amount),
        mobileMoneyRef: data.mobileMoneyRef.trim(),
        description: data.description?.trim() || undefined,
      };

      // Submit to API instead of Server Action
      const response = await fetch("/api/v1/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          channel: "MOBILE_MONEY",
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error("Failed to Process Mobile Money Deposit", {
          description: result.error || "An unexpected error occurred",
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success("Mobile Money Deposit Processed Successfully!", {
        description: `${formatCurrency(formData.amount)} deposited via mobile money to ${getSelectedAccount()?.accountNumber}`,
      });

      // Reset form
      reset();
      setSelectedMember(null);
      setSelectedAccount(null);
      setMemberAccounts([]);
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
    setSelectedAccount(null);
    setMemberAccounts([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Process Mobile Money Deposit
          </DialogTitle>
          <DialogDescription>
            Process a mobile money deposit transaction for a SACCO member. All
            fields are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(saveMobileMoneyDeposit)}>
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
                              {selectedMember.accounts.length} accounts
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
                        placeholder="Search members by name, member number, phone, or email..."
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
                              setSelectedAccount(null);
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
                                  <Badge
                                    variant="outline"
                                    className="ml-2 flex-shrink-0"
                                  >
                                    {member.accounts.length} account
                                    {member.accounts.length !== 1 ? "s" : ""}
                                  </Badge>
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
                        {selectedMember.accounts.length} active accounts
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Account Selection */}
            {selectedMember && memberAccounts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Select Account
                  </h3>
                </div>

                <div className="grid gap-3">
                  <FormSelectInput
                    label="Deposit Account *"
                    options={accountOptions}
                    option={selectedAccount as Option}
                    setOption={setSelectedAccount}
                  />
                </div>

                {selectedAccount && getSelectedAccount() && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">Account:</span>
                          <p className="font-medium">
                            {getSelectedAccount()!.accountNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">
                            Current Balance:
                          </span>
                          <p className="font-medium">
                            {formatCurrency(getSelectedAccount()!.balance)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <p className="font-medium">
                            {getAccountTypeDisplayName(
                              getSelectedAccount()!.accountType.name
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Money Details */}
            {selectedAccount && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Mobile Money Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Deposit Amount *"
                    name="amount"
                    icon={DollarSign}
                    placeholder="Enter deposit amount"
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

                {/* Description */}
                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    Transaction Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description for this mobile money deposit..."
                    className="min-h-[80px] resize-none"
                    {...register("description")}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Optional - Add any additional notes</span>
                    <span>{watchedValues.description?.length || 0}/200</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Summary */}
            {selectedMember &&
              selectedAccount &&
              watchedValues.amount &&
              watchedValues.mobileMoneyRef && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Transaction Summary
                    </h3>
                  </div>

                  <div className="bg-gradient-to-r from-gray-50 to-green-50 p-6 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Member:</span>
                          <span className="font-medium">
                            {selectedMember.user.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Account:</span>
                          <span className="font-medium">
                            {getSelectedAccount()?.accountNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Current Balance:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(getSelectedAccount()?.balance || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Deposit Amount:</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(Number(watchedValues.amount) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Method:</span>
                          <span className="font-medium">Mobile Money</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">New Balance:</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(
                              (getSelectedAccount()?.balance || 0) +
                                (Number(watchedValues.amount) || 0)
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

                    {watchedValues.description && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <span className="text-gray-600 text-sm">
                          Description:
                        </span>
                        <p className="mt-1 text-sm text-gray-800">
                          {watchedValues.description}
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
                title="Process Mobile Money Deposit"
                loading={loading}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
