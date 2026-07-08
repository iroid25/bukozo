"use client";
import React, { useState, useEffect } from "react";
import { differenceInMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  CreditCard,
  User,
  Building,
  DollarSign,
  Percent,
  Calendar,
  CheckCircle,
  AlertCircle,
  Building2,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { AccountCreateDTO } from "@/types/accounts";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    branchId: string;
    accountType: {
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  }>;
}

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  primaryContactPerson: string;
  primaryContactPhone: string;
  primaryContactEmail: string | null;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
    };
  }>;
}

interface AccountType {
  id: string;
  name: string;
  interestRate: number;
  minBalance: number;
  hasFixedPeriod: boolean;
  isShareAccount: boolean;
  sharePrice?: number | null;
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Option {
  label: string;
  value: string;
}

type AccountOwnerType = "member" | "institution";

export default function AccountCreateForm({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountCreateDTO>();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ownerType, setOwnerType] = useState<AccountOwnerType>("member");
  const [isManualNumber, setIsManualNumber] = useState(false);
  const [branchAutoFilled, setBranchAutoFilled] = useState(false);

  const memberOptions = members.map((m) => ({
    label: `${m.user.name} (${m.memberNumber})`,
    value: m.id,
  }));

  const institutionOptions = institutions.map((i) => ({
    label: `${i.institutionName} (${i.institutionNumber})`,
    value: i.id,
  }));

  const [selectedMember, setSelectedMember] = useState<Option | null>(null);
  const [selectedGuardian, setSelectedGuardian] = useState<Option | null>(null);

  const [selectedInstitution, setSelectedInstitution] = useState<Option | null>(
    null,
  );
  const [selectedAccountType, setSelectedAccountType] =
    useState<AccountType | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const currentMember = members.find((m) => m.id === selectedMember?.value);
  const currentInstitution = institutions.find(
    (i) => i.id === selectedInstitution?.value,
  );

  const router = useRouter();
  const watchedValues = watch();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const fetchLookup = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { credentials: "include" });
    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(result.error || "Failed to load lookup data");
    }

    return result.data as T;
  };

  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen]);

  // Reset selections when owner type changes
  useEffect(() => {
    setSelectedMember(null);
    setSelectedInstitution(null);
  }, [ownerType]);

  // Reset account type when owner changes
  useEffect(() => {
    setSelectedAccountType(null);
  }, [selectedMember, selectedInstitution]);

  // Auto-fill branch from voluntary savings account
  useEffect(() => {
    if (currentMember && currentMember.accounts.length > 0) {
      // Find voluntary savings account
      const voluntarySavings = currentMember.accounts.find(
        (acc) =>
          acc.accountType.name === "VOLUNTARY_SAVINGS" ||
          acc.accountType.name === "Voluntary Savings",
      );

      if (voluntarySavings && voluntarySavings.branch) {
        // Auto-fill branch
        setSelectedBranch(voluntarySavings.branch);
        setValue("branchId", voluntarySavings.branchId);
        setBranchAutoFilled(true);

        toast.info("Branch Auto-filled", {
          description: `Using branch from Voluntary Savings: ${voluntarySavings.branch.name}`,
        });
      } else {
        setBranchAutoFilled(false);
        // Optional: Clear branch if not found, but better to keep user selection if they made one?
        // Let's only clear if it WAS auto-filled previously to avoid annoying the user.
        if (branchAutoFilled) {
          setSelectedBranch(null);
          setValue("branchId", "");
          setBranchAutoFilled(false);
        }
      }
    } else {
      if (branchAutoFilled) {
        setSelectedBranch(null);
        setValue("branchId", "");
        setBranchAutoFilled(false);
      }
    }
  }, [currentMember, setValue]);

  // Auto-calculate shares count based on deposit and share price
  useEffect(() => {
    if (
      selectedAccountType?.isShareAccount &&
      selectedAccountType.sharePrice &&
      watchedValues.initialDeposit
    ) {
      const count = Math.floor(
        Number(watchedValues.initialDeposit) / selectedAccountType.sharePrice,
      );
      setValue("sharesCount", count);
    }
  }, [selectedAccountType, watchedValues.initialDeposit, setValue]);

  const loadFormData = async () => {
    try {
      setLoadingData(true);
      const [membersData, institutionsData, accountTypesData, branchesData] =
        await Promise.all([
          fetchLookup<Member[]>("/api/v1/lookups/members?all=true"),
          fetchLookup<Institution[]>(
            "/api/v1/lookups/institutions?eligible=true",
          ),
          fetchLookup<AccountType[]>("/api/v1/account-types/for-creation"),
          fetchLookup<Branch[]>("/api/v1/lookups/branches"),
        ]);

      setMembers(membersData);
      setInstitutions(institutionsData);
      setAccountTypes(accountTypesData);
      setBranches(branchesData);
      setLoadingData(false);
    } catch (error) {
      console.error("Error loading form data:", error);
      toast.error("Failed to load form data");
      setLoadingData(false);
    }
  };

  async function saveAccount(data: AccountCreateDTO) {
    try {
      setLoading(true);

      if (!selectedAccountType || !selectedBranch) {
        toast.error("Please select account type and branch");
        setLoading(false);
        return;
      }

      if (
        selectedAccountType.hasFixedPeriod &&
        !watchedValues.fundingSourceAccountId
      ) {
        toast.error("Please select a funding source account");
        setLoading(false);
        return;
      }

      if (selectedAccountType.name === "Junior Savings" && !selectedGuardian) {
        toast.error("Guardian required", {
          description:
            "Junior Savings accounts require a guardian member to be selected.",
        });
        setLoading(false);
        return;
      }

      if (ownerType === "member" && !selectedMember) {
        toast.error("Please select a member");
        setLoading(false);
        return;
      }

      if (ownerType === "institution" && !selectedInstitution) {
        toast.error("Please select an institution");
        setLoading(false);
        return;
      }

      const formData = {
        ...(ownerType === "member" ? { memberId: selectedMember?.value } : {}),
        ...(ownerType === "institution"
          ? { institutionId: selectedInstitution?.value }
          : {}),
        accountTypeId: selectedAccountType.id,
        branchId: selectedBranch.id,
        initialDeposit: Number(data.initialDeposit) || 0,
        initialDepositReceiptNo: data.initialDepositReceiptNo,
        customAccountNumber: isManualNumber
          ? data.customAccountNumber
          : undefined,
        sharesCount: selectedAccountType.isShareAccount
          ? Number(data.sharesCount)
          : undefined,
        fixingStartDate: selectedAccountType.hasFixedPeriod
          ? data.fixingStartDate
          : undefined,
        fixingEndDate: selectedAccountType.hasFixedPeriod
          ? data.fixingEndDate
          : undefined,
        expectedInterest: selectedAccountType.hasFixedPeriod
          ? Number(data.expectedInterest)
          : undefined,
        fundingSourceAccountId: selectedAccountType.hasFixedPeriod
          ? data.fundingSourceAccountId
          : undefined,
        guardianMemberId:
          selectedAccountType.name === "Junior Savings"
            ? selectedGuardian?.value
            : undefined,
      };

      const response = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to Create Account", {
          description: result.error || "Unknown error occurred",
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success("Account Created Successfully!", {
        description: `Account ${result.data?.accountNumber} created for ${
          ownerType === "member"
            ? selectedMember?.label
            : selectedInstitution?.label
        }`,
      });

      // Reset form and state

      reset();
      setSelectedMember(null);
      setSelectedGuardian(null);
      setSelectedInstitution(null);
      setSelectedAccountType(null);
      setSelectedBranch(null);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
      setLoading(false);
      console.log(error);
    }
  }

  const handleReset = () => {
    reset();
    setSelectedMember(null);
    setSelectedGuardian(null);
    setSelectedInstitution(null);
    setSelectedAccountType(null);
    setSelectedBranch(null);
    onClose();
  };

  const selectedOwner =
    ownerType === "member" ? selectedMember : selectedInstitution;
  const hasOwnerSelected =
    ownerType === "member" ? !!currentMember : !!currentInstitution;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex    gap-2">
            <CreditCard className="h-5 w-5" />
            Create New Account
          </DialogTitle>
          <DialogDescription>
            Create a new account for a member or institution. All fields are
            required.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              <p className="text-sm text-gray-600">Loading form data...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(saveAccount)}>
            <div className="space-y-8">
              {/* Owner Type Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <User className="h-4 w-4 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Account Owner Type
                  </h3>
                </div>

                <Tabs
                  value={ownerType}
                  onValueChange={(v) => setOwnerType(v as AccountOwnerType)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="member"
                      className="flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      Individual Member
                    </TabsTrigger>
                    <TabsTrigger
                      value="institution"
                      className="flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4" />
                      Institution
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="member" className="space-y-3 mt-4">
                    {members.length === 0 ? (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">
                              No Members Available
                            </p>
                            <p className="text-sm text-yellow-700">
                              There are no active members in the system. Please
                              add members first.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <FormSelectInput
                        label="SACCO Member *"
                        options={memberOptions}
                        option={selectedMember as Option}
                        setOption={setSelectedMember}
                        toolTipText="Add New Member"
                        href="/dashboard/users/members"
                      />
                    )}

                    {selectedMember && currentMember && (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Name:</span>
                              <span className="font-medium">
                                {currentMember.user.name}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Member #:</span>
                              <span className="font-medium">
                                {currentMember.memberNumber}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-medium">
                                {currentMember.user.email}
                              </span>
                            </div>
                            {currentMember.user.phone && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Phone:</span>
                                <span className="font-medium">
                                  {currentMember.user.phone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="institution" className="space-y-3 mt-4">
                    {institutions.length === 0 ? (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">
                              No Eligible Institutions Available
                            </p>
                            <p className="text-sm text-yellow-700">
                              Only approved institutions with completed contact
                              details and director signatures can open accounts.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <FormSelectInput
                        label="Institution *"
                        options={institutionOptions}
                        option={selectedInstitution as Option}
                        setOption={setSelectedInstitution}
                        toolTipText="Add New Institution"
                        href="/dashboard/users/institutions"
                      />
                    )}

                    {selectedInstitution && currentInstitution && (
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Institution:</span>
                            <span className="font-medium">
                              {currentInstitution.institutionName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Institution #:
                            </span>
                            <span className="font-medium">
                              {currentInstitution.institutionNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Contact Person:
                            </span>
                            <span className="font-medium">
                              {currentInstitution.primaryContactPerson}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phone:</span>
                            <span className="font-medium">
                              {currentInstitution.primaryContactPhone}
                            </span>
                          </div>
                          {currentInstitution.primaryContactEmail && (
                            <div className="flex justify-between col-span-2">
                              <span className="text-gray-600">Email:</span>
                              <span className="font-medium">
                                {currentInstitution.primaryContactEmail}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Account Type Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Account Type
                  </h3>
                </div>

                <div className="space-y-3">
                  {accountTypes.length === 0 ? (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800">
                            No Account Types Available
                          </p>
                          <p className="text-sm text-yellow-700">
                            Please configure account types first.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Label>Account Type *</Label>
                      <Select
                        value={selectedAccountType?.id || ""}
                        onValueChange={(value) => {
                          const accountType = accountTypes.find(
                            (at) => at.id === value,
                          );
                          setSelectedAccountType(accountType || null);
                          setValue("accountTypeId", value);
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountTypes
                            .filter((type) => {
                              // Get existing account types for the selected owner
                              const owner =
                                ownerType === "member"
                                  ? currentMember
                                  : currentInstitution;
                              const existingTypes =
                                owner?.accounts.map(
                                  (a) => a.accountType.name,
                                ) || [];

                              // Allow Fixed Deposits (multiple allowed) or types the user doesn't have
                              return (
                                type.hasFixedPeriod ||
                                !existingTypes.includes(type.name)
                              );
                            })
                            .map((accountType) => (
                              <SelectItem
                                key={accountType.id}
                                value={accountType.id}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {getAccountTypeDisplayName(
                                      accountType.name,
                                    )}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {accountType.interestRate}% p.a. • Min:{" "}
                                    {formatCurrency(accountType.minBalance)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>

                {selectedAccountType && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <p className="font-medium">
                            {getAccountTypeDisplayName(
                              selectedAccountType.name,
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">Interest:</span>
                          <p className="font-medium">
                            {selectedAccountType.interestRate}% p.a.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <span className="text-gray-600">Min Balance:</span>
                          <p className="font-medium">
                            {formatCurrency(selectedAccountType.minBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Branch Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Building className="h-4 w-4 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Branch Location
                  </h3>
                </div>

                <div className="space-y-3">
                  {branches.length === 0 ? (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800">
                            No Branches Available
                          </p>
                          <p className="text-sm text-yellow-700">
                            Please configure branches first.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Label>Operating Branch *</Label>
                      <Select
                        value={selectedBranch?.id || ""}
                        onValueChange={(value) => {
                          const branch = branches.find((b) => b.id === value);
                          setSelectedBranch(branch || null);
                          setValue("branchId", value);
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {branch.name}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {branch.location}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>

              {/* Custom Account Number */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manual-number"
                    checked={isManualNumber}
                    onCheckedChange={(checked) =>
                      setIsManualNumber(checked as boolean)
                    }
                  />
                  <Label htmlFor="manual-number">
                    Use Custom / Manual Account Number
                  </Label>
                </div>

                {isManualNumber && (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Account Number *"
                    name="customAccountNumber"
                    type="text"
                    icon={CreditCard}
                    placeholder="Enter custom account number"
                  />
                )}
              </div>

              {/* Initial Deposit */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Initial Deposit
                  </h3>
                </div>

                <div className="space-y-3">
                  <TextInput
                    register={register}
                    errors={errors}
                    label={
                      selectedAccountType?.hasFixedPeriod
                        ? "Transfer Amount *"
                        : "Initial Deposit Amount"
                    }
                    name="initialDeposit"
                    type="number"
                    icon={DollarSign}
                    placeholder={
                      selectedAccountType?.hasFixedPeriod
                        ? "Enter amount to transfer"
                        : "Enter initial deposit amount"
                    }
                  />

                  {/* Receipt Number - Optional for fixed deposits with funding source */}
                  {!selectedAccountType?.hasFixedPeriod && (
                    <div className="space-y-2">
                      <TextInput
                        register={register}
                        errors={errors}
                        label="Deposit Receipt Number *"
                        name="initialDepositReceiptNo"
                        type="text"
                        icon={CreditCard}
                        placeholder="Enter receipt or reference number"
                        isRequired={true}
                      />
                    </div>
                  )}

                  {selectedAccountType?.isShareAccount && (
                    <div className="space-y-2">
                      <TextInput
                        register={register}
                        errors={errors}
                        label="Number of Shares (Auto-calculated)"
                        name="sharesCount"
                        type="number"
                        icon={Percent}
                        placeholder="Calculated from deposit"
                        isReadOnly={true}
                      />
                      {watchedValues.initialDeposit &&
                        selectedAccountType.sharePrice && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-100 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-blue-700 font-medium">
                                Share Price:
                              </span>
                              <span className="font-bold text-blue-800">
                                {formatCurrency(selectedAccountType.sharePrice)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-blue-700 font-medium">
                                Shares to Allocate:
                              </span>
                              <span className="font-bold text-blue-800 text-lg">
                                {Math.floor(
                                  Number(watchedValues.initialDeposit) /
                                    selectedAccountType.sharePrice,
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                              Formula:{" "}
                              {formatCurrency(
                                Number(watchedValues.initialDeposit),
                              )}{" "}
                              ÷ {formatCurrency(selectedAccountType.sharePrice)}{" "}
                              ={" "}
                              {Math.floor(
                                Number(watchedValues.initialDeposit) /
                                  selectedAccountType.sharePrice,
                              )}{" "}
                              shares
                            </p>
                          </div>
                        )}
                    </div>
                  )}

                  {selectedAccountType?.hasFixedPeriod && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <TextInput
                        register={register}
                        errors={errors}
                        label="Fixing Start Date *"
                        name="fixingStartDate"
                        type="date"
                        icon={Calendar}
                      />
                      <TextInput
                        register={register}
                        errors={errors}
                        label="Fixing End Date (Maturity) *"
                        name="fixingEndDate"
                        type="date"
                        icon={Calendar}
                      />
                      {/* Auto-calculated Interest Display */}
                      <div className="space-y-2">
                        <Label>
                          Expected Interest at Maturity (Auto-calculated)
                        </Label>
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                          <p className="text-3xl font-bold text-green-700">
                            {(() => {
                              const principal =
                                Number(watchedValues.initialDeposit) || 0;
                              const rate =
                                selectedAccountType?.interestRate || 0;
                              const startDate = watchedValues.fixingStartDate
                                ? new Date(watchedValues.fixingStartDate)
                                : null;
                              const endDate = watchedValues.fixingEndDate
                                ? new Date(watchedValues.fixingEndDate)
                                : null;

                              if (
                                principal > 0 &&
                                startDate &&
                                endDate &&
                                endDate > startDate
                              ) {
                                const months = differenceInMonths(
                                  endDate,
                                  startDate,
                                );
                                const interest =
                                  (principal * rate * months) / (12 * 100);
                                // Store calculated value
                                setValue(
                                  "expectedInterest",
                                  Math.round(interest),
                                );
                                return formatCurrency(Math.round(interest));
                              }
                              setValue("expectedInterest", 0);
                              return formatCurrency(0);
                            })()}
                          </p>
                          <p className="text-xs text-gray-600 mt-2">
                            {(() => {
                              const principal =
                                Number(watchedValues.initialDeposit) || 0;
                              const rate =
                                selectedAccountType?.interestRate || 0;
                              const startDate = watchedValues.fixingStartDate
                                ? new Date(watchedValues.fixingStartDate)
                                : null;
                              const endDate = watchedValues.fixingEndDate
                                ? new Date(watchedValues.fixingEndDate)
                                : null;

                              if (startDate && endDate && endDate > startDate) {
                                const months = differenceInMonths(
                                  endDate,
                                  startDate,
                                );
                                return `Formula: ${formatCurrency(principal)} × ${rate}% × ${months} months ÷ 12`;
                              }
                              return "Enter dates to calculate interest";
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Funding Source (Voluntary Savings) *</Label>
                        <Select
                          onValueChange={(val) =>
                            setValue("fundingSourceAccountId", val)
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select savings account" />
                          </SelectTrigger>
                          <SelectContent>
                            {(currentMember || currentInstitution)?.accounts
                              .filter(
                                (acc) =>
                                  acc.accountType.name ===
                                    "VOLUNTARY_SAVINGS" ||
                                  acc.accountType.name ===
                                    "Voluntary Savings" ||
                                  acc.accountType.name === "Savings Account",
                              )
                              .map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.accountNumber} - Bal:{" "}
                                  {formatCurrency(acc.balance)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Guardian selector — Junior Savings only */}
                  {selectedAccountType?.name === "Junior Savings" &&
                    ownerType === "member" && (
                      <div className="pt-4 border-t space-y-2">
                        <Label className="text-sm font-medium">
                          Guardian Member{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Select the adult member who will serve as guardian for
                          this junior account.
                        </p>
                        <Select
                          onValueChange={(val) => {
                            const found = members.find((m) => m.id === val);
                            if (found) {
                              setSelectedGuardian({
                                label: `${found.user.name} (${found.memberNumber})`,
                                value: found.id,
                              });
                            }
                          }}
                          value={selectedGuardian?.value ?? ""}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Search and select guardian member" />
                          </SelectTrigger>
                          <SelectContent>
                            {members
                              .filter((m) => m.id !== selectedMember?.value)
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.user.name} ({m.memberNumber})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {selectedGuardian && (
                          <p className="text-xs text-green-700 font-medium">
                            Guardian: {selectedGuardian.label}
                          </p>
                        )}
                      </div>
                    )}

                  {selectedAccountType && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800">
                          Minimum Balance Required
                        </p>
                        <p className="text-yellow-700">
                          This account type requires a minimum balance of{" "}
                          <strong>
                            {formatCurrency(selectedAccountType.minBalance)}
                          </strong>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Summary */}
              {selectedOwner && selectedAccountType && selectedBranch && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Account Summary
                    </h3>
                  </div>

                  <div className="bg-gradient-to-r from-gray-50 to-green-50 p-6 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {ownerType === "member"
                              ? "Member:"
                              : "Institution:"}
                          </span>
                          <span className="font-medium">
                            {ownerType === "member"
                              ? currentMember?.user.name
                              : currentInstitution?.institutionName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {ownerType === "member"
                              ? "Member Number:"
                              : "Institution Number:"}
                          </span>
                          <span className="font-medium">
                            #
                            {ownerType === "member"
                              ? currentMember?.memberNumber
                              : currentInstitution?.institutionNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Account Type:</span>
                          <span className="font-medium">
                            {getAccountTypeDisplayName(
                              selectedAccountType.name,
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Branch:</span>
                          <span className="font-medium">
                            {selectedBranch.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Interest Rate:</span>
                          <span className="font-medium">
                            {selectedAccountType.interestRate}% p.a.
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Initial Deposit:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(
                              Number(watchedValues.initialDeposit) || 0,
                            )}
                          </span>
                        </div>
                        {selectedAccountType.hasFixedPeriod &&
                          watchedValues.expectedInterest && (
                            <div className="flex justify-between text-green-700 font-bold border-t border-green-200 pt-2">
                              <span>Expected Interest:</span>
                              <span>
                                {formatCurrency(watchedValues.expectedInterest)}
                              </span>
                            </div>
                          )}
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
                  title="Create Account"
                  loading={loading}
                  disabled={
                    !selectedOwner ||
                    !selectedAccountType ||
                    !selectedBranch ||
                    (ownerType === "member" && members.length === 0) ||
                    (ownerType === "institution" &&
                      institutions.length === 0) ||
                    accountTypes.length === 0 ||
                    branches.length === 0
                  }
                />
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
