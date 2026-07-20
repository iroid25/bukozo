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
  Search,
  Wallet,
  AlertTriangle,
  Shield,
  Mail,
  Clock,
  KeyRound,
  RefreshCw,
  Info,
  Building,
  PenLine,
  ImageIcon,
  Fingerprint,
  Smartphone,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import FingerprintScanner from "@/components/FingerprintScanner";
import {
  matchFingerprintCapture,
  type FingerprintCapture,
} from "@/lib/fingerprint";

import TextInput from "@/components/FormInputs/TextInput";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AGENT_WITHDRAWAL_FEES } from "@/config/fees";
import { isJointSavingsAccountType } from "@/lib/accounting/account-type-rules";

// Types for API Transfer
export interface WithdrawalVerificationDTO {
  memberId?: string;
  institutionId?: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  signatoryId?: string;
  recipientName?: string;
  recipientIdNumber?: string;
  recipientPhone?: string;
  recipientRelation?: string;
  verifiedSignatories?: string[];
  verifiedJointMembers?: string[];
  verifiedAgent?: boolean;
}

import { Alert, AlertDescription } from "../reports/activity/component/Alert";
import { calculateWithdrawalFee } from "@/lib/fees";

// Types
interface Member {
  id: string;
  memberNumber: string;
  fingerprintTemplate?: string | null;
  user: {
    name: string;
    email: string;
    phone: string | null;
    image: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    customFlatWithdrawalFee?: number | null;
    customWithdrawalFeePercentage?: number | null;
    customWithdrawalFeeTiers?: string | null;
    accountType: {
      name: string;
      minBalance: number;
      isShareAccount?: boolean;
      canWithdraw?: boolean;
      flatWithdrawalFee?: number | null;
      withdrawalFeePercentage?: number | null;
      withdrawalFeeTiers?: string | null;
    };
    jointMembers?: Array<{
      id: string;
      memberId: string;
      member: {
        id: string;
        memberNumber: string;
        user: {
          name: string;
          image: string | null;
        };
      };
    }>;
    branch: {
      name: string;
    };
  }>;
}

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  user: {
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    customFlatWithdrawalFee?: number | null;
    customWithdrawalFeePercentage?: number | null;
    customWithdrawalFeeTiers?: string | null;
    accountType: {
      name: string;
      minBalance: number;
      isShareAccount?: boolean;
      canWithdraw?: boolean;
      flatWithdrawalFee?: number | null;
      withdrawalFeePercentage?: number | null;
      withdrawalFeeTiers?: string | null;
    };
    branch: {
      name: string;
    };
  }>;
  signatories: Array<{
    id: string;
    name: string;
    title: string | null;
    isPrimary: boolean;
    photoImage?: string | null;
    signatureImage?: string | null;
  }>;
  withdrawalMandate?: string;
  withdrawalMandateText?: string;
}

interface Signatory {
  id: string;
  name: string;
  title: string | null;
  isPrimary: boolean;
  photoImage?: string | null;
  signatureImage?: string | null;
  fingerprintTemplate?: string | null;
}

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  customFlatWithdrawalFee?: number | null;
  customWithdrawalFeePercentage?: number | null;
  customWithdrawalFeeTiers?: string | null;
  accountType: {
    name: string;
    minBalance: number;
    isShareAccount?: boolean;
    canWithdraw?: boolean;
    flatWithdrawalFee?: number | null;
    withdrawalFeePercentage?: number | null;
    withdrawalFeeTiers?: string | null;
  };
  jointMembers?: Array<{
    id: string;
    memberId: string;
    member: {
      id: string;
      memberNumber: string;
      user: {
        name: string;
        image: string | null;
      };
    };
  }>;
  branch: {
    name: string;
    location: string;
  };
}

interface HandlerFloat {
  userId: string;
  role: string;
  userFloat: {
    id: string;
    balance: number;
    lastReconciliation: Date | null;
  } | null;
}

interface VerificationData {
  id: string;
  memberId: string;
  accountId: string;
  amount: number;
  fee: number;
  totalDeduction?: number;
  channel: string;
  emailSent: boolean;
  smsSent: boolean;
  expiresAt: string;
  debugVerificationCode?: string;
  member: {
    user: {
      name: string;
      email: string;
      phone: string;
    };
  };
  account: {
    accountNumber: string;
  };
}

const DEFAULT_WITHDRAWAL_RATES = {
  memberRates: [
    { min: 5000, max: 1000000, fee: 300 },
    { min: 1000001, max: 2000000, fee: 500 },
    { min: 2000001, max: 4000000, fee: 1000 },
    { min: 4000001, max: 4999999, fee: 1500 },
    { min: 5000000, max: null, fee: 2000 },
  ],
  institutionRates: [
    { min: 5000, max: 2000000, fee: 1000 },
    { min: 2000001, max: 5000000, fee: 2000 },
    { min: 5000001, max: null, fee: 3000 },
  ],
};

type Option = {
  label: string;
  value: string;
};

enum WithdrawalStep {
  FORM = "form",
  VERIFICATION = "verification",
  COMPLETED = "completed",
}

interface WithdrawalCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserRole?: string[];
}

// ─── Signatory Verification Card ───────────────────────────────────────────────
interface SignatoryVerificationProps {
  signatoryId: string;
  signatoryName: string;
  signatoryTitle?: string | null;
  isPrimary: boolean;
  photoImage?: string | null;
  storedSignatureImage?: string | null;
  fingerprintTemplate?: string | null;
  isVerified: boolean;
  onVerifiedChange: (id: string, checked: boolean) => void;
  fingerprintState?: { captured: boolean; score: number; template: string | null };
  onFingerprintCapture?: (id: string, capture: string) => void;
  onFingerprintReset?: (id: string) => void;
}

