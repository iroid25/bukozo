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
  TrendingDown,
  User,
  CreditCard,
  DollarSign,
  Phone,
  FileText,
  CheckCircle,
  AlertCircle,
  Wallet,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TextInput from "@/components/FormInputs/TextInput";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import FingerprintScanner from "@/components/FingerprintScanner";
import {
  matchFingerprintCapture,
  type FingerprintCapture,
} from "@/lib/fingerprint";

import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  getWithdrawalChannelOptions,
  WithdrawalChannel,
  WithdrawalCreateDTO,
} from "@/types/withdraw";

interface Member {
  id: string;
  memberNumber: string;
  fingerprintTemplate?: string | null;
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
    institutionId: string | null;
  }>;
}

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  institutionId: string | null;
  customFlatWithdrawalFee: number | null;
  customWithdrawalFeePercentage: number | null;
  accountType: {
    name: string;
    minBalance: number;
    flatWithdrawalFee: number | null;
    withdrawalFeePercentage: number | null;
    isShareAccount: boolean;
    canWithdraw: boolean;
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

export default function WithdrawalCreateForm({
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
  } = useForm<WithdrawalCreateDTO>();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberAccounts, setMemberAccounts] = useState<Account[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Option | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Option | null>(null);
  const [floatStatus, setFloatStatus] = useState<any>(null);
  const [loadingFloat, setLoadingFloat] = useState(false);
  const [feeConfig, setFeeConfig] = useState<{
    memberRates: any[];
    institutionRates: any[];
  } | null>(null);
  const [fingerprintCapture, setFingerprintCapture] =
    useState<FingerprintCapture | null>(null);
  const [fingerprintChecking, setFingerprintChecking] = useState(false);
  const [fingerprintVerified, setFingerprintVerified] = useState(false);
  const [fingerprintScore, setFingerprintScore] = useState<number | null>(null);
  const [fingerprintError, setFingerprintError] = useState("");
  const [fingerprintNeedsReEnrollment, setFingerprintNeedsReEnrollment] = useState(false);

  const router = useRouter();
  const { data: session } = useSession();
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

  // Filter members by search query
  const filteredMembers = members.filter((member) => {
    const searchLower = memberSearch.toLowerCase();
    return (
      member.user.name.toLowerCase().includes(searchLower) ||
      member.memberNumber.toLowerCase().includes(searchLower) ||
      (member.user.email &&
        member.user.email.toLowerCase().includes(searchLower)) ||
      (member.user.phone &&
        member.user.phone.toLowerCase().includes(searchLower))
    );
  });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && session?.user) {
      loadFloatStatus();
    }
  }, [isOpen, session?.user]);

  // Load member accounts when member is selected
  useEffect(() => {
    if (selectedMember) {
      loadMemberAccounts(selectedMember.id);
    }
  }, [selectedMember]);

  useEffect(() => {
    setFingerprintCapture(null);
    setFingerprintChecking(false);
    setFingerprintVerified(false);
    setFingerprintScore(null);
    setFingerprintError("");
    setFingerprintNeedsReEnrollment(false);
  }, [selectedMember, selectedAccount, selectedChannel]);

  // Load fee configuration
  useEffect(() => {
    fetch("/api/v1/system/withdrawal-config")
      .then((res) => res.json())
      .then((data) => setFeeConfig(data))
      .catch((err) => console.error("Failed to load fee config", err));
  }, []);

  const loadMembers = async () => {
    try {
      const res = await fetch("/api/v1/deposits/members");
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Members API error:", res.status, errorData);
        toast.error(
          errorData?.error || `Failed to load members (${res.status})`,
        );
        setMembers([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        console.error("Members API returned non-array:", data);
        toast.error(data?.error || "Failed to load members");
        setMembers([]);
      }
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
      setMembers([]);
    }
  };

  const loadFloatStatus = async () => {
    const sessionRole = String((session?.user as any)?.role || "").toUpperCase();
    if (sessionRole && !["TELLER", "AGENT"].includes(sessionRole)) {
      setFloatStatus({
        currentUser: { role: sessionRole },
        userFloat: null,
      });
      return;
    }

    setLoadingFloat(true);
    try {
      const res = await fetch("/api/v1/floats/me");
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to load float status");
      }
      setFloatStatus(data?.data ?? data);
    } catch (error) {
      console.error("Error loading float status:", error);
      setFloatStatus({ userFloat: null, currentUser: null });
    } finally {
      setLoadingFloat(false);
    }
  };

  const loadMemberAccounts = async (memberId: string) => {
    try {
      const res = await fetch(`/api/v1/deposits/accounts?memberId=${memberId}`);
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Accounts API error:", res.status, errorData);
        toast.error(
          errorData?.error || `Failed to load accounts (${res.status})`,
        );
        setMemberAccounts([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setMemberAccounts(data);
      } else {
        console.error("Accounts API returned non-array:", data);
        toast.error(data?.error || "Failed to load accounts");
        setMemberAccounts([]);
      }
    } catch (error) {
      console.error("Error loading member accounts:", error);
      toast.error("Failed to load member accounts");
      setMemberAccounts([]);
    }
  };

  // Create options for FormSelectInput
  const channelOptions = getWithdrawalChannelOptions();

  const accountOptions: Option[] = memberAccounts
    .filter((account) => !account.accountType.isShareAccount)
    .map((account) => {
      const isRestricted = !account.accountType.canWithdraw;
      const restrictionLabel = !account.accountType.canWithdraw
        ? " (Withdrawal Restricted)"
        : "";

      return {
        label: `${account.accountNumber} - ${getAccountTypeDisplayName(
          account.accountType.name,
        )}${restrictionLabel} (${formatCurrency(account.balance)})`,
        value: account.id,
        disabled: isRestricted,
      };
    });

  // Get selected account object
  const getSelectedAccount = () => {
    return (
      memberAccounts.find((acc) => acc.id === selectedAccount?.value) || null
    );
  };

  const requiresFingerprint = Boolean(selectedMember?.fingerprintTemplate);
  const floatScopeResolved = Boolean(
    session?.user || floatStatus?.currentUser?.role,
  );
  const currentUserRole =
    String((session?.user as any)?.role || floatStatus?.currentUser?.role || "").toUpperCase();
  const floatRequired =
    floatScopeResolved &&
    ["TELLER", "AGENT"].includes(currentUserRole);
  const floatBalance = Number(floatStatus?.userFloat?.balance || 0);
  const hasUsableFloat =
    floatScopeResolved &&
    (!floatRequired ||
      (!loadingFloat &&
      !!floatStatus?.userFloat &&
      floatBalance > 0 &&
      floatStatus?.userFloat?.isActiveForDay !== false));

  // Calculate available withdrawal amount
  const getAvailableWithdrawal = () => {
    const account = getSelectedAccount();
    if (!account) return 0;

    // Block if it's a share account or withdrawals are disabled
    if (
      account.accountType.isShareAccount ||
      !account.accountType.canWithdraw
    ) {
      return 0;
    }

    return Math.max(0, account.balance - account.accountType.minBalance);
  };

  // Calculate Fee
  const calculateFee = (amount: number) => {
    const account = getSelectedAccount();
    if (!account || !amount) return 0;

    let fee = 0;
    if (account.customFlatWithdrawalFee !== null) {
      fee = account.customFlatWithdrawalFee;
    } else if (account.customWithdrawalFeePercentage !== null) {
      fee = (account.customWithdrawalFeePercentage / 100) * amount;
    } else if (account.accountType.flatWithdrawalFee !== null) {
      fee = account.accountType.flatWithdrawalFee;
    } else if (account.accountType.withdrawalFeePercentage !== null) {
      fee = (account.accountType.withdrawalFeePercentage / 100) * amount;
    } else {
      // Fallback to configured rates
      // Check if it's an institution account
      const isInstitution = !!account.institutionId;
      const rates = isInstitution
        ? feeConfig?.institutionRates || []
        : feeConfig?.memberRates || [];

      const match = rates.find(
        (t: any) => amount >= t.min && (t.max === null || amount <= t.max),
      );
      if (match) fee = match.fee;
    }
    return fee;
  };

  const handleFingerprintCapture = async (capture: FingerprintCapture) => {
    setFingerprintCapture(capture);
    setFingerprintChecking(true);
    setFingerprintVerified(false);
    setFingerprintScore(null);
    setFingerprintError("");
    setFingerprintNeedsReEnrollment(false);

    try {
      if (!selectedMember?.fingerprintTemplate) {
        return;
      }

      if (!capture.NativeTemplateBase64) {
        const msg = capture.bridgeError || "Native template unavailable — start fingerprint-bridge/server.js and retry.";
        setFingerprintError(msg);
        toast.error(msg);
        return;
      }

      const result = await matchFingerprintCapture(
        selectedMember.fingerprintTemplate,
        capture,
        selectedMember.id,
      );

      if (result.needsReEnrollment) {
        const msg = "Member's fingerprint is in old format — re-enroll before verifying.";
        setFingerprintError(msg);
        setFingerprintNeedsReEnrollment(true);
        toast.error("Re-enrollment required", { description: msg });
        return;
      }

      if (result.ErrorCode !== 0) {
        const msg = `Matching failed (code ${result.ErrorCode}). Please scan again.`;
        setFingerprintError(msg);
        toast.error(msg);
        return;
      }

      setFingerprintScore(result.MatchingScore);
      setFingerprintVerified(result.MatchingScore >= 40);

      if (result.MatchingScore >= 40) {
        toast.success("Fingerprint verified successfully");
      } else {
        const msg = `Score ${result.MatchingScore}/199 — below threshold (40). Ask the member to centre their finger and retry.`;
        setFingerprintError(msg);
        toast.error("Fingerprint mismatch", { description: msg });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Fingerprint verification failed";
      setFingerprintError(msg);
      setFingerprintVerified(false);
      toast.error(msg);
    } finally {
      setFingerprintChecking(false);
    }
  };

  async function saveWithdrawal(data: WithdrawalCreateDTO) {
    try {
      setLoading(true);

      if (!floatScopeResolved || !hasUsableFloat) {
        toast.error(
          "Float required to transact. Please add or allocate float first.",
        );
        setLoading(false);
        return;
      }

      if (!selectedMember || !selectedAccount || !selectedChannel) {
        toast.error("Please select all required fields");
        setLoading(false);
        return;
      }
      if (requiresFingerprint && !fingerprintVerified) {
        toast.error(
          "Please verify the member fingerprint before processing the withdrawal.",
        );
        setLoading(false);
        return;
      }
      //
      const currentUserBal = getAvailableWithdrawal();
      const amount = Number(data.amount);
      const fee = calculateFee(amount);
      const totalDeduction = amount + fee;

      if (totalDeduction > currentUserBal) {
        toast.error(
          `Total deduction (${formatCurrency(totalDeduction)}) exceeds available balance of ${formatCurrency(currentUserBal)}`,
        );
        setLoading(false);
        return;
      }

      const formData = {
        memberId: selectedMember.id,
        accountId: selectedAccount.value,
        amount: Number(data.amount),
        channel: selectedChannel.value as WithdrawalChannel,
        mobileMoneyRef: data.mobileMoneyRef?.trim() || undefined,
        description: data.description?.trim() || undefined,
        fingerprintVerified: requiresFingerprint ? fingerprintVerified : true,
        fingerprintMatchScore: requiresFingerprint
          ? (fingerprintScore ?? undefined)
          : undefined,
      };

      // Submit to API instead of Server Action
      const response = await fetch("/api/v1/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error("Failed to Process Withdrawal", {
          description: result.error || "An unexpected error occurred",
        });
        setLoading(false);
        return;
      }

      setLoading(false);

      // Build success message with float balance
      let description = `${formatCurrency(formData.amount)} withdrawn. Fee: ${formatCurrency(result.fees?.fee || 0)}. Total Deduction: ${formatCurrency(result.fees?.totalDeduction || formData.amount)}.`;

      if (
        result.floatBalance !== undefined &&
        selectedChannel.value === "CASH"
      ) {
        description += `\n\n💰 Your Float Balance: ${formatCurrency(result.floatBalance)}`;
      }

      toast.success("Withdrawal Processed Successfully!", {
        description,
      });

      // Reset form
      reset();
      setSelectedMember(null);
      setSelectedAccount(null);
      setSelectedChannel(null);
      setMemberAccounts([]);
      onClose();

      // Redirect to withdrawal details
      // if (result.data) {
      //   setTimeout(() => {
      //     router.push(`/dashboard/withdrawals/${result.data?.id}`);
      //   }, 1000);
      // }
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
    setSelectedChannel(null);
    setMemberAccounts([]);
    setMemberSearch("");
    setFingerprintCapture(null);
    setFingerprintChecking(false);
    setFingerprintVerified(false);
    setFingerprintScore(null);
    setFingerprintError("");
    setFingerprintNeedsReEnrollment(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 " />
            Process Member Withdrawal
          </DialogTitle>
          <DialogDescription>
            Process a withdrawal transaction for a SACCO member. All fields are
            required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(saveWithdrawal)}>
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
                <Label>Search Member *</Label>
                <Input
                  placeholder="Search by name, member number, email, or phone..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>

              {selectedMember ? (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <p className="font-semibold">
                            {selectedMember.user.name}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600">
                          Member #: {selectedMember.memberNumber}
                        </p>
                        <p className="text-sm text-gray-600">
                          Fingerprint:{" "}
                          {selectedMember.fingerprintTemplate
                            ? "Enrolled"
                            : "Not enrolled yet"}
                        </p>
                        <p className="text-sm text-gray-600">
                          Email: {selectedMember.user.email || "N/A"}
                        </p>
                        {selectedMember.user.phone && (
                          <p className="text-sm text-gray-600">
                            Phone: {selectedMember.user.phone}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMember(null);
                          setMemberSearch("");
                          setSelectedAccount(null);
                          setMemberAccounts([]);
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No members found
                    </p>
                  ) : (
                    filteredMembers.map((member) => (
                      <Card
                        key={member.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          setSelectedMember(member);
                          setSelectedAccount(null);
                          loadMemberAccounts(member.id);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{member.user.name}</p>
                              <p className="text-sm text-gray-600">
                                #{member.memberNumber} •{" "}
                                {member.user.email || "N/A"}
                              </p>
                            </div>
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
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
                    label="Withdrawal Account *"
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
                          <span className="text-gray-600">
                            Available for Withdrawal:
                          </span>
                          <p className="font-medium text-green-700">
                            {formatCurrency(getAvailableWithdrawal())}
                          </p>
                        </div>
                      </div>
                    </div>

                    {getAvailableWithdrawal() === 0 && (
                      <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">
                          No funds available for withdrawal. Account is at
                          minimum balance.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Withdrawal Details */}
            {selectedAccount && getAvailableWithdrawal() > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Withdrawal Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Withdrawal Amount *"
                    name="amount"
                    icon={DollarSign}
                    placeholder="Enter withdrawal amount"
                  />

                  <div className="grid gap-3">
                    <FormSelectInput
                      label="Payment Channel *"
                      options={channelOptions}
                      option={selectedChannel as Option}
                      setOption={setSelectedChannel}
                    />
                  </div>
                </div>

                {/* Mobile Money Reference (conditional) */}
                {selectedChannel?.value === WithdrawalChannel.MOBILE_MONEY && (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Mobile Money Reference *"
                    name="mobileMoneyRef"
                    icon={Phone}
                    placeholder="Enter mobile money transaction reference"
                  />
                )}

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
                    placeholder="Optional description for this withdrawal transaction..."
                    className="min-h-[80px] resize-none"
                    {...register("description")}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Optional - Add any additional notes</span>
                    <span>{watchedValues.description?.length || 0}/200</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-medium text-slate-900">
                      Fingerprint Verification
                    </h4>
                  </div>

                  {requiresFingerprint ? (
                    <>
                      <FingerprintScanner
                        label="Live Verification Scan"
                        onCapture={handleFingerprintCapture}
                        onReset={() => {
                          setFingerprintCapture(null);
                          setFingerprintVerified(false);
                          setFingerprintScore(null);
                          setFingerprintError("");
                          setFingerprintNeedsReEnrollment(false);
                        }}
                        disabled={fingerprintChecking}
                      />

                      <div className={`rounded-lg border p-3 text-sm ${
                        fingerprintVerified
                          ? "border-emerald-200 bg-emerald-50"
                          : fingerprintError
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-white"
                      }`}>
                        {fingerprintVerified ? (
                          <p className="text-emerald-700 font-medium">
                            Verified — Score {fingerprintScore}/199
                          </p>
                        ) : fingerprintError ? (
                          <div className="space-y-2">
                            <p className="text-red-700">{fingerprintError}</p>
                            {fingerprintNeedsReEnrollment && (
                              <p className="text-xs text-amber-700">
                                Open the member's edit page and re-enroll their fingerprint before processing.
                              </p>
                            )}
                            {!fingerprintNeedsReEnrollment && fingerprintScore !== null && (
                              <p className="text-xs text-slate-500">
                                Score {fingerprintScore}/199 — need ≥40. Ask the member to place their finger flat and centred on the sensor.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-600">
                            Fingerprint is required for this member before
                            withdrawal can be processed.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-amber-700">
                      This member does not have a fingerprint enrolled yet.
                      Withdrawal can continue, but the member should be invited
                      to enroll later.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Transaction Summary */}
            {selectedMember &&
              selectedAccount &&
              selectedChannel &&
              watchedValues.amount &&
              getAvailableWithdrawal() > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Transaction Summary
                    </h3>
                  </div>

                  <div className="bg-gradient-to-r from-gray-50 to-red-50 p-6 rounded-lg border">
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
                          <span className="text-gray-600">
                            Withdrawal Amount:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(Number(watchedValues.amount) || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Withdrawal Fee:</span>
                          <span className="font-medium text-orange-600">
                            {formatCurrency(
                              calculateFee(Number(watchedValues.amount) || 0),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="text-gray-600 font-semibold">
                            Total Deduction:
                          </span>
                          <span className="font-bold text-red-600">
                            -
                            {formatCurrency(
                              (Number(watchedValues.amount) || 0) +
                                calculateFee(Number(watchedValues.amount) || 0),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Method:</span>
                          <span className="font-medium">
                            {selectedChannel.label}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="text-gray-600 font-semibold">
                            New Balance:
                          </span>
                          <span className="font-bold text-blue-600">
                            {formatCurrency(
                              (getSelectedAccount()?.balance || 0) -
                                ((Number(watchedValues.amount) || 0) +
                                  calculateFee(
                                    Number(watchedValues.amount) || 0,
                                  )),
                            )}
                          </span>
                        </div>
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

              {floatRequired && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    hasUsableFloat
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {loadingFloat
                    ? "Checking float availability..."
                    : hasUsableFloat
                    ? `Float ready: ${formatCurrency(floatBalance)}`
                    : !floatStatus?.userFloat
                    ? "Float required to withdraw. Please add or allocate float first."
                    : floatBalance <= 0
                    ? "Your float balance is zero. Please replenish it before withdrawing."
                    : floatStatus?.userFloat?.isActiveForDay === false
                    ? "Your float session is not active today."
                    : "Float required to withdraw."}
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
                title="Process Withdrawal"
                loading={loading}
                disabled={
                  !floatScopeResolved ||
                  !selectedMember ||
                  !selectedAccount ||
                  !selectedChannel ||
                  !watchedValues.amount ||
                  getAvailableWithdrawal() === 0 ||
                  !hasUsableFloat ||
                  (requiresFingerprint && !fingerprintVerified)
                }
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