function SignatoryVerificationCard({
  signatoryId,
  signatoryName,
  signatoryTitle,
  isPrimary,
  photoImage,
  storedSignatureImage,
  fingerprintTemplate,
  isVerified,
  onVerifiedChange,
  fingerprintState,
  onFingerprintCapture,
  onFingerprintReset,
}: SignatoryVerificationProps) {
  const initials = signatoryName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
        isVerified
          ? "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-purple-200"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <input
            type="checkbox"
            id={`signatory-${signatoryId}`}
            checked={isVerified}
            onChange={(e) => onVerifiedChange(signatoryId, e.target.checked)}
            className="h-5 w-5 mt-0.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">
                {signatoryName}
              </span>
              {isPrimary && (
                <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                  Primary
                </span>
              )}
              {isVerified && (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {signatoryTitle || "Signatory"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <User className="h-3 w-3" />
              Photo On File
            </p>
            {photoImage ? (
              <div className="h-20 w-full border rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center">
                <img
                  src={photoImage}
                  alt={`${signatoryName} photo`}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-20 w-full border border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold">
                  {initials || "?"}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Signature Specimen
            </p>
            {storedSignatureImage ? (
              <div className="h-20 w-full border rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center">
                <img
                  src={storedSignatureImage}
                  alt={`${signatoryName} stored signature`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="h-20 w-full border border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center">
                <PenLine className="h-5 w-5 text-gray-300 mb-1" />
                <p className="text-xs text-gray-400">No stored signature</p>
              </div>
            )}
          </div>
        </div>

        {/* Fingerprint scan for signatory */}
        {fingerprintTemplate && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Fingerprint className="h-3 w-3" />
              Fingerprint Verification
            </p>
            {fingerprintState?.captured ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">
                  Verified (score: {fingerprintState.score})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs"
                  onClick={() => onFingerprintReset?.(signatoryId)}
                >
                  Retake
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FingerprintScanner
                  label={`Scan ${signatoryName}'s Fingerprint`}
                  onCapture={(capture) => onFingerprintCapture?.(signatoryId, capture)}
                  onReset={() => onFingerprintReset?.(signatoryId)}
                />
              </div>
            )}
          </div>
        )}

        {!isVerified && (
          <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
            <Info className="h-3 w-3 flex-shrink-0" />
            Tick the checkbox above after visually confirming the signatory
            details
          </p>
        )}
      </div>
    </div>
  );
}

export default function WithdrawalCreateForm({
  isOpen,
  onClose,
  currentUserId,
  currentUserRole = ["TELLER"],
}: WithdrawalCreateFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawalVerificationDTO>();

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<WithdrawalStep>(
    WithdrawalStep.FORM,
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [memberAccounts, setMemberAccounts] = useState<Account[]>([]);

  const [withdrawalType, setWithdrawalType] = useState<
    "MEMBER" | "INSTITUTION"
  >("MEMBER");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [institutionSearchOpen, setInstitutionSearchOpen] = useState(false);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedInstitution, setSelectedInstitution] =
    useState<Institution | null>(null);
  const [selectedSignatory, setSelectedSignatory] = useState<Signatory | null>(
    null,
  );

  const [selectedAccount, setSelectedAccount] = useState<Option | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Option | null>(null);
  const [verificationData, setVerificationData] =
    useState<VerificationData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [verificationMode, setVerificationMode] = useState<"fingerprint" | "email" | "sms">("fingerprint");
  const [fingerprintCapture, setFingerprintCapture] =
    useState<FingerprintCapture | null>(null);
  const [fingerprintChecking, setFingerprintChecking] = useState(false);
  const [fingerprintVerified, setFingerprintVerified] = useState(false);
  const [fingerprintScore, setFingerprintScore] = useState<number | null>(null);
  const [fingerprintError, setFingerprintError] = useState("");
  const [handlerFloat, setHandlerFloat] = useState<HandlerFloat | null>(null);
  const [loadingFloat, setLoadingFloat] = useState(false);
  const [showFloatWarning, setShowFloatWarning] = useState(false);
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [systemRates, setSystemRates] = useState<any>(null);
  const [agentWithdrawalRates, setAgentWithdrawalRates] = useState<any[]>(AGENT_WITHDRAWAL_FEES);

  // Institution withdrawal enhancements
  const [recipientName, setRecipientName] = useState("");
  const [recipientIdNumber, setRecipientIdNumber] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientRelation, setRecipientRelation] = useState("");
  const [verifiedSignatories, setVerifiedSignatories] = useState<Set<string>>(
    new Set(),
  );
  const [signatoryFingerprintStates, setSignatoryFingerprintStates] = useState<Record<string, { captured: boolean; score: number; template: string | null }>>({});
  const [verifiedAgent, setVerifiedAgent] = useState(false);
  const [verifiedJointMembers, setVerifiedJointMembers] = useState<Set<string>>(new Set());
  const [jointMemberFingerprintStates, setJointMemberFingerprintStates] = useState<Record<string, { captured: boolean; score: number; template: string | null }>>({});
  const [accountHold, setAccountHold] = useState<any>(null);
  const [checkingHold, setCheckingHold] = useState(false);

  const router = useRouter();
  const watchedAmount = watch("amount");
  const isShareAccount = (account: {
    accountType?: { name?: string; isShareAccount?: boolean } | null;
  }) => {
    const typeName = account.accountType?.name?.toLowerCase() || "";
    return Boolean(account.accountType?.isShareAccount) || typeName.includes("share");
  };

  const isWithdrawableAccount = (account: {
    accountType?: {
      name?: string;
      isShareAccount?: boolean;
      canWithdraw?: boolean;
    } | null;
  }) => {
    if (isShareAccount(account)) return false;
    return account.accountType?.canWithdraw !== false;
  };

  const getWithdrawableAccounts = <T extends { accounts?: Account[] }>(
    owner: T | null | undefined,
  ) => {
    if (!owner?.accounts) return [];
    return owner.accounts.filter((account) => isWithdrawableAccount(account));
  };

  const membersWithWithdrawableAccounts = members.filter(
    (member) => getWithdrawableAccounts(member).length > 0,
  );

  const institutionsWithWithdrawableAccounts = institutions.filter(
    (institution) => getWithdrawableAccounts(institution).length > 0,
  );

  // Timer for verification countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (currentStep === WithdrawalStep.VERIFICATION && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          if (time <= 1) {
            setCurrentStep(WithdrawalStep.FORM);
            toast.error("Verification expired. Please restart the process.");
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
      CURRENT_ACCOUNT: "Current Account",
      LOAN_ACCOUNT: "Loan Account",
    };
    return displayNames[name] || name.replace(/_/g, " ");
  };

  const needsFloatValidation = () => {
    const userRole = Array.isArray(currentUserRole)
      ? currentUserRole[0]
      : currentUserRole;
    return (
      ["TELLER", "AGENT"].includes(userRole) &&
      selectedChannel?.value === "Cash"
    );
  };

  const isFloatAmountValid = () => {
    const amount = Number(watchedAmount) || 0;
    if (amount <= 0) return false;
    if (needsFloatValidation()) {
      return (
        handlerFloat?.userFloat && handlerFloat.userFloat.balance >= amount
      );
    }
    return true;
  };

  const getFloatShortage = () => {
    const amount = Number(watchedAmount) || 0;
    const balance = handlerFloat?.userFloat?.balance || 0;
    return Math.max(0, amount - balance);
  };

  const getWithdrawalFee = () => {
    const amount = Number(watchedAmount) || 0;
    const account = getSelectedAccount();
    if (!account || amount <= 0) return 0;
    const isAgentCashWithdrawal =
      userRole === "AGENT" && selectedChannel?.value === "Cash";

    if (isAgentCashWithdrawal) {
      const tiers = Array.isArray(agentWithdrawalRates) && agentWithdrawalRates.length > 0
        ? agentWithdrawalRates
        : AGENT_WITHDRAWAL_FEES;
      const tier = tiers.find(
        (t) => amount >= Number(t.min) && (t.max === 0 || t.max === null || amount <= Number(t.max)),
      );
      return Number(tier?.charge ?? tier?.fee ?? 0);
    }

    const fallbackTiers =
      withdrawalType === "MEMBER"
        ? systemRates?.memberRates
        : systemRates?.institutionRates;
    const fallbackTiersJson = fallbackTiers
      ? JSON.stringify(fallbackTiers)
      : null;
    // Debug logging
    console.log("Fee calculation:", {
      amount,
      accountType: account.accountType,
      account,
      fallbackTiers,
    });
    const fee = calculateWithdrawalFee(
      amount,
      account.accountType,
      account,
      fallbackTiersJson,
    );
    console.log("Calculated fee:", fee);
    return fee;
  };

  const getAvailableWithdrawal = () => {
    const account = getSelectedAccount();
    if (!account) return 0;
    return Math.max(0, account.balance - (account.accountType.minBalance || 0));
  };

  const selectedMemberHasFingerprint = Boolean(selectedMember?.fingerprintTemplate);
  const selectedMemberFingerprintMissing =
    withdrawalType === "MEMBER" &&
    !!selectedMember &&
    !selectedMemberHasFingerprint;

  const hasValidFloat = () => {
    const userRole = Array.isArray(currentUserRole)
      ? currentUserRole[0]
      : currentUserRole;
    if (!["TELLER", "AGENT"].includes(userRole)) return true;
    return handlerFloat?.userFloat && handlerFloat.userFloat.balance > 0;
  };

  // ── Mandate validation helpers ────────────────────────────────────────────
  const getMandateRequirement = () => {
    if (!selectedInstitution) return 0;
    const mandate = selectedInstitution.withdrawalMandate || "ALL_SIGNATORIES";
    const count = selectedInstitution.signatories?.length || 0;
    if (mandate === "ANY_1_SIGNATORY") return 1;
    if (mandate === "ANY_2_SIGNATORIES") return 2;
    if (mandate === "ANY_3_SIGNATORIES") return 3;
    if (mandate === "ALL_SIGNATORIES") return count;
    return count;
  };

  const canSubmitForm = () => {
    const amount = Number(watchedAmount) || 0;
    const availableWithdrawal = getAvailableWithdrawal();

    if (
      (!selectedMember && !selectedInstitution) ||
      !selectedAccount ||
      !selectedChannel ||
      amount <= 0
    ) {
      return false;
    }

    if (withdrawalType === "INSTITUTION" && selectedInstitution) {
      if (
        !recipientName.trim() ||
        !recipientIdNumber.trim() ||
        !recipientPhone.trim() ||
        !recipientRelation
      ) {
        return false;
      }

      const required = getMandateRequirement();
      if (verifiedSignatories.size < required) return false;

      // Signatories with enrolled fingerprints must also fingerprint-verify
      const signatoriesWithFingerprints = selectedInstitution.signatories?.filter(s => s.fingerprintTemplate) ?? [];
      for (const sig of signatoriesWithFingerprints) {
        const fpState = signatoryFingerprintStates[sig.id];
        if (!fpState?.captured) return false;
      }

      if (!verifiedAgent) return false;
    }

    if (selectedMemberFingerprintMissing) {
      return false;
    }

    if (
      withdrawalType === "MEMBER" &&
      selectedMemberHasFingerprint &&
      verificationMode === "fingerprint" &&
      !fingerprintVerified
    ) {
      return false;
    }

    const fee = getWithdrawalFee();
    if (amount + fee > availableWithdrawal) return false;
    if (needsFloatValidation() && !isFloatAmountValid()) return false;
    if (!hasValidFloat()) return false;

    return true;
  };

  useEffect(() => {
    const amount = Number(watchedAmount) || 0;
    if (needsFloatValidation() && amount > 0 && !isFloatAmountValid()) {
      setShowFloatWarning(true);
    } else {
      setShowFloatWarning(false);
    }
  }, [watchedAmount, selectedChannel, handlerFloat]);

  useEffect(() => {
    if (isOpen) {
      const userRole = Array.isArray(currentUserRole)
        ? currentUserRole[0]
        : currentUserRole;
      if (!["TELLER", "AGENT", "ADMIN", "BRANCHMANAGER"].includes(userRole)) {
        setShowPermissionError(true);
        toast.error("Access Denied", {
          description: "You do not have permission to process withdrawals.",
          duration: 6000,
        });
        return;
      }
      loadInitialData();
      setCurrentStep(WithdrawalStep.FORM);
    }
  }, [isOpen]);

  useEffect(() => {
    if (withdrawalType === "MEMBER" && selectedMember) {
      loadAccounts(selectedMember.id, "MEMBER");
    } else if (withdrawalType === "INSTITUTION" && selectedInstitution) {
      loadAccounts(selectedInstitution.id, "INSTITUTION");
    }
  }, [selectedMember, selectedInstitution, withdrawalType]);

  useEffect(() => {
    setFingerprintCapture(null);
    setFingerprintChecking(false);
    setFingerprintVerified(false);
    setFingerprintScore(null);
    setFingerprintError("");
    setVerificationMode(
      withdrawalType === "MEMBER" && selectedMember?.fingerprintTemplate
        ? "fingerprint"
        : "email",
    );
  }, [selectedMember, withdrawalType]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setLoadingFloat(true);
      setLoadError(null);

      const parseJsonResponse = async (response: Response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            body?.error || `Request failed with status ${response.status}`,
          );
        }
        return body;
      };

      const [membersResult, institutionsResult, floatData, systemRatesRes, agentRatesRes] =
        await Promise.all([
          fetch("/api/v1/members/active")
            .then(parseJsonResponse)
            .catch((error) => ({
              success: false,
              data: [],
              error: error.message,
            })),
          fetch("/api/v1/institutions/active")
            .then(parseJsonResponse)
            .catch((error) => ({
              success: false,
              data: [],
              error: error.message,
            })),
          fetch(`/api/v1/deposits/float?userId=${currentUserId}`)
            .then(parseJsonResponse)
            .catch(() => ({ data: null })),
          fetch("/api/v1/system/withdrawal-config")
            .then(parseJsonResponse)
            .catch((error) => ({
              ...DEFAULT_WITHDRAWAL_RATES,
              error: error.message,
              usingFallback: true,
            })),
          fetch("/api/v1/settings/fees?key=AGENT_WITHDRAWAL_FEES")
            .then(parseJsonResponse)
            .catch((error) => ({
              data: null,
              error: error.message,
              usingFallback: true,
            })),
        ]);

      const baseMembers = Array.isArray(membersResult)
        ? membersResult
        : membersResult?.success && Array.isArray(membersResult.data)
          ? membersResult.data
          : [];

      if (!baseMembers.length && membersResult?.error) {
        setMembers([]);
        setLoadError(membersResult?.error || "Failed to load members data");
        toast.error("Failed to load members");
      } else {
        const normalizedMembers = baseMembers.map((member: Member) => ({
          ...member,
          accounts: Array.isArray(member.accounts)
            ? member.accounts.filter((account) => isWithdrawableAccount(account))
            : [],
        }));

        setMembers(
          normalizedMembers.filter(
            (member) => getWithdrawableAccounts(member).length > 0,
          ),
        );
      }

      if (
        institutionsResult?.success &&
        Array.isArray(institutionsResult.data)
      ) {
        setInstitutions(institutionsResult.data);
      } else {
        setInstitutions([]);
      }

      if (floatData?.data) setHandlerFloat(floatData.data);
      if (systemRatesRes) {
        setSystemRates(systemRatesRes);
        if (systemRatesRes.usingFallback) {
          toast.warning("Using default withdrawal fee rates", {
            description:
              systemRatesRes.error ||
              "System withdrawal configuration could not be loaded.",
          });
        }
      } else {
        setSystemRates(DEFAULT_WITHDRAWAL_RATES);
      }

      const parsedAgentRates = Array.isArray(agentRatesRes?.data)
        ? agentRatesRes.data
        : Array.isArray(agentRatesRes?.data?.data)
          ? agentRatesRes.data.data
          : Array.isArray(agentRatesRes?.data?.value)
            ? agentRatesRes.data.value
            : Array.isArray(agentRatesRes?.data)
              ? agentRatesRes.data
              : null;
      if (parsedAgentRates && parsedAgentRates.length > 0) {
        setAgentWithdrawalRates(parsedAgentRates);
      } else {
        setAgentWithdrawalRates(AGENT_WITHDRAWAL_FEES);
      }
    } catch (error) {
      setLoadError("Failed to load form data");
      setMembers([]);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
      setLoadingFloat(false);
    }
  };

  const refreshFloatBalance = async () => {
    try {
      setLoadingFloat(true);
      const res = await fetch(`/api/v1/deposits/float?userId=${currentUserId}`);
      const floatData = await res.json();
      if (floatData?.data) {
        setHandlerFloat(floatData.data);
        toast.success("Float balance updated");
      }
    } catch {
      toast.error("Failed to refresh float balance");
    } finally {
      setLoadingFloat(false);
    }
  };

  const loadAccounts = async (id: string, type: "MEMBER" | "INSTITUTION") => {
    try {
      const queryKey = type === "MEMBER" ? "memberId" : "institutionId";
      const res = await fetch(`/api/v1/deposits/accounts?${queryKey}=${id}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Failed to load accounts");
      }

      const accounts = Array.isArray(result) ? result : result?.data || [];
      const withdrawableAccounts = accounts.filter((account: Account) =>
        isWithdrawableAccount(account),
      );

      if (withdrawableAccounts.length > 0) {
        setMemberAccounts(withdrawableAccounts);
        return;
      }

      if (type === "MEMBER") {
        const fallbackRes = await fetch(`/api/v1/members/${id}`);
        const fallbackResult = await fallbackRes.json();
        if (fallbackRes.ok && (fallbackResult.success || fallbackResult.data)) {
          const fallbackAccounts = (fallbackResult.data?.accounts || []).filter(
            (account: Account) => isWithdrawableAccount(account),
          );
          if (fallbackAccounts.length > 0) {
            setMemberAccounts(fallbackAccounts);
            return;
          }

          const selectedFallbackAccounts = getWithdrawableAccounts(selectedMember);
          if (selectedFallbackAccounts.length > 0) {
            setMemberAccounts(selectedFallbackAccounts);
            return;
          }
        }
      }

      if (type === "INSTITUTION") {
        const selectedFallbackAccounts = getWithdrawableAccounts(selectedInstitution);
        if (selectedFallbackAccounts.length > 0) {
          setMemberAccounts(selectedFallbackAccounts);
          return;
        }
      }

      setMemberAccounts(withdrawableAccounts);
    } catch {
      if (type === "MEMBER" && selectedMember)
        setMemberAccounts(
          (selectedMember.accounts || []).filter((account) => isWithdrawableAccount(account)),
        );
      else if (type === "INSTITUTION" && selectedInstitution)
        setMemberAccounts(
          (selectedInstitution.accounts || []).filter((account) => isWithdrawableAccount(account)),
        );
      else setMemberAccounts([]);
    }
  };

  const handleFingerprintCapture = async (capture: FingerprintCapture) => {
    setFingerprintCapture(capture);
    setFingerprintChecking(true);
    setFingerprintError("");
    setFingerprintVerified(false);
    setFingerprintScore(null);

    try {
      if (!selectedMember?.fingerprintTemplate) {
        setFingerprintError(
          "This member has no fingerprint enrolled yet. Please update the member record before using fingerprint verification.",
        );
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
        const message = "Member's fingerprint is in old format — go to the member's edit page and re-enroll before verifying.";
        setFingerprintError(message);
        toast.error("Re-enrollment required", { description: message });
        return;
      }

      if (result.ErrorCode !== 0) {
        throw new Error(`Matching failed (code ${result.ErrorCode}). Please scan again.`);
      }

      setFingerprintScore(result.MatchingScore);
      setFingerprintVerified(result.MatchingScore >= 40);

      if (result.MatchingScore >= 40) {
        toast.success("Fingerprint verified successfully");
      } else {
        const message = `Score ${result.MatchingScore}/199 — below threshold (40). Ask the member to centre their finger and retry.`;
        setFingerprintError(message);
        toast.error("Fingerprint mismatch", { description: message });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fingerprint verification failed";
      setFingerprintError(message);
      setFingerprintVerified(false);
      toast.error(message);
    } finally {
      setFingerprintChecking(false);
    }
  };

  const useVerificationCodeFallback = () => {
    setVerificationMode("code");
    setFingerprintError("");
    setFingerprintVerified(false);
    toast.info("Verification code fallback enabled.");
  };

  const channelOptions = [
    { label: "Cash", value: "Cash" },
    { label: "Mobile Money", value: "Mobile Money" },
    { label: "Bank Transfer", value: "Bank Transfer" },
  ];

  const accountOptions: Option[] = Array.isArray(memberAccounts)
    ? memberAccounts
        .filter((acc) => {
          return isWithdrawableAccount(acc);
        })
        .map((acc) => ({
          label: `${acc.accountNumber} - ${getAccountTypeDisplayName(acc.accountType.name)} (${formatCurrency(acc.balance)})`,
          value: acc.id,
        }))
    : [];

  const getSelectedAccount = () => {
    if (!Array.isArray(memberAccounts)) return null;
    return (
      memberAccounts.find((acc) => acc.id === selectedAccount?.value) || null
    );
  };

  const handleInsufficientFloat = () => {
    const shortage = getFloatShortage();
    toast.error("Insufficient Float Balance", {
      description: `You need ${formatCurrency(shortage)} more to process this cash withdrawal.`,
      duration: 8000,
      action: { label: "Refresh Balance", onClick: refreshFloatBalance },
    });
  };

  // ── Handle signatory verification ────────────────────────────────────
  const handleSignatoryVerified = (signatoryId: string, checked: boolean) => {
    const newSet = new Set(verifiedSignatories);
    if (checked) {
      newSet.add(signatoryId);
      if (!selectedSignatory) {
        const sig =
          selectedInstitution?.signatories?.find((s) => s.id === signatoryId) ||
          null;
        setSelectedSignatory(sig);
      }
    } else {
      newSet.delete(signatoryId);
    }
    setVerifiedSignatories(newSet);
  };

  const handleSignatoryFingerprintCapture = async (signatoryId: string, capture: FingerprintCapture) => {
    const sig = selectedInstitution?.signatories?.find((s) => s.id === signatoryId);
    if (!sig?.fingerprintTemplate) return;
    if (!capture.NativeTemplateBase64) {
      toast.error(capture.bridgeError || "Fingerprint bridge not running — start fingerprint-bridge/server.js");
      return;
    }
    try {
      const result = await matchFingerprintCapture(
        sig.fingerprintTemplate,
        capture,
      );
      if (result.needsReEnrollment) {
        toast.error("Re-enrollment required", { description: "Signatory fingerprint needs re-enrollment." });
        return;
      }
      if (result.ErrorCode !== 0) {
        throw new Error(`Matching failed (code ${result.ErrorCode}).`);
      }
      setSignatoryFingerprintStates((prev) => ({
        ...prev,
        [signatoryId]: { captured: true, score: result.MatchingScore ?? 0, template: capture.NativeTemplateBase64 },
      }));
      toast.success(`Signatory fingerprint verified (score: ${result.MatchingScore})`);
    } catch (err: any) {
      toast.error(err.message || "Fingerprint verification failed");
    }
  };

  const handleSignatoryFingerprintReset = (signatoryId: string) => {
    setSignatoryFingerprintStates((prev) => {
      const next = { ...prev };
      delete next[signatoryId];
      return next;
    });
  };

  // ── Handle joint member verification ──────────────────────────────────
  const handleJointMemberVerified = (memberId: string, checked: boolean) => {
    const newSet = new Set(verifiedJointMembers);
    if (checked) {
      newSet.add(memberId);
    } else {
      newSet.delete(memberId);
    }
    setVerifiedJointMembers(newSet);
  };

  const handleJointMemberFingerprintCapture = async (memberId: string, capture: FingerprintCapture) => {
    const account = getSelectedAccount();
    const jm = account?.jointMembers?.find((j) => j.memberId === memberId);
    const fpTemplate = jm?.member?.user?.fingerprintTemplate;
    if (!fpTemplate) return;
    if (!capture.NativeTemplateBase64) {
      toast.error(capture.bridgeError || "Fingerprint bridge not running — start fingerprint-bridge/server.js");
      return;
    }
    try {
      const result = await matchFingerprintCapture(fpTemplate, capture);
      if (result.needsReEnrollment) {
        toast.error("Re-enrollment required", { description: "Joint member fingerprint needs re-enrollment." });
        return;
      }
      if (result.ErrorCode !== 0) {
        throw new Error(`Matching failed (code ${result.ErrorCode}).`);
      }
      setJointMemberFingerprintStates((prev) => ({
        ...prev,
        [memberId]: { captured: true, score: result.MatchingScore ?? 0, template: capture.NativeTemplateBase64 },
      }));
      toast.success(`Joint member fingerprint verified (score: ${result.MatchingScore})`);
    } catch (err: any) {
      toast.error(err.message || "Fingerprint verification failed");
    }
  };

  const handleJointMemberFingerprintReset = (memberId: string) => {
    setJointMemberFingerprintStates((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
  };

  const agentName =
    selectedInstitution?.user?.name ||
    selectedInstitution?.institutionName ||
    "Institution Representative";
  const agentPhoto = selectedInstitution?.user?.image || null;
  const hasAgentCard = !!selectedInstitution;

  async function submitWithdrawalRequest(data: WithdrawalVerificationDTO) {
    try {
      setLoading(true);

      if (withdrawalType === "MEMBER" && !selectedMember) {
        toast.error("Please select a member");
        return;
      }
      if (withdrawalType === "INSTITUTION" && !selectedInstitution) {
        toast.error("Please select an institution");
        return;
      }
      if (withdrawalType === "INSTITUTION" && !selectedSignatory) {
        toast.error("Please select and verify at least one signatory");
        return;
      }
      if (
        withdrawalType === "INSTITUTION" &&
        selectedInstitution &&
        !verifiedAgent
      ) {
        toast.error("Please verify the institution representative/agent");
        return;
      }

      // Joint savings: require all joint members to be verified
      if (withdrawalType === "MEMBER") {
        const account = getSelectedAccount();
        if (account && isJointSavingsAccountType(account.accountType)) {
          const jointMembers = account.jointMembers || [];
          if (jointMembers.length > 0) {
            const requiredIds = new Set(jointMembers.map((jm) => jm.memberId));
            const verifiedIds = verifiedJointMembers;
            const missing = jointMembers.filter((jm) => !verifiedIds.has(jm.memberId));
            if (missing.length > 0) {
              const names = missing.map((jm) => jm.member.user.name).join(", ");
              toast.error(`All joint members must verify this withdrawal. Missing: ${names}`);
              return;
            }
            // All verified IDs must be valid joint members
            for (const vid of verifiedIds) {
              if (!requiredIds.has(vid)) {
                toast.error("Verified member is not a joint member of this account");
                return;
              }
            }
          }
        }
      }

      if (!selectedAccount || !selectedChannel) {
        toast.error("Please select all required fields");
        return;
      }

      const availableAmount = getAvailableWithdrawal();
      const fee = getWithdrawalFee();
      const totalDeduction = Number(data.amount) + fee;

      if (totalDeduction > availableAmount) {
        toast.error(
          `Insufficient funds. Amount + Fee (${formatCurrency(totalDeduction)}) exceeds available balance of ${formatCurrency(availableAmount)}`,
        );
        return;
      }

      if (needsFloatValidation() && !isFloatAmountValid()) {
        handleInsufficientFloat();
        return;
      }

      if (selectedMemberFingerprintMissing) {
        toast.error(
          "This member has no fingerprint enrolled yet. Ask the teller to update the member record before processing the withdrawal.",
          {
            description: "Use the member update page to enroll the fingerprint first.",
          },
        );
        return;
      }

      if (
        withdrawalType === "MEMBER" &&
        selectedMemberHasFingerprint &&
        verificationMode === "fingerprint" &&
        !fingerprintVerified
      ) {
        toast.error(
          "Verify the fingerprint first, or switch to verification-code fallback if the scan fails.",
        );
        return;
      }

      const formData: WithdrawalVerificationDTO = {
        memberId: withdrawalType === "MEMBER" ? selectedMember!.id : undefined,
        institutionId:
          withdrawalType === "INSTITUTION"
            ? selectedInstitution!.id
            : undefined,
        accountId: selectedAccount.value,
        amount: Number(data.amount),
        channel: selectedChannel.value,
        mobileMoneyRef: data.mobileMoneyRef?.trim() || undefined,
        description: data.description?.trim() || undefined,
        signatoryId:
          withdrawalType === "INSTITUTION" ? selectedSignatory?.id : undefined,
        recipientName:
          withdrawalType === "INSTITUTION" ? recipientName.trim() : undefined,
        recipientIdNumber:
          withdrawalType === "INSTITUTION"
            ? recipientIdNumber.trim()
            : undefined,
        recipientPhone:
          withdrawalType === "INSTITUTION" ? recipientPhone.trim() : undefined,
        recipientRelation:
          withdrawalType === "INSTITUTION" ? recipientRelation : undefined,
        verifiedSignatories:
          withdrawalType === "INSTITUTION"
            ? Array.from(verifiedSignatories)
            : undefined,
        verifiedAgent:
          withdrawalType === "INSTITUTION" ? verifiedAgent : undefined,
        verifiedJointMembers:
          withdrawalType === "MEMBER" && verifiedJointMembers.size > 0
            ? Array.from(verifiedJointMembers)
            : undefined,
        signatoryFingerprints:
          withdrawalType === "INSTITUTION"
            ? Object.fromEntries(
                Object.entries(signatoryFingerprintStates).map(([id, state]) => [
                  id,
                  { captured: state.captured, score: state.score },
                ]),
              )
            : undefined,
      };
      const skipDelivery =
        withdrawalType === "MEMBER" &&
        selectedMemberHasFingerprint &&
        verificationMode === "fingerprint" &&
        fingerprintVerified;

      const res = await fetch("/api/v1/withdrawals/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          skipDelivery,
        verificationMethod: verificationMode,
      }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        toast.error("Failed to Create Verification Request", {
          description: result.error || "Unknown error",
        });
        return;
      }

      if (result.processed && result.success && result.data) {
        const memberName =
          withdrawalType === "MEMBER"
            ? selectedMember?.user.name || "Member"
            : selectedInstitution?.institutionName || "Institution";
        setVerificationData({
          id: result.data?.transaction?.id || `${Date.now()}`,
          amount: Number(data.amount),
          fee: result.data?.fee || 0,
          totalDeduction:
            result.data?.totalDeducted || Number(data.amount) + (result.data?.fee || 0),
          channel: selectedChannel.value,
          emailSent: true,
          smsSent: false,
          expiresAt: new Date().toISOString(),
          member: {
            user: {
              name: memberName,
              email: selectedMember?.user.email || "",
              phone: selectedMember?.user.phone || "",
            },
          },
          account: {
            accountNumber: getSelectedAccount()?.accountNumber || "",
          },
        } as any);
        setCurrentStep(WithdrawalStep.COMPLETED);
        toast.success(
          result.message || "Withdrawal processed successfully.",
        );
        await refreshFloatBalance();
        setTimeout(() => {
          handleReset();
        }, 3000);
      } else if (result.success && result.data) {
        const verification = {
          ...result.data,
          expiresAt:
            typeof result.data.expiresAt === "string"
              ? result.data.expiresAt
              : new Date(result.data.expiresAt).toISOString(),
        };

        setVerificationData(verification);
        setCurrentStep(WithdrawalStep.VERIFICATION);
        setTimeRemaining(10 * 60);

        if (result.data.emailSent || result.data.smsSent) {
          toast.success("Verification code delivered", {
            description:
              result.message ||
              "Check the member's email or phone for the verification code.",
          });
        } else {
          if (result.data.debugVerificationCode) {
            // Auto-fill the code so the teller can verify manually
            setVerificationCode(result.data.debugVerificationCode);
            toast.warning("Email delivery failed — use code below", {
              description: `Verification code: ${result.data.debugVerificationCode}. Read this to the member for manual verification.`,
              duration: 30000,
            });
          } else {
            toast.error("Verification code delivery failed", {
              description:
                result.message ||
                "The verification code was created but could not be delivered. Check your email sender configuration.",
            });
          }
        }
      }
    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function processVerifiedWithdrawal() {
    if (!verificationData || !verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/v1/withdrawals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: verificationData.id,
          verificationCode: verificationCode.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        toast.error("Verification Failed", {
          description: result.error || "Unknown error",
        });
        setLoading(false);
        return;
      }

      if (result.success && result.data) {
        setCurrentStep(WithdrawalStep.COMPLETED);
        toast.success("Withdrawal Processed Successfully!");
        await refreshFloatBalance();
        setTimeout(() => {
          handleReset();
        }, 3000);
      }
    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    reset();
    setSelectedMember(null);
    setSelectedInstitution(null);
    setSelectedSignatory(null);
    setSelectedAccount(null);
    setWithdrawalType("MEMBER");
    setSelectedChannel(null);
    setMemberAccounts([]);
    setVerificationData(null);
    setVerificationCode("");
    setTimeRemaining(0);
    setShowFloatWarning(false);
    setShowPermissionError(false);
    setLoadError(null);
    setRecipientName("");
    setRecipientIdNumber("");
    setRecipientPhone("");
    setRecipientRelation("");
    setVerifiedSignatories(new Set());
    setVerifiedAgent(false);
    setVerifiedJointMembers(new Set());
    setJointMemberFingerprintStates({});
    setAccountHold(null);
    setCurrentStep(WithdrawalStep.FORM);
    onClose();
  };

  const userRole = Array.isArray(currentUserRole)
    ? currentUserRole[0]
    : currentUserRole;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderPermissionError = () => (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <Shield className="h-10 w-10 text-red-600" />
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-semibold text-gray-900">Access Denied</h3>
        <p className="text-gray-600 text-lg">
          You do not have permission to process withdrawals
        </p>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">
            <strong>Current Role:</strong> {userRole}
          </p>
          <p className="text-sm text-red-700 mt-2">
            Only Tellers, Agents, Branch Managers, and System Administrators can
            process withdrawals.
          </p>
        </div>
      </div>
      <div className="flex justify-center pt-6 border-t">
        <Button onClick={handleReset} className="min-w-32">
          Close
        </Button>
      </div>
    </div>
  );

  const renderFormStep = () => (
    <>
      {loading && !members.length && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600">Loading members...</p>
        </div>
      )}

      {loadError && !loading && (
        <Alert className="mb-6 border-red-300 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {loadError}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadInitialData}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {["TELLER", "AGENT"].includes(userRole) && !loading && (
        <div
          className={`rounded-lg border-2 p-4 mb-6 ${
            handlerFloat?.userFloat
              ? "bg-gradient-to-r from-green-50 to-blue-50 border-green-300"
              : "bg-gradient-to-r from-red-50 to-orange-50 border-red-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-full ${handlerFloat?.userFloat ? "bg-green-100" : "bg-red-100"}`}
              >
                <Wallet
                  className={`h-6 w-6 ${handlerFloat?.userFloat ? "text-green-700" : "text-red-700"}`}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Your Float Balance
                </h3>
                {handlerFloat?.userFloat ? (
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(handlerFloat.userFloat.balance)}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-red-700">
                    No Float Account
                  </p>
                )}
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              <Badge
                variant={handlerFloat?.userFloat ? "default" : "destructive"}
              >
                {userRole}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshFloatBalance}
                disabled={loadingFloat}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingFloat ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFloatWarning && (
        <Alert className="mb-6 border-orange-300 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Insufficient Float Balance!</strong>
                <p className="text-sm mt-1">
                  You need {formatCurrency(getFloatShortage())} more to process
                  this cash withdrawal.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInsufficientFloat}
                className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Request Float
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit(submitWithdrawalRequest)}>
          <div className="space-y-6">
            {/* ── Step 1: Owner ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                {withdrawalType === "MEMBER" ? (
                  <User className="h-5 w-5 text-blue-600" />
                ) : (
                  <Building className="h-5 w-5 text-purple-600" />
                )}
                <h3 className="text-lg font-semibold text-gray-900">
                  Step 1: Select Account Owner
                </h3>
              </div>

              <div className="flex space-x-4 mb-4">
                <div
                  onClick={() => {
                    setWithdrawalType("MEMBER");
                    setMemberAccounts([]);
                    setSelectedAccount(null);
                  }}
                  className={`flex-1 p-3 border rounded-lg cursor-pointer transition-all ${withdrawalType === "MEMBER" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-200 hover:border-blue-300"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User
                      className={`h-4 w-4 ${withdrawalType === "MEMBER" ? "text-blue-600" : "text-gray-500"}`}
                    />
                    <span
                      className={`font-semibold ${withdrawalType === "MEMBER" ? "text-blue-700" : "text-gray-700"}`}
                    >
                      Individual Member
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Withdraw from personal account
                  </p>
                </div>

                <div
                  onClick={() => {
                    setWithdrawalType("INSTITUTION");
                    setMemberAccounts([]);
                    setSelectedAccount(null);
                  }}
                  className={`flex-1 p-3 border rounded-lg cursor-pointer transition-all ${withdrawalType === "INSTITUTION" ? "border-purple-500 bg-purple-50 ring-1 ring-purple-500" : "border-gray-200 hover:border-purple-300"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building
                      className={`h-4 w-4 ${withdrawalType === "INSTITUTION" ? "text-purple-600" : "text-gray-500"}`}
                    />
                    <span
                      className={`font-semibold ${withdrawalType === "INSTITUTION" ? "text-purple-700" : "text-gray-700"}`}
                    >
                      Institution
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Withdraw from institution account
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  {withdrawalType === "MEMBER"
                    ? "Select Member *"
                    : "Select Institution *"}
                </Label>
                <p className="text-xs text-gray-500">
                  {withdrawalType === "MEMBER"
                    ? "Only members with at least one withdrawable account are shown. Share accounts are excluded."
                    : "Only institutions with at least one withdrawable account are shown. Share accounts are excluded."}
                </p>

                {withdrawalType === "MEMBER" ? (
                  <Popover
                    open={memberSearchOpen}
                    onOpenChange={setMemberSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-auto min-h-[4rem] px-4 text-left border-2 hover:border-blue-300"
                      >
                        {selectedMember ? (
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              {selectedMember.user.image ? (
                                <img
                                  src={selectedMember.user.image}
                                  alt={selectedMember.user.name}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-lg">
                                {selectedMember.user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                #{selectedMember.memberNumber}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Search className="h-5 w-5" />
                            <span className="text-base">
                              Search and select a member...
                            </span>
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search by name, member number..."
                          className="h-12"
                        />
                        <CommandEmpty>
                          {membersWithWithdrawableAccounts.length === 0
                            ? "No members with withdrawable accounts available"
                            : "No members found"}
                        </CommandEmpty>
                        <CommandGroup className="max-h-80 overflow-y-auto">
                          {membersWithWithdrawableAccounts.map((member) => (
                            <CommandItem
                              key={member.id}
                              onSelect={() => {
                                setSelectedMember(member);
                                setValue("memberId", member.id);
                                setSelectedAccount(null);
                                setMemberAccounts(getWithdrawableAccounts(member));
                                setMemberSearchOpen(false);
                              }}
                              className="p-4 cursor-pointer"
                            >
                              <div className="flex items-center gap-4 w-full">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
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
                                <div className="flex-1">
                                  <h4 className="font-semibold">
                                    {member.user.name}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    #{member.memberNumber}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {member.user.email}
                                  </p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Popover
                    open={institutionSearchOpen}
                    onOpenChange={setInstitutionSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-auto min-h-[4rem] px-4 text-left border-2 hover:border-purple-300"
                      >
                        {selectedInstitution ? (
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                              <Building className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">
                                {selectedInstitution.institutionName ||
                                  selectedInstitution.user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {selectedInstitution.institutionNumber}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Search className="h-5 w-5" />
                            <span className="text-base">
                              Search institution...
                            </span>
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search institution..."
                          className="h-12"
                        />
                        <CommandEmpty>
                          {institutionsWithWithdrawableAccounts.length === 0
                            ? "No institutions with withdrawable accounts available"
                            : "No institution found."}
                        </CommandEmpty>
                        <CommandGroup className="max-h-80 overflow-y-auto">
                          {institutionsWithWithdrawableAccounts.map((inst) => (
                            <CommandItem
                              key={inst.id}
                              value={
                                inst.institutionName ||
                                inst.user.name ||
                                "Institution"
                              }
                              onSelect={() => {
                                setSelectedInstitution(inst);
                                setSelectedAccount(null);
                                setMemberAccounts(getWithdrawableAccounts(inst));
                                setInstitutionSearchOpen(false);
                                setVerifiedSignatories(new Set());
                                setVerifiedAgent(false);
                              }}
                              className="p-4 cursor-pointer"
                            >
                              <div className="flex items-center gap-4 w-full">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                                  <Building className="h-6 w-6 text-purple-600" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold">
                                    {inst.institutionName || inst.user.name}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {inst.institutionNumber}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {inst.user.email}
                                  </p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}

                {/* ── Institution details panel ── */}
                {withdrawalType === "MEMBER" && selectedMember && (
                  <div className="mt-4 space-y-4">
                    {selectedMemberFingerprintMissing ? (
                      <Alert className="border-amber-300 bg-amber-50">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <AlertDescription className="text-amber-900">
                          This member has no fingerprint enrolled yet. Please
                          ask the teller to update the member record and enroll
                          the fingerprint before processing the withdrawal.
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                window.open(
                                  `/dashboard/users/members/${selectedMember.id}/edit`,
                                  "_blank",
                                )
                              }
                            >
                              Open Member Update
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-blue-900">
                              Step 1.5: Authenticate Withdrawal
                            </h4>
                            <p className="text-sm text-blue-800 mt-1">
                              Choose an authentication method to verify this withdrawal.
                            </p>
                          </div>
                          <Badge
                            variant={
                              verificationMode === "fingerprint"
                                ? (fingerprintVerified ? "default" : "secondary")
                                : "default"
                            }
                          >
                            {verificationMode === "fingerprint" && fingerprintVerified
                              ? "Verified"
                              : "Pending"}
                          </Badge>
                        </div>

                        {/* Auth Method Selector */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedMemberHasFingerprint && (
                            <Button
                              type="button"
                              variant={verificationMode === "fingerprint" ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setVerificationMode("fingerprint");
                              }}
                              className="gap-1.5"
                            >
                              <Fingerprint className="h-4 w-4" />
                              Fingerprint
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant={verificationMode === "email" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setVerificationMode("email");
                              setFingerprintVerified(false);
                            }}
                            className="gap-1.5"
                          >
                            <Mail className="h-4 w-4" />
                            Email OTP
                          </Button>
                          <Button
                            type="button"
                            variant={verificationMode === "sms" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setVerificationMode("sms");
                              setFingerprintVerified(false);
                            }}
                            className="gap-1.5"
                          >
                            <Smartphone className="h-4 w-4" />
                            SMS OTP
                          </Button>
                        </div>

                        {/* Fingerprint scanner - only shown in fingerprint mode */}
                        {verificationMode === "fingerprint" && selectedMemberHasFingerprint && (
                          <>
                            <div className="mt-4">
                              <FingerprintScanner
                                label="Member Fingerprint Scan"
                                onCapture={handleFingerprintCapture}
                                onReset={() => {
                                  setFingerprintCapture(null);
                                  setFingerprintChecking(false);
                                  setFingerprintVerified(false);
                                  setFingerprintScore(null);
                                  setFingerprintError("");
                                  setVerificationMode("fingerprint");
                                }}
                                disabled={fingerprintChecking}
                              />
                            </div>

                            {fingerprintScore !== null && fingerprintVerified && (
                              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                                Fingerprint verified with score {fingerprintScore}/199.
                              </div>
                            )}

                            {fingerprintError && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-3">
                                <p>{fingerprintError}</p>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={useVerificationCodeFallback}
                                  >
                                    Use Verification Code Instead
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      setFingerprintCapture(null);
                                      setFingerprintError("");
                                      setFingerprintScore(null);
                                      setFingerprintVerified(false);
                                    }}
                                  >
                                    Retry Fingerprint
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Email OTP info */}
                        {verificationMode === "email" && (
                          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                            A verification code will be sent to the member's registered email address. The teller will enter the code in the next step.
                          </div>
                        )}

                        {/* SMS OTP info */}
                        {verificationMode === "sms" && (
                          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                            A verification code will be sent to the member's registered phone number via SMS. The teller will enter the code in the next step.
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

                {withdrawalType === "INSTITUTION" && selectedInstitution && (
                  <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2">
                    {/* Withdrawal mandate */}
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <Shield className="h-5 w-5 text-purple-700" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-purple-900 mb-1">
                            Withdrawal Mandate
                          </h4>
                          <p className="text-sm text-purple-800">
                            {selectedInstitution.withdrawalMandateText ||
                              `Mandate: ${selectedInstitution.withdrawalMandate?.replace(/_/g, " ") || "ALL SIGNATORIES REQUIRED"}`}
                          </p>
                          {selectedInstitution.withdrawalMandate && (
                            <div className="mt-2 flex items-center gap-2">
                              <Info className="h-4 w-4 text-purple-600" />
                              <span className="text-xs text-purple-700 font-medium">
                                {selectedInstitution.withdrawalMandate ===
                                  "ANY_1_SIGNATORY" &&
                                  "Any 1 signatory can authorize"}
                                {selectedInstitution.withdrawalMandate ===
                                  "ANY_2_SIGNATORIES" &&
                                  "Any 2 signatories must authorize"}
                                {selectedInstitution.withdrawalMandate ===
                                  "ANY_3_SIGNATORIES" &&
                                  "Any 3 signatories must authorize"}
                                {selectedInstitution.withdrawalMandate ===
                                  "ALL_SIGNATORIES" &&
                                  "All signatories must authorize"}
                                {selectedInstitution.withdrawalMandate ===
                                  "SPECIFIC_ROLES" &&
                                  "Specific roles must authorize"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Agent / Representative cross-check */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-blue-900">
                            Agent / Institution Representative
                          </h4>
                          <p className="text-sm text-blue-800">
                            Cross-check the representative photo before
                            proceeding. If no agent is involved, this can be
                            skipped.
                          </p>
                        </div>
                        <label className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-900">
                          <input
                            type="checkbox"
                            checked={verifiedAgent}
                            onChange={(e) => setVerifiedAgent(e.target.checked)}
                            className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                          Verified
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-blue-100 bg-white p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Photo On File
                          </p>
                          {agentPhoto ? (
                            <div className="h-20 w-full overflow-hidden rounded-lg border bg-gray-50">
                              <img
                                src={agentPhoto}
                                alt={agentName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-20 w-full border border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                              No agent photo on file
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg border border-blue-100 bg-white p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                            <PenLine className="h-3 w-3" />
                            Signature On File
                          </p>
                          <div className="h-20 w-full border border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                            No agent signature on file
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Signatory verification ── */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-base font-medium">
                          Verify Signatories *
                        </Label>
                        {verifiedSignatories.size > 0 && (
                          <span className="text-sm text-green-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            {verifiedSignatories.size} verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        For each required signatory: review the photo on file
                        and the stored signature specimen, then tick the
                        checkbox to confirm it matches.
                      </p>

                      <div className="space-y-3">
                        {selectedInstitution.signatories &&
                        selectedInstitution.signatories.length > 0 ? (
                          selectedInstitution.signatories.map((sig) => (
                            <SignatoryVerificationCard
                              key={sig.id}
                              signatoryId={sig.id}
                              signatoryName={sig.name}
                              signatoryTitle={sig.title}
                              isPrimary={sig.isPrimary}
                              photoImage={sig.photoImage || null}
                              storedSignatureImage={sig.signatureImage}
                              fingerprintTemplate={sig.fingerprintTemplate}
                              isVerified={verifiedSignatories.has(sig.id)}
                              onVerifiedChange={handleSignatoryVerified}
                              fingerprintState={signatoryFingerprintStates[sig.id]}
                              onFingerprintCapture={handleSignatoryFingerprintCapture}
                              onFingerprintReset={handleSignatoryFingerprintReset}
                            />
                          ))
                        ) : (
                          <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                            No signatories found for this institution. Please
                            add signatories in the Institution Management
                            section.
                          </div>
                        )}
                      </div>

                      {/* Mandate progress */}
                      {selectedInstitution.signatories &&
                        selectedInstitution.signatories.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {(() => {
                              const required = getMandateRequirement();
                              const verified = verifiedSignatories.size;
                              if (verified < required) {
                                return (
                                  <p className="text-sm text-orange-600 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    {verified}/{required} required signatories
                                    verified
                                  </p>
                                );
                              }
                              if (!verifiedAgent) {
                                return (
                                  <p className="text-sm text-orange-600 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    Please verify the institution
                                    representative/agent
                                  </p>
                                );
                              }
                              return (
                                <p className="text-sm text-green-600 flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" />
                                  Mandate satisfied - {verified} signator
                                  {verified > 1 ? "ies" : "y"} verified
                                </p>
                              );
                            })()}
                          </div>
                        )}
                    </div>

                    {/* Recipient information */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-blue-900">
                          Recipient Information
                        </h4>
                      </div>
                      <p className="text-sm text-blue-800 mb-3">
                        Enter details of the person physically receiving the
                        money.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium">
                            Recipient Name *
                          </Label>
                          <Input
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="Full name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            ID Number *
                          </Label>
                          <Input
                            value={recipientIdNumber}
                            onChange={(e) =>
                              setRecipientIdNumber(e.target.value)
                            }
                            placeholder="National ID or Passport"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Phone Number *
                          </Label>
                          <Input
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            placeholder="07XXXXXXXX"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Relationship to Institution *
                          </Label>
                          <select
                            value={recipientRelation}
                            onChange={(e) =>
                              setRecipientRelation(e.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select relationship</option>
                            <option value="Signatory">Signatory</option>
                            <option value="Authorized Agent">
                              Authorized Agent
                            </option>
                            <option value="Employee">Employee</option>
                            <option value="Board Member">Board Member</option>
                            <option value="Treasurer">Treasurer</option>
                            <option value="Secretary">Secretary</option>
                            <option value="Chairperson">Chairperson</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Steps 2 & 3 (shown only when owner + institution sigs are ready) ── */}
            {(selectedMember ||
              (selectedInstitution &&
                (withdrawalType === "MEMBER" || selectedSignatory))) && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Step 2: Select Account
                    </h3>
                  </div>
                  <FormSelectInput
                    label="Account"
                    options={accountOptions}
                    option={selectedAccount}
                    setOption={(option) => {
                      setSelectedAccount(option);
                      setValue("accountId", option?.value || "");
                      // Reset joint member verification when account changes
                      setVerifiedJointMembers(new Set());
                      setJointMemberFingerprintStates({});
                    }}
                    toolTipText="Select the account to withdraw from"
                  />
                  {selectedAccount && getSelectedAccount() && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">
                            Current Balance
                          </p>
                          <p className="text-lg font-bold text-blue-900">
                            {formatCurrency(getSelectedAccount()?.balance || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            Available to Withdraw
                          </p>
                          <p className="text-lg font-bold text-green-700">
                            {formatCurrency(getAvailableWithdrawal())}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Joint Savings: Joint Member Verification */}
                {withdrawalType === "MEMBER" &&
                  selectedAccount &&
                  getSelectedAccount() &&
                  isJointSavingsAccountType(getSelectedAccount()!.accountType) &&
                  (() => {
                    const account = getSelectedAccount()!;
                    const jointMembers = account.jointMembers || [];
                    return jointMembers.length > 0 ? (
                      <div className="space-y-4 mt-6 p-4 border border-amber-200 rounded-lg bg-amber-50">
                        <div className="flex items-center gap-2 pb-2 border-b border-amber-200">
                          <Shield className="h-5 w-5 text-amber-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            Joint Account Verification
                          </h3>
                          <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-300">
                            {verifiedJointMembers.size}/{jointMembers.length} Verified
                          </Badge>
                        </div>
                        <p className="text-sm text-amber-700">
                          All joint account holders must verify this withdrawal.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {jointMembers.map((jm) => {
                            const fpState = jointMemberFingerprintStates[jm.memberId];
                            const isVerified = verifiedJointMembers.has(jm.memberId);
                            return (
                              <div
                                key={jm.id}
                                className={`flex flex-col gap-3 p-4 rounded-lg border ${
                                  isVerified
                                    ? "border-green-300 bg-green-50"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
                                      {jm.member.user.image ? (
                                        <img
                                          src={jm.member.user.image}
                                          alt={jm.member.user.name}
                                          className="h-10 w-10 object-cover"
                                        />
                                      ) : (
                                        <User className="h-5 w-5 text-amber-600" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">
                                        {jm.member.user.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        #{jm.member.memberNumber}
                                      </p>
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isVerified}
                                    onChange={(e) =>
                                      handleJointMemberVerified(
                                        jm.memberId,
                                        e.target.checked,
                                      )
                                    }
                                    className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                  />
                                </div>

                                {/* Fingerprint verification for joint member */}
                                {!fpState?.captured ? (
                                  <div className="flex items-center gap-2">
                                    <FingerprintScanner
                                      onCapture={(capture) =>
                                        handleJointMemberFingerprintCapture(
                                          jm.memberId,
                                          capture,
                                        )
                                      }
                                    />
                                    {isVerified && !fpState?.captured && (
                                      <span className="text-xs text-amber-600">
                                        (verified manually)
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-green-600">
                                      Fingerprint verified (score: {fpState.score})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleJointMemberFingerprintReset(
                                          jm.memberId,
                                        )
                                      }
                                      className="text-xs text-red-500 hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Step 3: Withdrawal Details
                    </h3>
                  </div>

                  <TextInput
                    register={register}
                    errors={errors}
                    label="Amount"
                    name="amount"
                    type="number"
                    placeholder="Enter amount"
                  />

                  {Number(watchedAmount) > 0 && selectedAccount && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Withdrawal Fee:</span>
                        <span>{formatCurrency(getWithdrawalFee())}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
                        <span>Total Deduction:</span>
                        <span>
                          {formatCurrency(
                            Number(watchedAmount) + getWithdrawalFee(),
                          )}
                        </span>
                      </div>
                      {Number(watchedAmount) + getWithdrawalFee() >
                        getAvailableWithdrawal() && (
                        <div className="text-red-600 text-xs mt-1 font-medium">
                          Total deduction exceeds available balance (
                          {formatCurrency(getAvailableWithdrawal())})
                        </div>
                      )}
                    </div>
                  )}

                  <FormSelectInput
                    label="Channel"
                    options={channelOptions}
                    option={selectedChannel}
                    setOption={(option) => {
                      setSelectedChannel(option);
                      setValue("channel", option?.value || "");
                    }}
                    toolTipText="Select withdrawal channel"
                  />

                  {selectedChannel?.value === "Mobile Money" && (
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Mobile Money Reference"
                      name="mobileMoneyRef"
                      placeholder="Enter mobile money reference"
                    />
                  )}

                  <div>
                    <Label>Description (Optional)</Label>
                    <Textarea
                      {...register("description")}
                      placeholder="Enter withdrawal description..."
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <SubmitButton
                    title={
                      !hasValidFloat() && ["TELLER", "AGENT"].includes(userRole)
                        ? "Request Float First"
                        : "Create Withdrawal Request"
                    }
                    loading={loading}
                    loadingTitle="Processing..."
                    className="w-full"
                    disabled={!canSubmitForm()}
                  />

                  {!canSubmitForm() &&
                    selectedAccount &&
                    selectedChannel &&
                    watchedAmount && (
                      <div className="mt-3 text-center">
                        <p className="text-sm text-red-600">
                          {!hasValidFloat() &&
                          ["TELLER", "AGENT"].includes(userRole)
                            ? "You need to request float from your accountant before processing withdrawals"
                            : Number(watchedAmount) > getAvailableWithdrawal()
                              ? `Amount exceeds available balance of ${formatCurrency(getAvailableWithdrawal())}`
                              : needsFloatValidation() && !isFloatAmountValid()
                                ? `Insufficient float balance. Need ${formatCurrency(getFloatShortage())} more`
                                : withdrawalType === "INSTITUTION" &&
                                    !verifiedAgent
                                  ? "Verify the institution representative/agent"
                                  : "Please fill all required fields correctly"}
                        </p>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        </form>
      )}
    </>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <KeyRound className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-gray-900">
            Verification Required
          </h3>
          <p className="text-gray-600 mt-2">
            A verification code has been sent to the member
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-orange-600">
          <Clock className="h-5 w-5" />
          <span className="text-lg font-semibold">
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {verificationData && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Member:</span>
              <span className="font-semibold">
                {verificationData.member.user.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account:</span>
              <span className="font-semibold">
                {verificationData.account.accountNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="font-semibold text-lg text-blue-600">
                {formatCurrency(verificationData.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Withdrawal Fee:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(verificationData.fee || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="text-sm font-bold text-gray-700">
                Total Deduction:
              </span>
              <span className="font-bold text-red-600">
                {formatCurrency(
                  verificationData.totalDeduction ??
                    (verificationData.amount || 0) +
                      (verificationData.fee || 0),
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Channel:</span>
              <Badge>{verificationData.channel}</Badge>
            </div>
          </div>

          <Alert className="border-blue-300 bg-blue-50">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="space-y-2">
                <p className="font-semibold">Verification code sent to:</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">
                    {verificationData.member.user.email}
                  </span>
                </div>
                {verificationData.member.user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">
                      {verificationData.member.user.phone}
                    </span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {!verificationData.emailSent && !verificationData.smsSent && (
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                The verification code was created, but it was not delivered by
                email or SMS. Check your email sender configuration before
                retrying.
              </AlertDescription>
            </Alert>
          )}

          {verificationData.debugVerificationCode && (
            <Alert className="border-amber-300 bg-amber-50">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-900">
                Development fallback code:{" "}
                <span className="font-mono font-bold tracking-widest">
                  {verificationData.debugVerificationCode}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Enter Verification Code</Label>
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentStep(WithdrawalStep.FORM);
                setVerificationData(null);
                setVerificationCode("");
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={processVerifiedWithdrawal}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? "Verifying..." : "Verify & Process"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompletedStep = () => (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 animate-pulse">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-semibold text-gray-900">
          Withdrawal Successful!
        </h3>
        <p className="text-gray-600">
          The withdrawal has been processed successfully
        </p>
      </div>
      {verificationData && (
        <div className="p-6 bg-green-50 rounded-lg border border-green-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Member:</span>
            <span className="font-semibold">
              {verificationData.member.user.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Amount Withdrawn:</span>
            <span className="font-bold text-xl text-green-700">
              {formatCurrency(verificationData.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Channel:</span>
            <Badge variant="outline">{verificationData.channel}</Badge>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-500">
        This window will close automatically...
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleReset}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <TrendingDown className="h-6 w-6 text-red-600 " />
            Process Withdrawal
          </DialogTitle>
          <DialogDescription>
            {currentStep === WithdrawalStep.FORM &&
              "Select member and enter withdrawal details"}
            {currentStep === WithdrawalStep.VERIFICATION &&
              "Enter verification code to complete withdrawal"}
            {currentStep === WithdrawalStep.COMPLETED &&
              "Withdrawal completed successfully"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {showPermissionError && renderPermissionError()}
          {!showPermissionError &&
            currentStep === WithdrawalStep.FORM &&
            renderFormStep()}
          {!showPermissionError &&
            currentStep === WithdrawalStep.VERIFICATION &&
            renderVerificationStep()}
          {!showPermissionError &&
            currentStep === WithdrawalStep.COMPLETED &&
            renderCompletedStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
