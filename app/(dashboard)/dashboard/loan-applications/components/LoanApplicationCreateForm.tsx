// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  User,
  CreditCard,
  DollarSign,
  Calculator,
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  CalendarDays,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Users,
  Banknote,
  Smartphone,
  FileSignature,
  AlertTriangle,
  Percent,
  Shield,
  XCircle,
  Info,
  MinusCircle,
  Printer,
  ArrowUpRight,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TextInput from "@/components/FormInputs/TextInput";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import {
  LoanApplicationCreateDTO,
  calculateLoanDetails,
  computeDTI,
} from "@/types/loanApplication";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useInterestConfig } from "@/hooks/useInterestConfig";

interface MemberAccount {
  id: string;
  accountNumber: string;
  balance: number;
  accountType: {
    name: string;
    isShareAccount: boolean;
    canWithdraw: boolean;
  };
}

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
    image: string | null;
  };
  accounts: MemberAccount[];
  occupation: string | null;
  employer: string | null;
  surname: string | null;
  otherNames: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  interestPeriod: "MONTHLY" | "ANNUAL";
  description: string | null;
}

// In your form component
interface ExistingLoan {
  id: string;
  amountGranted: number;
  totalAmountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  ledgerOutstandingBalance?: number;
  ledgerBalancePrincipal?: number;
  ledgerBalanceInterest?: number;
  ledgerLastTransactionDate?: Date | string | null;
  penaltyCharged?: number;
  penaltyPaid?: number;
  status: string;
  disbursementDate: Date;
  dueDate: Date;
  interestRate: number;
  loanApplication: {
    id: string;
    purpose: string | null;
    applicationDate: Date;
    loanProduct: {
      id: string;
      name: string;
      interestRate: number;
      repaymentPeriodDays: number;
    };
    allocatedTeller: {
      id: string;
      name: string;
    } | null;
  } | null;
  remainingScheduleBreakdown?: {
    principal: number;
    interest: number;
    penalty: number;
    total: number;
    installmentsRemaining: number;
    nextDueDate: Date | string | null;
    schedules: Array<{
      period: number | null;
      dueDate: Date | string | null;
      principal: number;
      interest: number;
      total: number;
    }>;
  };
}

type Option = { label: string; value: string };

interface MemberLoanApplicationFormContentProps {
  currentUserId: string;
  onSuccess?: () => void;
}
// Helper function for formatting currency:
const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(n || 0);

const collateralTypes = [
  { label: "Land", value: "LAND" },
  { label: "Building/Property", value: "BUILDING" },
  { label: "Vehicle", value: "VEHICLE" },
  { label: "Equipment/Machinery", value: "EQUIPMENT" },
  { label: "Salary (Payroll Deduction)", value: "SALARY" },
  { label: "Savings/Fixed Deposit", value: "SAVINGS" },
  { label: "Other", value: "OTHER" },
];
// Required calculations (add these to your component):
const calculateDeductions = () => {
  const loanAmount = netLoanCalculation.netAmount; // Or use Number(watched.amountApplied) if no outstanding balance

  const processingFee = watched.applyLoanProcessingFee
    ? loanAmount * ((watched.loanProcessingFeePercentage || 1) / 100)
    : 0;

  const insurance = watched.applyLoanInsurance
    ? loanAmount * ((watched.loanInsurancePercentage || 1.5) / 100)
    : 0;

  const share = watched.applyShareDeduction
    ? Number(watched.shareAmount || 20000)
    : 0;

  const totalDeductions = processingFee + insurance + share;
  const netDisbursement = loanAmount - totalDeductions;

  return {
    processingFee,
    insurance,
    share,
    totalDeductions,
    netDisbursement,
    loanAmount,
  };
};

export default function MemberLoanApplicationFormContent({
  currentUserId,
  onSuccess,
}: MemberLoanApplicationFormContentProps) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoanApplicationCreateDTO>({
    defaultValues: {
      guarantors: [{ fullName: "" }, { fullName: "" }],
      hasExistingLoanWithSacco: false,
      hasOtherLoansWithInstitutions: false,
      applicantDeclaration: false,
      guarantorAgreementAccepted: false,
      applyLoanProcessingFee: false,
      loanProcessingFeePercentage: 1,
      applyLoanInsurance: false,
      loanInsurancePercentage: 1.5,
      applyShareDeduction: false,
      shareAmount: 20000,
      applyLoanApplicationFee: false,
      loanApplicationFeePercentage: 1,
      applyLoanStationeryFee: false,
      loanStationeryFeeAmount: 10000,
      applyLoanCommitmentFee: false,
      loanCommitmentFeePercentage: 0.5,
      repaymentPeriodMonths: 1,
    },
  });
  // const deductions = calculateDeductions();

  // Required default values for react-hook-form:
  const defaultValues = {
    // ... other defaults
    hasOtherLoansWithInstitutions: false,
    otherMonthlyObligations: "",
    applyLoanProcessingFee: false,
    loanProcessingFeePercentage: 1,
    applyLoanInsurance: false,
    loanInsurancePercentage: 1.5,
    applyShareDeduction: false,
    shareAmount: 20000,
    applyLoanApplicationFee: false,
    loanApplicationFeePercentage: 1,
    applyLoanStationeryFee: false,
    loanStationeryFeeAmount: 10000,
    applyLoanCommitmentFee: false,
    loanCommitmentFeePercentage: 0.5,
  };
  const {
    fields: guarantorFields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: "guarantors",
  });

  const [loading, setLoading] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedLoanProduct, setSelectedLoanProduct] = useState<Option | null>(
    null
  );
  const [selectedCollateralType, setSelectedCollateralType] =
    useState<Option | null>(null);
  const [selectedInterestType, setSelectedInterestType] =
    useState<Option | null>(null);
  const [existingLoans, setExistingLoans] = useState<ExistingLoan[]>([]);
  const [deductionNoticeExpanded, setDeductionNoticeExpanded] = useState(false);
  const [expandedDeductionLoans, setExpandedDeductionLoans] = useState<
    Record<string, boolean>
  >({});
  const [filteredAccounts, setFilteredAccounts] = useState<MemberAccount[]>([]);
  const [memberAccounts, setMemberAccounts] = useState<MemberAccount[]>([]);
  const [loadingMemberBalance, setLoadingMemberBalance] = useState(false);
  const [guarantorSearchOpen, setGuarantorSearchOpen] = useState<{
    [key: number]: boolean;
  }>({});

  const router = useRouter();
  const watched = watch();
  const { config: interestConfig, loading: configLoading } = useInterestConfig();

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const toggleDeductionLoan = (loanId: string) => {
    setExpandedDeductionLoans((current) => ({
      ...current,
      [loanId]: !current[loanId],
    }));
  };

  const getFilteredAccounts = (accounts: MemberAccount[]) => {
    const insuranceKeywords = [
      "insurance",
      "loan insurance pool",
      "sacco insurance",
    ];
    return accounts.filter((acc) => {
      const typeName = acc.accountType?.name?.toLowerCase() || "";
      const isInsurance = insuranceKeywords.some((kw) =>
        typeName.includes(kw)
      );
      const isVoluntarySavings =
        typeName.includes("voluntary savings") ||
        typeName.includes("voluntary savings account");
      return (
        !acc.accountType?.isShareAccount &&
        acc.accountType?.canWithdraw &&
        !isInsurance &&
        !isVoluntarySavings
      );
    });
  };

  const getPrimarySavingsAccount = (accounts: MemberAccount[]) => {
    const regularAccounts = getFilteredAccounts(accounts);
    if (regularAccounts.length > 0) return regularAccounts[0];
    // Fall back: any non-share withdrawable account (including voluntary savings)
    return accounts.find(
      (acc) => !acc.accountType?.isShareAccount && acc.accountType?.canWithdraw
    ) || null;
  };

  const isVoluntarySavingsAccount = (account: MemberAccount | null) => {
    if (!account) return false;
    const name = account.accountType?.name?.toLowerCase() || "";
    return name.includes("voluntary savings");
  };

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      loadMemberLoans(selectedMember.id);
      loadMemberBalance(selectedMember.id);
    } else {
      setExistingLoans([]);
      setFilteredAccounts([]);
      setMemberAccounts([]);
    }
  }, [selectedMember]);

  async function loadMemberBalance(memberId: string) {
    try {
      setLoadingMemberBalance(true);
      const res = await fetch(`/api/v1/members/${memberId}`);
      const data = await res.json();
      const accounts: MemberAccount[] = (data?.data?.accounts ?? data?.accounts ?? []).map((a: any) => ({
        id: a.id,
        accountNumber: a.accountNumber,
        balance: Number(a.balance ?? 0),
        accountType: {
          name: a.accountType?.name ?? "",
          isShareAccount: a.accountType?.isShareAccount ?? false,
          canWithdraw: a.accountType?.canWithdraw ?? false,
        },
      }));
      setMemberAccounts(accounts);
      setFilteredAccounts(getFilteredAccounts(accounts));
    } catch {
      // non-fatal — balance display best-effort
    } finally {
      setLoadingMemberBalance(false);
    }
  }

  async function loadFormData() {
    try {
      const [membersRes, productsRes] = await Promise.all([
        fetch("/api/v1/members?eligible=true"),
        fetch("/api/v1/loans/products"),
      ]);
      const mData = await membersRes.json();
      const pData = await productsRes.json();
      setMembers(mData.data || []);
      setLoanProducts(pData.data || pData || []);
    } catch (e) {
      console.error("Failed to load form data:", e);
      toast.error("Failed to load form data");
    }
  }

  async function loadMemberLoans(memberId: string) {
    try {
      setLoadingLoans(true);
      const response = await fetch(`/api/v1/loans?memberId=${memberId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch loan history from server");
      }
      const loans = result.data || [];

      const validLoans = loans.filter(
        (loan: any) =>
          loan && loan.loanApplication && loan.loanApplication.loanProduct
      );

      const activeRelevantLoans = validLoans.filter((loan: any) => {
        const currentOutstanding =
          loan.ledgerOutstandingBalance ?? loan.outstandingBalance ?? 0;
        return (
          ["APPROVED", "DISBURSED", "OVERDUE"].includes(loan.status) &&
          currentOutstanding > 0
        );
      });

      setExistingLoans(activeRelevantLoans as ExistingLoan[]);

      const hasActiveLoans = activeRelevantLoans.some(
        (loan: any) =>
          loan.status === "APPROVED" ||
          loan.status === "DISBURSED" ||
          loan.status === "OVERDUE"
      );
      setValue("hasExistingLoanWithSacco", hasActiveLoans);
    } catch (e) {
      console.error("Error loading member loans:", e);
      toast.error("Failed to load loan history", {
        description: e instanceof Error ? e.message : "Possible network or server error",
      });
    } finally {
      setLoadingLoans(false);
    }
  }

  const productOptions: Option[] = loanProducts.map((p) => ({
    label: `${p.name} - ${p.interestRate}% (${fmt(p.minAmount)} - ${fmt(
      p.maxAmount
    )})`,
    value: p.id,
  }));

  const product =
    loanProducts.find((p) => p.id === selectedLoanProduct?.value) || null;

  const getCurrentOutstanding = (loan: ExistingLoan) =>
    loan.ledgerOutstandingBalance ?? loan.outstandingBalance ?? 0;

  const getLedgerSummary = (loan: ExistingLoan) => ({
    principal:
      loan.ledgerBalancePrincipal ??
      Math.max(0, (loan.amountGranted || 0) - (loan.principalPaid || 0)),
    interest:
      loan.ledgerBalanceInterest ??
      Math.max(
        0,
        ((loan.totalAmountDue || 0) - (loan.amountGranted || 0)) -
          (loan.interestPaid || 0),
      ),
    penalty: Math.max(0, (loan.penaltyCharged || 0) - (loan.penaltyPaid || 0)),
    total: getCurrentOutstanding(loan),
    lastTransactionDate: loan.ledgerLastTransactionDate,
  });

  // FIXED ORDER: Calculate eligibility first
  const checkLoanEligibility = () => {
    // Backend logic: [LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.OVERDUE]
    const activeLoans = existingLoans.filter(
      (loan) => 
        loan.status === "APPROVED" || 
        loan.status === "DISBURSED" || 
        loan.status === "OVERDUE"
    );

    const overdueLoans = existingLoans.filter(
      (loan) => loan.status === "OVERDUE"
    );

    const totalOutstanding = activeLoans.reduce(
      (sum, loan) => sum + getCurrentOutstanding(loan),
      0
    );

    const hasOverdueLoans = overdueLoans.length > 0;
    const hasActiveLoans = activeLoans.length > 0;

    // Strict rule: No active loans allowed? 
    // CHANGE: Allow active loans because we have Top-Up/Refinancing logic
    // that creates a deduction for outstanding balances.
    // We only block OVERDUE loans.
    const isEligible = !hasOverdueLoans; 

    return {
      isEligible,
      hasActiveLoans,
      hasOverdueLoans,
      activeLoansCount: activeLoans.length,
      overdueLoansCount: overdueLoans.length,
      totalOutstanding,
      reasons: [
        ...(hasOverdueLoans
          ? ["Member has overdue loans that must be cleared first"]
          : []),
        // NOTE: We no longer block for active loans because we deduct them.
      ],
    };
  };

  const eligibility = checkLoanEligibility();

  // Now calculate net loan amount (uses eligibility)
  const calculateNetLoanAmount = () => {
    const requestedAmount = Number(watched.amountApplied) || 0;
    const outstandingBalance = eligibility.totalOutstanding;

    if (requestedAmount <= 0) return { netAmount: 0, deduction: 0 };

    const deduction = Math.min(requestedAmount, outstandingBalance);
    const netAmount = Math.max(0, requestedAmount - outstandingBalance);

    return {
      netAmount,
      deduction,
      hasDeduction: outstandingBalance > 0 && requestedAmount > 0,
    };
  };

  const netLoanCalculation = calculateNetLoanAmount();

  const calc = (() => {
    // Client Requirement: Interest on requested amount (amountApplied) 
    // and not strictly on netAmount (after existing loan deduction)
    const amount = Number(watched.amountApplied) || 0;
    
    // BUGFIX: Use only the user's selected period, not the product's max period
    // The user must explicitly select their desired repayment period
    const periodMonths = Number(watched.repaymentPeriodMonths) || 1;
    
    if (!amount || amount <= 0) return null;
    
    // Use interest configuration if available, otherwise use product defaults
    // Product stores ANNUAL rate (e.g. 30% p.a.), but calculateLoanDetails expects MONTHLY rate (e.g. 2.5%)
    const annualRate = product?.interestRate || interestConfig?.defaultLoanInterestRate || 24;
    const monthlyRate = annualRate / 12;
    const interestType = watched.interestType || 
      product?.interestType || 
      interestConfig?.defaultInterestType || 
      "FLAT_RATE";
    
    return calculateLoanDetails(
      amount,
      monthlyRate,
      periodMonths,
      interestType
    );
  })();

  const dti =
    calc && watched.netMonthlyIncome
      ? computeDTI(calc.monthlyPayment, Number(watched.netMonthlyIncome))
      : undefined;

  const calculateDeductions = () => {
    // Client Requirement: Deductions on requested amount (amountApplied)
    const loanAmount = Number(watched.amountApplied) || 0;

    const processingFee = watched.applyLoanProcessingFee
      ? loanAmount * ((watched.loanProcessingFeePercentage || 1) / 100)
      : 0;

    const insurance = watched.applyLoanInsurance
      ? loanAmount * ((watched.loanInsurancePercentage || 1.5) / 100)
      : 0;

    const share = watched.applyShareDeduction
      ? Number(watched.shareAmount || 20000)
      : 0;

    const applicationFee = watched.applyLoanApplicationFee
      ? loanAmount * ((watched.loanApplicationFeePercentage || 1) / 100)
      : 0;

    const stationeryFee = watched.applyLoanStationeryFee
      ? Number(watched.loanStationeryFeeAmount || 10000)
      : 0;

    const commitmentFee = watched.applyLoanCommitmentFee
      ? loanAmount * ((watched.loanCommitmentFeePercentage || 0.5) / 100)
      : 0;

    const totalDeductions = processingFee + insurance + share + applicationFee + stationeryFee + commitmentFee;
    const netDisbursement = netLoanCalculation.netAmount - totalDeductions;

    return {
      processingFee,
      insurance,
      share,
      applicationFee,
      stationeryFee,
      commitmentFee,
      totalDeductions,
      netDisbursement,
      loanAmount,
    };
  };

  const calculateLTV = () => {
    const loanAmount = netLoanCalculation.netAmount;
    const forcedSaleValue = Number(watched.forcedSaleValue) || 0;

    if (forcedSaleValue === 0) return 0;
    return ((loanAmount / forcedSaleValue) * 100).toFixed(1);
  };

  const calculateFSVRatio = () => {
    const marketValue = Number(watched.collateralValue) || 0;
    const forcedSaleValue = Number(watched.forcedSaleValue) || 0;

    if (marketValue === 0) return 0;
    return ((forcedSaleValue / marketValue) * 100).toFixed(1);
  };

  const deductions = calculateDeductions();
  const ltv = calculateLTV();
  const fsvRatio = calculateFSVRatio();

  const isRepaymentPeriodValid = () => {
    if (!product || !watched.repaymentPeriodMonths) return true;
    const maxMonths = Math.round(product.repaymentPeriodDays / 30);
    const period = Number(watched.repaymentPeriodMonths);
    return period >= 1 && period <= maxMonths;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "DISBURSED":
        return "bg-blue-100 text-blue-800";
      case "REPAID":
        return "bg-green-100 text-green-800";
      case "OVERDUE":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "REPAID":
        return "Paid Off";
      case "DISBURSED":
        return "Active";
      default:
        return status;
    }
  };

  async function save(data: LoanApplicationCreateDTO) {
    try {
      setLoading(true);
      if (!selectedMember || !selectedLoanProduct) {
        toast.error("Please select both member and loan product");
        setLoading(false);
        return;
      }

      if (!eligibility.isEligible) {
        toast.error("Member is not eligible for a new loan", {
          description: eligibility.reasons.join(". "),
        });
        setLoading(false);
        return;
      }

      if (netLoanCalculation.netAmount <= 0) {
        toast.error("Invalid Loan Amount", {
          description:
            "The requested loan amount is less than or equal to the outstanding balance. Please increase the loan amount.",
        });
        setLoading(false);
        return;
      }

      if (product && data.repaymentPeriodMonths) {
        const maxMonths = Math.round(product.repaymentPeriodDays / 30);
        if (Number(data.repaymentPeriodMonths) > maxMonths) {
          toast.error("Invalid Repayment Period", {
            description: `Repayment period cannot exceed ${maxMonths} months for this loan product`,
          });
          setLoading(false);
          return;
        }
        if (Number(data.repaymentPeriodMonths) < 1) {
          toast.error("Invalid Repayment Period", {
            description: "Repayment period must be at least 1 month",
          });
          setLoading(false);
          return;
        }
      }

      if (!data.applicantDeclaration) {
        toast.error("Please accept the applicant declaration");
        setLoading(false);
        return;
      }

      if (!data.guarantorAgreementAccepted) {
        toast.error("Please accept the guarantor agreement");
        setLoading(false);
        return;
      }

      const safeNumber = (val: any) => {
        if (val === "" || val === null || val === undefined) return undefined;
        const n = Number(val);
        return isNaN(n) ? undefined : n;
      };

      const payload: LoanApplicationCreateDTO = {
        memberId: selectedMember.id,
        loanProductId: selectedLoanProduct.value,
        amountApplied: safeNumber(data.amountApplied) || 0,
        loanOfficerId: currentUserId?.trim() || undefined,

        employer: data.employer?.trim() || undefined,
        employmentStatus: data.employmentStatus?.trim() || undefined,
        grossMonthlyIncome: safeNumber(data.grossMonthlyIncome),
        netMonthlyIncome: safeNumber(data.netMonthlyIncome),

        repaymentPeriodMonths: safeNumber(data.repaymentPeriodMonths),
        repaymentStartDate: data.repaymentStartDate || undefined,
        modeOfRepayment: data.modeOfRepayment?.trim() || undefined,
        interestType: (selectedInterestType?.value as "FLAT_RATE" | "REDUCING_BALANCE") || undefined,
        interestPeriod: product?.interestPeriod || undefined,

        guarantors: (data.guarantors || [])
          .filter((g) => g?.fullName?.trim())
          .map((g) => ({
            fullName: g.fullName.trim(),
            membershipNumber: g.membershipNumber?.trim(),
            phone: g.phone?.trim(),
            relationship: g.relationship?.trim(),
            monthlyIncome: safeNumber(g.monthlyIncome),
          })),

        hasExistingLoanWithSacco: data.hasExistingLoanWithSacco || false,
        existingLoanBalance:
          data.hasExistingLoanWithSacco && eligibility.totalOutstanding > 0
            ? eligibility.totalOutstanding
            : undefined,
        hasOtherLoansWithInstitutions:
          data.hasOtherLoansWithInstitutions || false,
        otherLoanInstitutionName:
          data.hasOtherLoansWithInstitutions && data.otherLoanInstitutionName
            ? data.otherLoanInstitutionName.trim()
            : undefined,
        otherLoanBalance:
          data.hasOtherLoansWithInstitutions
            ? safeNumber(data.otherLoanBalance)
            : undefined,
        otherLoanMonthlyInstallment:
          data.hasOtherLoansWithInstitutions
            ? safeNumber(data.otherLoanMonthlyInstallment)
            : undefined,
        otherMonthlyObligations:
          data.otherMonthlyObligations?.trim() || undefined,

        applyLoanProcessingFee: data.applyLoanProcessingFee || false,
        loanProcessingFeePercentage: data.applyLoanProcessingFee
          ? safeNumber(data.loanProcessingFeePercentage) || 1
          : undefined,
        applyLoanInsurance: data.applyLoanInsurance || false,
        loanInsurancePercentage: data.applyLoanInsurance
          ? safeNumber(data.loanInsurancePercentage) || 1.5
          : undefined,
        applyShareDeduction: data.applyShareDeduction || false,
        shareAmount: data.applyShareDeduction
          ? safeNumber(data.shareAmount) || 20000
          : undefined,
        applyLoanApplicationFee: data.applyLoanApplicationFee || false,
        loanApplicationFeePercentage: data.applyLoanApplicationFee
          ? safeNumber(data.loanApplicationFeePercentage) || 1
          : undefined,
        applyLoanStationeryFee: data.applyLoanStationeryFee || false,
        loanStationeryFeeAmount: data.applyLoanStationeryFee
          ? safeNumber(data.loanStationeryFeeAmount) || 10000
          : undefined,
        applyLoanCommitmentFee: data.applyLoanCommitmentFee || false,
        loanCommitmentFeePercentage: data.applyLoanCommitmentFee
          ? safeNumber(data.loanCommitmentFeePercentage) || 0.5
          : undefined,

        collateralType: selectedCollateralType?.value || undefined,
        collateralValue: safeNumber(data.collateralValue),
        forcedSaleValue: safeNumber(data.forcedSaleValue),
        collateralLocation: data.collateralLocation?.trim() || undefined,
        collateralDetails: data.collateralDetails?.trim() || undefined,

        applicantDeclaration: data.applicantDeclaration,
        applicantSignature: data.applicantSignature?.trim() || undefined,
        applicantSignatureDate: new Date(),
        guarantorAgreementAccepted: data.guarantorAgreementAccepted,
        guarantorSignatureDate: new Date(),

        debtToIncomeRatio: isNaN(Number(dti)) ? undefined : Number(dti),
      };

      const response = await fetch("/api/v1/loans/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const res = await response.json();

      if (!response.ok) {
        console.error("Loan submission failed:", res);
        // Extract validation errors if available (Zod format)
        let detailedError = res.error || res.message || "An unexpected error occurred";
        if (res.errors && Array.isArray(res.errors)) {
             detailedError = res.errors.map((e: any) => `${e.path}: ${e.message}`).join(", ");
        }
        
        toast.error("Failed to Create Loan Application", {
          description: detailedError,
        });
        setLoading(false);
        return;
      }

      toast.success("Loan Application Created Successfully!", {
        description: netLoanCalculation.hasDeduction
          ? `Application for ${fmt(
              payload.amountApplied
            )} submitted. Projected net disbursement after previous-loan deduction: ${fmt(
              netLoanCalculation.netAmount
            )}`
          : `Application for ${fmt(
              payload.amountApplied
            )} submitted for ${selectedMember.user.name}`,
      });

      reset({
        guarantors: [{ fullName: "" }, { fullName: "" }],
        hasExistingLoanWithSacco: false,
        hasOtherLoansWithInstitutions: false,
        applicantDeclaration: false,
        guarantorAgreementAccepted: false,
        applyLoanProcessingFee: false,
        loanProcessingFeePercentage: 1,
        applyLoanInsurance: false,
        loanInsurancePercentage: 1.5,
        applyShareDeduction: false,
        shareAmount: 20000,
        applyLoanApplicationFee: false,
        loanApplicationFeePercentage: 1,
        applyLoanStationeryFee: false,
        loanStationeryFeeAmount: 10000,
        applyLoanCommitmentFee: false,
        loanCommitmentFeePercentage: 0.5,
      });
      setSelectedMember(null);
      setSelectedLoanProduct(null);
      setSelectedCollateralType(null);
      setSelectedInterestType(null);
      setExistingLoans([]);

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-statistics"] });

      if (onSuccess) onSuccess();
      if (res.id) router.push(`/dashboard/loan-applications/${res.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-8 print:space-y-4 print:p-8">
      {/* Print-only Header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase">BUKONZO UNITED TEACHERS COOPERATIVE SOCIETY</h1>
            <p className="text-sm">Loan Application Form - Reference Copy</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">Date: {format(new Date(), "PP")}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          /* Hide all dashboard chrome so only the form prints */
          nav, aside, header, footer,
          [data-sidebar], [role="navigation"],
          .sidebar, .topbar, .navbar,
          [data-slot="sidebar"], [data-slot="sidebar-rail"],
          [data-slot="sidebar-inset"] > header {
            display: none !important;
          }
          /* Expand main area to full width */
          main, [role="main"], [data-slot="sidebar-inset"] {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          body {
            font-size: 12px;
            color: #000;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden { display: none !important; }
          .bg-indigo-50, .bg-blue-50, .bg-green-50, .bg-red-50, .bg-orange-50, .bg-purple-50, .bg-amber-50 { background-color: transparent !important; border: 1px solid #ddd !important; }
          section { page-break-inside: avoid; margin-bottom: 2rem !important; }
          input, select, textarea { border: none !important; background: transparent !important; padding: 0 !important; font-weight: bold; }
          .lucide { color: #000 !important; }
          button { display: none !important; }
        }
      `}</style>

      {/* A. Applicant Details */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <User className="h-4 w-4 text-blue-600" />
          <h3 className="text-lg font-semibold">A. Applicant Details</h3>
        </div>

        <div className="space-y-3">
          <Label>SACCO Member *</Label>
          <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={memberSearchOpen}
                className="w-full h-16 justify-between px-4 text-left"
              >
                {selectedMember ? (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {selectedMember.user.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        #{selectedMember.memberNumber} •{" "}
                        {loadingMemberBalance ? (
                          <span className="animate-pulse">Loading balances…</span>
                        ) : (
                          <>Total Savings: {fmt(memberAccounts.reduce((s, a) => s + a.balance, 0))}</>
                        )}
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
              <Command>
                <CommandInput
                  placeholder="Search by name, member no., phone, email..."
                  className="h-12 text-base"
                />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup className="max-h-80 overflow-y-auto pt-0">
                    {members
                      .filter((m) => {
                        // Exclude if already selected as a guarantor
                        const guarantorNumbers = (watched.guarantors || [])
                          .map((g) => g.membershipNumber)
                          .filter(Boolean);
                        return !guarantorNumbers.includes(m.memberNumber);
                      })
                      .map((m) => (
                        <CommandItem
                          key={m.id}
                          onSelect={() => {
                            setSelectedMember(m);
                            setValue("memberId", m.id);
                            if (m.employer) {
                              setValue("employer", m.employer);
                            } else if (m.occupation) {
                              setValue("employer", m.occupation);
                            }
                            setValue("employmentStatus", "Self-employed");
                            setMemberSearchOpen(false);
                          }}
                          className="p-4 cursor-pointer hover:bg-blue-50 transition-colors border-b last:border-0"
                        >
                          <div className="flex items-center gap-4 w-full">
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                              {m.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-base truncate">
                                  {m.user.name}
                                </span>
                                <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                  {fmt(
                                    (m.accounts || []).reduce((s, a) => s + a.balance, 0)
                                  )}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 flex gap-3 mt-1">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                  #{m.memberNumber}
                                </span>
                                <span>{m.user.phone || "No phone"}</span>
                              </div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedMember && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
              {/* header row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-blue-100">
                <CheckCircle className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-blue-900 text-sm">
                    {selectedMember.user.name}{" "}
                    <span className="font-mono text-blue-500 text-xs">#{selectedMember.memberNumber}</span>
                  </h4>
                  <p className="text-xs text-blue-600">{selectedMember.user.phone || selectedMember.user.email || ""}</p>
                </div>
                {loadingMemberBalance ? (
                  <span className="text-xs text-blue-400 animate-pulse">Loading balances…</span>
                ) : (
                  <div className="text-right">
                    <p className="text-[10px] text-blue-500 uppercase tracking-wide">Total Savings</p>
                    <p className="font-bold text-blue-800 text-sm">
                      {fmt(memberAccounts.reduce((s, a) => s + a.balance, 0))}
                    </p>
                  </div>
                )}
              </div>

              {/* per-account rows */}
              {!loadingMemberBalance && memberAccounts.length > 0 && (
                <div className="divide-y divide-blue-100">
                  {memberAccounts.map((acc) => {
                    const isVoluntary = acc.accountType.name.toLowerCase().includes("voluntary");
                    return (
                      <div
                        key={acc.id}
                        className={`flex items-center justify-between px-4 py-2 text-xs ${isVoluntary ? "bg-emerald-50" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {isVoluntary && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              Voluntary
                            </span>
                          )}
                          <span className="font-mono text-gray-500">{acc.accountNumber}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-600">{acc.accountType.name}</span>
                        </div>
                        <span className={`font-bold ${isVoluntary ? "text-emerald-700" : "text-gray-800"}`}>
                          {fmt(acc.balance)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* hidden old block kept for downstream data integrity — remove visual double render */}
              <div className="hidden">
                <div>
                  <h4 className="font-medium text-blue-900">Selected Member</h4>
                  <p className="text-sm text-blue-700">
                    {selectedMember.user.name} (#
                    {selectedMember.memberNumber}) • Total Savings:{" "}
                    {fmt(memberAccounts.reduce((sum, acc) => sum + acc.balance, 0))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TextInput
            register={register}
            errors={errors}
            name="employer"
            label="Occupation / Employer"
            icon={Building2}
            placeholder="e.g., ABC Traders Ltd."
            isRequired={false}
          />
          <TextInput
            register={register}
            errors={errors}
            name="employmentStatus"
            label="Employment Status"
            icon={User}
            placeholder="Salaried / Self-employed"
            isRequired={false}
          />
          <TextInput
            register={register}
            errors={errors}
            name="grossMonthlyIncome"
            label="Gross Monthly Income (UGX)"
            icon={DollarSign}
            type="number"
            placeholder="0"
            isRequired={false}
          />
          <TextInput
            register={register}
            errors={errors}
            name="netMonthlyIncome"
            label="Net Monthly Income (UGX)"
            icon={DollarSign}
            type="number"
            placeholder="0"
            isRequired={false}
          />
        </div>
      </section>

      {/* B. Loan Details */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CreditCard className="h-4 w-4 text-green-600" />
            <h3 className="text-lg font-semibold">B. Loan Details</h3>
          </div>

          <FormSelectInput
            label="Loan Product *"
            options={productOptions}
            option={selectedLoanProduct as Option}
            setOption={setSelectedLoanProduct}
          />

          {selectedLoanProduct && product && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-gray-600">Product:</span>
                    <p className="font-medium">{product.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-gray-600">Interest Rate:</span>
                    <p className="font-medium">{product.interestRate}% p.a.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-gray-600">Range:</span>
                    <p className="font-medium">
                      {fmt(product.minAmount)} - {fmt(product.maxAmount)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-300">
                <span className="text-gray-600 text-sm">Repayment Period:</span>
                <p className="font-medium">
                  {Math.round(product.repaymentPeriodDays / 30)} months (
                  {product.repaymentPeriodDays} days)
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextInput
              register={register}
              errors={errors}
              name="amountApplied"
              label="Loan Amount Requested *"
              icon={DollarSign}
              type="number"
              placeholder="0"
              isRequired={true}
            />
            <div className="space-y-2">
              <TextInput
                register={register}
                errors={errors}
                name="repaymentPeriodMonths"
                label="Repayment Period (Months)"
                icon={Calculator}
                type="number"
                placeholder={
                  product
                    ? `Max: ${Math.round(product.repaymentPeriodDays / 30)} months`
                    : "e.g. 12"
                }
                isRequired={false}
              />
              {product && watched.repaymentPeriodMonths && (
                <p
                  className={`text-xs flex items-center gap-1 ${
                    Number(watched.repaymentPeriodMonths) >
                      Math.round(product.repaymentPeriodDays / 30) ||
                    Number(watched.repaymentPeriodMonths) < 1
                      ? "text-red-600 font-medium"
                      : "text-green-600"
                  }`}
                >
                  {Number(watched.repaymentPeriodMonths) >
                  Math.round(product.repaymentPeriodDays / 30) ? (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Exceeds maximum period of{" "}
                      {Math.round(product.repaymentPeriodDays / 30)} months
                    </>
                  ) : Number(watched.repaymentPeriodMonths) < 1 ? (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Must be at least 1 month
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Valid period (1 - {Math.round(product.repaymentPeriodDays / 30)} months)
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Application Date</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={new Date().toISOString().split('T')[0]}
                {...register("applicationDate")}
              />
              <p className="text-xs text-muted-foreground">Defaults to today if left blank.</p>
            </div>

            <TextInput
              register={register}
              errors={errors}
              name="repaymentStartDate"
              label="Repayment Start Date (Optional)"
              icon={CalendarDays}
              type="date"
              isRequired={false}
              placeholder="Leave blank to auto-calculate"
            />

            <div className="space-y-2">
               <Label>Schedule Mode of Payment</Label>
               {(() => {
                 const repaymentOptions = [
                   { label: "Bi-weekly", value: "BI_WEEKLY" },
                   { label: "Monthly", value: "MONTHLY" },
                   { label: "Every Two Months", value: "EVERY_TWO_MONTHS" },
                   { label: "Quarterly", value: "QUARTERLY" },
                   { label: "Half a Year", value: "HALF_YEAR" }
                 ];
                 const selectedValue = watched.modeOfRepayment;
                 const selectedOption = repaymentOptions.find(o => o.value === selectedValue) || { label: "Select schedule", value: "" };
                 
                 return (
                   <FormSelectInput
                      label=""
                      labelShown={false}
                      options={repaymentOptions}
                      option={selectedOption}
                      setOption={(opt: Option) => setValue("modeOfRepayment", opt.value)}
                   />
                 );
               })()}
               <input type="hidden" {...register("modeOfRepayment")} />
            </div>
            
            <div className="space-y-2">
              <Label>Interest Calculation Method</Label>
              <FormSelectInput
                label="Interest Type"
                labelShown={false}
                options={[
                  { label: "Flat Rate", value: "FLAT_RATE" },
                  { label: "Reducing Balance", value: "REDUCING_BALANCE" },
                ]}
                option={selectedInterestType}
                setOption={(option: Option | null) => {
                  setSelectedInterestType(option);
                  setValue("interestType", option?.value as any);
                }}
              />
              {product && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Product default: {product.interestType === "FLAT_RATE" ? "Flat Rate" : "Reducing Balance"}
                </p>
              )}
            </div>
          </div>

          {/* Outstanding Balance Deduction Warning */}
          {netLoanCalculation.hasDeduction && (
            <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
              <div className="flex items-start gap-3">
                <MinusCircle className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="font-bold text-amber-900">
                        Outstanding Balance Deduction Notice
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Expand to review the ledger balances that will be
                        cleared at disbursement.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                      onClick={() =>
                        setDeductionNoticeExpanded(
                          !deductionNoticeExpanded,
                        )
                      }
                    >
                      {deductionNoticeExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-1" />
                      )}
                      {deductionNoticeExpanded ? "Hide details" : "Show details"}
                    </Button>
                  </div>
                  <p className="text-sm text-amber-800 mb-3">
                    This member has an outstanding balance of{" "}
                    <strong>{fmt(eligibility.totalOutstanding)}</strong> from
                    existing loans. This deduction summary will be sent to the
                    manager for approval and, once approved, applied at
                    disbursement.
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    The principal, interest, and penalty shown below belong to
                    the previous outstanding loan(s), not the new loan being
                    applied for.
                  </p>

                  <div className="space-y-2 bg-white p-3 rounded border border-amber-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        Requested Loan Amount:
                      </span>
                      <span className="font-semibold">
                        {fmt(Number(watched.amountApplied) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700">
                        Outstanding Balance (to be deducted):
                      </span>
                      <span className="font-semibold text-amber-700">
                        - {fmt(netLoanCalculation.deduction)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t border-amber-200">
                      <span className="font-bold text-gray-900">
                        Net Loan Amount (after deduction):
                      </span>
                      <span className="font-bold text-green-600">
                        {fmt(netLoanCalculation.netAmount)}
                      </span>
                    </div>
                  </div>

                  {netLoanCalculation.netAmount <= 0 && (
                    <div className="mt-3 p-2 bg-red-100 rounded border border-red-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-xs text-red-700 font-medium">
                        The net loan amount is zero or negative. Please increase
                        the requested loan amount.
                      </p>
                    </div>
                  )}

                  {deductionNoticeExpanded && existingLoans.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {existingLoans.map((loan) => {
                        const ledger = getLedgerSummary(loan);
                        const currentOutstanding = getCurrentOutstanding(loan);
                        const isExpanded = expandedDeductionLoans[loan.id] ?? true;
                        return (
                          <div
                            key={`deduction-${loan.id}`}
                            className="rounded-lg border border-amber-200 bg-white"
                          >
                            <button
                              type="button"
                              className="w-full flex items-start justify-between gap-3 px-3 py-3 text-left"
                              onClick={() => toggleDeductionLoan(loan.id)}
                            >
                              <div className="flex items-start gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mt-0.5 text-amber-700" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mt-0.5 text-amber-700" />
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {loan.loanApplication?.loanProduct?.name ||
                                      "Loan Product"}
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    Loan {loan.id.slice(0, 8)} | {getStatusLabel(loan.status)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-amber-700">
                                  Total deduction
                                </p>
                                <p className="text-sm font-semibold text-amber-900">
                                  {fmt(currentOutstanding)}
                                </p>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-amber-100 px-3 py-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                  <div>
                                    <span className="text-slate-500">
                                      Principal balance
                                    </span>
                                    <p className="font-semibold text-slate-900">
                                      {fmt(ledger.principal)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">
                                      Interest balance
                                    </span>
                                    <p className="font-semibold text-cyan-700">
                                      {fmt(ledger.interest)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">
                                      Penalty balance
                                    </span>
                                    <p className="font-semibold text-amber-700">
                                      {fmt(ledger.penalty)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">
                                      Last ledger update
                                    </span>
                                    <p className="font-semibold text-slate-900">
                                      {ledger.lastTransactionDate
                                        ? format(
                                            new Date(ledger.lastTransactionDate),
                                            "dd MMM yyyy",
                                          )
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {product &&
            watched.amountApplied &&
            Number(watched.amountApplied) > 0 &&
            calc && (
              <div className="bg-gradient-to-r from-gray-50 to-orange-50 p-6 rounded-lg border">
                <h4 className="font-semibold text-gray-900 mb-3">
                  Loan Calculation Summary
                  {netLoanCalculation.hasDeduction && (
                    <span className="text-sm font-normal text-amber-700 ml-2">
                      (Projected after previous-loan deduction at disbursement)
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  These figures belong to the new loan application. Any
                  previous-loan deduction is shown separately above.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Principal:</span>
                    <p className="font-semibold text-lg">
                      {fmt(calc.principal)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Interest:</span>
                    <p className="font-semibold text-lg text-orange-600">
                      {fmt(calc.interest)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Due:</span>
                    <p className="font-semibold text-lg text-red-600">
                      {fmt(calc.totalAmountDue)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Payment:</span>
                    <p className="font-semibold text-lg text-blue-600">
                      {fmt(calc.monthlyPayment)}
                    </p>
                  </div>
                </div>

                {dti !== undefined && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-600">Estimated DTI:</span>{" "}
                    <span
                      className={`font-semibold ${
                        dti > 45 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {dti.toFixed(1)}%
                    </span>
                    <p className="text-xs text-gray-500">
                      DTI = Monthly Payment / Net Income. Over 45% is usually
                      risky.
                    </p>
                  </div>
                )}

                <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    This is a preliminary estimate; final terms are set during
                    approval.
                  </div>
                </div>
              </div>
            )}
        </section>
      )}

      {/* C. Guarantors */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Users className="h-4 w-4 text-purple-600" />
            <h3 className="text-lg font-semibold">
              C. Loan Security / Guarantors
            </h3>
          </div>

          {guarantorFields.map((field, i) => (
            <div key={field.id} className="rounded-lg border p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Guarantor {i + 1}</h4>
                {guarantorFields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(i)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="mb-4">
                <Label className="mb-2 block">Search Member as Guarantor</Label>
                <Popover
                  open={guarantorSearchOpen[i] || false}
                  onOpenChange={(open) =>
                    setGuarantorSearchOpen((prev) => ({ ...prev, [i]: open }))
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full h-12 justify-between px-4 text-left"
                    >
                      <div className="flex items-center gap-2 text-gray-500">
                        <Search className="h-4 w-4" />
                        <span>Search member...</span>
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search member name, number, phone..."
                        className="h-10 text-sm"
                      />
                    <CommandList>
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-y-auto pt-0">
                        {members
                          .filter((m) => {
                            // 1. Exclude the applicant
                            if (m.id === selectedMember?.id) return false;

                            // 2. Exclude members already selected as OTHER guarantors
                            const otherGuarantorNumbers = (watched.guarantors || [])
                              .filter((_, idx) => idx !== i) // Exclude current field
                              .map((g) => g.membershipNumber)
                              .filter(Boolean);

                            return !otherGuarantorNumbers.includes(m.memberNumber);
                          })
                          .map((m) => (
                            <CommandItem
                              key={m.id}
                              onSelect={() => {
                                setValue(`guarantors.${i}.fullName`, m.user.name);
                                setValue(
                                  `guarantors.${i}.membershipNumber`,
                                  m.memberNumber
                                );
                                setValue(
                                  `guarantors.${i}.phone`,
                                  m.user.phone || ""
                                );
                                setGuarantorSearchOpen((prev) => ({
                                  ...prev,
                                  [i]: false,
                                }));
                              }}
                              className="p-3 cursor-pointer hover:bg-blue-50 transition-colors border-b last:border-0"
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                    {m.user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {m.user.name}
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                      #{m.memberNumber} •{" "}
                                      {m.user.phone || "No phone"}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                    {m.memberNumber}
                                  </span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextInput
                  label="Full Name"
                  name={`guarantors.${i}.fullName`}
                  register={register}
                  errors={errors}
                  icon={User}
                  placeholder="Full name"
                  isRequired={false}
                />
                <TextInput
                  label="Membership Number"
                  name={`guarantors.${i}.membershipNumber`}
                  register={register}
                  errors={errors}
                  placeholder="#..."
                  isRequired={false}
                />
                <TextInput
                  label="Phone"
                  name={`guarantors.${i}.phone`}
                  register={register}
                  errors={errors}
                  placeholder="07.."
                  isRequired={false}
                />
                <TextInput
                  label="Relationship"
                  name={`guarantors.${i}.relationship`}
                  register={register}
                  errors={errors}
                  placeholder="Brother, colleague..."
                  isRequired={false}
                />
                <TextInput
                  label="Monthly Income (UGX)"
                  name={`guarantors.${i}.monthlyIncome`}
                  register={register}
                  errors={errors}
                  type="number"
                  placeholder="0"
                  isRequired={false}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({ fullName: "" })}
          >
            + Add Guarantor
          </Button>
        </section>
      )}

      {/* D. Loan Eligibility Check */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <h3 className="text-lg font-semibold">D. Loan Eligibility Check</h3>
          </div>
          {/* Loan Eligibility Status */}
          <div
            className={`p-5 rounded-lg border-2 ${
              eligibility.isEligible
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-start gap-3">
              {eligibility.isEligible ? (
                <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h4
                  className={`font-bold text-lg mb-2 ${
                    eligibility.isEligible ? "text-green-900" : "text-red-900"
                  }`}
                >
                  {eligibility.isEligible
                    ? "✓ Member is Eligible for New Loan"
                    : "✗ Member is NOT Eligible for New Loan"}
                </h4>

                {loadingLoans ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <p className="text-sm text-gray-600">
                      Checking loan history...
                    </p>
                  </div>
                ) : (
                  <>
                    {eligibility.isEligible ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-800">
                          This member meets all requirements to apply for a new
                          loan.
                        </p>
                        {eligibility.hasActiveLoans && (
                          <div className="flex items-center gap-2 text-sm">
                            <Info className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-800">
                              Active loans: {eligibility.activeLoansCount} |
                              Total outstanding:{" "}
                              {fmt(eligibility.totalOutstanding)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-red-800 font-medium mb-2">
                          Reasons for ineligibility:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {eligibility.reasons.map((reason, idx) => (
                            <li key={idx} className="text-sm text-red-700">
                              {reason}
                            </li>
                          ))}
                        </ul>

                        {eligibility.hasActiveLoans && (
                          <div className="mt-3 p-3 bg-red-100 rounded border border-red-200">
                            <p className="text-sm text-red-800">
                              <strong>Active loans:</strong>{" "}
                              {eligibility.activeLoansCount} |{" "}
                              <strong>Total outstanding:</strong>{" "}
                              {fmt(eligibility.totalOutstanding)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Existing Loans with SACCO */}
          {/* // In your form component, update the existing loans display section: */}
          {existingLoans.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Member's Loan History with SACCO ({existingLoans.length} loan
                {existingLoans.length !== 1 ? "s" : ""})
              </h4>

              <div className="space-y-3">
                {existingLoans.map((loan) => {
                  const ledger = getLedgerSummary(loan);
                  const currentOutstanding = getCurrentOutstanding(loan);
                  const ledgerDateLabel = ledger.lastTransactionDate
                    ? format(new Date(ledger.lastTransactionDate), "dd MMM yyyy")
                    : "N/A";

                  return (
                    <div
                      key={loan.id}
                      className="p-4 bg-white rounded-lg border shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-gray-900">
                              {loan.loanApplication?.loanProduct?.name ||
                                "Loan Product"}
                            </h5>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                                loan.status
                              )}`}
                            >
                              {getStatusLabel(loan.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Loan ID: {loan.id.slice(0, 8)}...
                          </p>
                        </div>

                        <div className="flex items-center gap-2 ml-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() =>
                              window.open(
                                `/dashboard/loans/reports/ledger?loanId=${loan.id}`,
                                "_blank"
                              )
                            }
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                            View Ledger
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 text-xs">
                            Amount Granted:
                          </span>
                          <p className="font-semibold">
                            {fmt(loan.amountGranted)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">
                            Total Due:
                          </span>
                          <p className="font-semibold">
                            {fmt(loan.totalAmountDue)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">
                            Amount Paid:
                          </span>
                          <p className="font-semibold text-green-600">
                            {fmt(loan.amountPaid)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 text-xs">
                            Outstanding:
                          </span>
                          <p
                            className={`font-semibold ${
                              currentOutstanding > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {fmt(currentOutstanding)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                              Ledger Summary
                            </p>
                            <p className="text-xs text-blue-600">
                              Current balances derived from the latest loan ledger state.
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-blue-600">Total balance</p>
                            <p className="text-sm font-semibold text-blue-900">
                              {fmt(ledger.total)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600 text-xs">
                              Principal Balance:
                            </span>
                            <p className="font-semibold text-slate-900">
                              {fmt(ledger.principal)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">
                              Interest Balance:
                            </span>
                            <p className="font-semibold text-cyan-700">
                              {fmt(ledger.interest)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">
                              Penalty Balance:
                            </span>
                            <p className="font-semibold text-amber-700">
                              {fmt(ledger.penalty)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">
                              Last Ledger Update:
                            </span>
                            <p className="font-semibold text-slate-900">
                              {ledgerDateLabel}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">
                              Ledger Reference:
                            </span>
                            <p className="font-semibold text-slate-900">
                              Loan {loan.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-xs text-gray-600">
                        <div>
                          <span>Disbursed:</span>
                          <p className="font-medium">
                            {new Date(loan.disbursementDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span>Due Date:</span>
                          <p className="font-medium">
                            {new Date(loan.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        {loan.loanApplication?.loanProduct && (
                          <>
                            <div>
                              <span>Interest Rate:</span>
                              <p className="font-medium">
                                {loan.loanApplication.loanProduct.interestRate}%
                              </p>
                            </div>
                            <div>
                              <span>Period:</span>
                              <p className="font-medium">
                                {
                                  loan.loanApplication.loanProduct
                                    .repaymentPeriodDays
                                }{" "}
                                days
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {loan.status === "OVERDUE" && (
                        <div className="mt-3 p-2 bg-red-100 rounded flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <p className="text-xs text-red-700 font-medium">
                            This loan is overdue and must be cleared before
                            applying for a new loan
                          </p>
                        </div>
                      )}

                      {loan.status === "DISBURSED" &&
                        currentOutstanding > 0 && (
                          <div className="mt-3 p-2 bg-amber-100 rounded flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <p className="text-xs text-amber-700 font-medium">
                              Outstanding balance of{" "}
                              {fmt(currentOutstanding)} is scheduled for
                              deduction at disbursement once the manager
                              approves this application
                            </p>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>

              {eligibility.totalOutstanding > 0 && (
                <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                      Total Outstanding Balance:
                    </span>
                    <span className="text-lg font-bold text-blue-900">
                      {fmt(eligibility.totalOutstanding)}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    This amount will be presented for approval now and deducted
                    from the new loan during disbursement
                  </p>
                </div>
              )}
            </div>
          )}
          {/* No Loans Message */}
          {existingLoans.length === 0 && !loadingLoans && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <Info className="h-5 w-5" />
                <p className="text-sm">
                  This member has no existing loans with the SACCO.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* E. Existing Financial Obligations & Loan Deductions */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Calculator className="h-4 w-4 text-purple-600" />
            <h3 className="text-lg font-semibold">
              E. Existing Financial Obligations & Loan Deductions
            </h3>
          </div>

          {/* External Financial Obligations */}
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              External Financial Obligations
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Do you have loans with other financial institutions?
                </Label>
                <RadioGroup 
                  value={watched.hasOtherLoansWithInstitutions ? "yes" : "no"}
                  onValueChange={(val) => setValue("hasOtherLoansWithInstitutions", val === "yes")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded border cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="yes" id="ext-loan-yes" />
                    <Label htmlFor="ext-loan-yes" className="cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded border cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="no" id="ext-loan-no" />
                    <Label htmlFor="ext-loan-no" className="cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {watched.hasOtherLoansWithInstitutions && (
                <div className="ml-7 mt-2 space-y-4">
                  <TextInput
                    register={register}
                    errors={errors}
                    name="otherLoanInstitutionName"
                    label="Institution Name"
                    icon={Building2}
                    placeholder="e.g., ABC Bank"
                    isRequired={false}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      register={register}
                      errors={errors}
                      name="otherLoanBalance"
                      label="Loan Balance (UGX)"
                      icon={DollarSign}
                      type="number"
                      placeholder="0"
                      isRequired={false}
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="otherLoanMonthlyInstallment"
                      label="Monthly Installment (UGX)"
                      icon={DollarSign}
                      type="number"
                      placeholder="0"
                      isRequired={false}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label>Other Monthly Obligations (if any)</Label>
                <Textarea
                  {...register("otherMonthlyObligations")}
                  placeholder="List any other monthly financial obligations (rent, school fees, etc.)"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>

          {/* Loan Deductions at Disbursal */}
          {watched.amountApplied && Number(watched.amountApplied) > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-purple-600" />
                Loan Deductions at Disbursal
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Select applicable deductions to be made from the approved loan
                amount at the time of disbursal
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">Apply Loan Processing Fee (1%)?</Label>
                    <RadioGroup 
                      value={watched.applyLoanProcessingFee ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyLoanProcessingFee", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="fee-yes" />
                        <Label htmlFor="fee-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="fee-no" />
                        <Label htmlFor="fee-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyLoanProcessingFee && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard fee: 1% of approved loan amount
                        </p>
                        {watched.amountApplied && (
                          <span className="text-sm font-semibold text-purple-700">
                            - {fmt(deductions.processingFee)}
                          </span>
                        )}
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="loanProcessingFeePercentage"
                        label="Processing Fee Percentage"
                        icon={Percent}
                        type="number"
                        step="0.1"
                        placeholder="1"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">Apply Loan Insurance (1.5%)?</Label>
                    <RadioGroup 
                      value={watched.applyLoanInsurance ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyLoanInsurance", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="ins-yes" />
                        <Label htmlFor="ins-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="ins-no" />
                        <Label htmlFor="ins-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyLoanInsurance && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard insurance: 1.5% of approved loan amount
                        </p>
                        {watched.amountApplied && (
                          <span className="text-sm font-semibold text-purple-700">
                            - {fmt(deductions.insurance)}
                          </span>
                        )}
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="loanInsurancePercentage"
                        label="Insurance Percentage"
                        icon={Percent}
                        type="number"
                        step="0.1"
                        placeholder="1.5"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">
                      Apply Share Capital / Equity Contribution (UGX 20,000)?
                    </Label>
                    <RadioGroup
                      value={watched.applyShareDeduction ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyShareDeduction", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="share-yes" />
                        <Label htmlFor="share-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="share-no" />
                        <Label htmlFor="share-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyShareDeduction && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard share capital / equity contribution: UGX 20,000
                        </p>
                        <span className="text-sm font-semibold text-purple-700">
                          - {fmt(20000)}
                        </span>
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="shareAmount"
                        label="Share Capital / Equity Amount"
                        icon={DollarSign}
                        type="number"
                        placeholder="20000"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">Apply Loan Application Fee (1%)?</Label>
                    <RadioGroup
                      value={watched.applyLoanApplicationFee ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyLoanApplicationFee", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="appfee-yes" />
                        <Label htmlFor="appfee-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="appfee-no" />
                        <Label htmlFor="appfee-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyLoanApplicationFee && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard application fee: 1% of approved loan amount
                        </p>
                        {watched.amountApplied && (
                          <span className="text-sm font-semibold text-purple-700">
                            - {fmt(deductions.applicationFee)}
                          </span>
                        )}
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="loanApplicationFeePercentage"
                        label="Application Fee Percentage"
                        icon={Percent}
                        type="number"
                        step="0.1"
                        placeholder="1"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">Apply Loan Stationery Fee (UGX 10,000)?</Label>
                    <RadioGroup
                      value={watched.applyLoanStationeryFee ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyLoanStationeryFee", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="statfee-yes" />
                        <Label htmlFor="statfee-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="statfee-no" />
                        <Label htmlFor="statfee-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyLoanStationeryFee && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard stationery fee: UGX 10,000 (flat amount)
                        </p>
                        <span className="text-sm font-semibold text-purple-700">
                          - {fmt(deductions.stationeryFee)}
                        </span>
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="loanStationeryFeeAmount"
                        label="Stationery Fee Amount (UGX)"
                        icon={DollarSign}
                        type="number"
                        placeholder="10000"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white rounded border space-y-3">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <Label className="text-sm">Apply Loan Commitment Fee (0.5%)?</Label>
                    <RadioGroup
                      value={watched.applyLoanCommitmentFee ? "yes" : "no"}
                      onValueChange={(val) => setValue("applyLoanCommitmentFee", val === "yes")}
                      className="flex gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="commitfee-yes" />
                        <Label htmlFor="commitfee-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="commitfee-no" />
                        <Label htmlFor="commitfee-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {watched.applyLoanCommitmentFee && (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Standard commitment fee: 0.5% of approved loan amount
                        </p>
                        {watched.amountApplied && (
                          <span className="text-sm font-semibold text-purple-700">
                            - {fmt(deductions.commitmentFee)}
                          </span>
                        )}
                      </div>
                      <TextInput
                        register={register}
                        errors={errors}
                        name="loanCommitmentFeePercentage"
                        label="Commitment Fee Percentage"
                        icon={Percent}
                        type="number"
                        step="0.1"
                        placeholder="0.5"
                        isRequired={false}
                      />
                    </div>
                  )}
                </div>

                {/* Deductions Summary */}
                <div className="pt-4 border-t border-purple-300 space-y-2 bg-white p-4 rounded">
                  <h5 className="font-medium text-gray-800 mb-3">
                    Deductions Summary
                    {netLoanCalculation.hasDeduction && (
                      <span className="text-xs font-normal text-amber-700 ml-2">
                        (Based on net amount after outstanding balance
                        deduction)
                      </span>
                    )}
                  </h5>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Loan Amount Applied:</span>
                    <span className="font-semibold">
                      {fmt(Number(watched.amountApplied) || 0)}
                    </span>
                  </div>

                  {netLoanCalculation.hasDeduction && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-700">
                          Outstanding Balance Deduction:
                        </span>
                        <span className="font-semibold text-amber-700">
                          - {fmt(netLoanCalculation.deduction)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-gray-700 font-medium">
                          Net Loan Amount:
                        </span>
                        <span className="font-semibold text-blue-700">
                          {fmt(netLoanCalculation.netAmount)}
                        </span>
                      </div>
                    </>
                  )}

                  {watched.applyLoanProcessingFee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Processing Fee (
                        {watched.loanProcessingFeePercentage || 1}%):
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.processingFee)}
                      </span>
                    </div>
                  )}

                  {watched.applyLoanInsurance && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Loan Insurance ({watched.loanInsurancePercentage || 1.5}
                        %):
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.insurance)}
                      </span>
                    </div>
                  )}

                  {watched.applyShareDeduction && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Share Capital / Equity Contribution:
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.share)}
                      </span>
                    </div>
                  )}

                  {watched.applyLoanApplicationFee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Loan Application Fee ({watched.loanApplicationFeePercentage || 1}%):
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.applicationFee)}
                      </span>
                    </div>
                  )}

                  {watched.applyLoanStationeryFee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Loan Stationery Fee:
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.stationeryFee)}
                      </span>
                    </div>
                  )}

                  {watched.applyLoanCommitmentFee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Loan Commitment Fee ({watched.loanCommitmentFeePercentage || 0.5}%):
                      </span>
                      <span className="font-semibold text-red-600">
                        - {fmt(deductions.commitmentFee)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600 font-medium">
                      Total Deductions:
                    </span>
                    <span className="font-semibold text-red-600">
                      -{" "}
                      {fmt(
                        deductions.totalDeductions +
                          (netLoanCalculation.hasDeduction
                            ? netLoanCalculation.deduction
                            : 0)
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between pt-3 border-t-2 border-purple-300">
                    <span className="font-semibold text-gray-800">
                      Net Amount to be Disbursed:
                    </span>
                    <span className="font-bold text-xl text-green-600">
                      {fmt(deductions.netDisbursement)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* E. Collateral Details */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Shield className="h-4 w-4 text-indigo-600" />
            <h3 className="text-lg font-semibold">E. Collateral Details</h3>
          </div>

          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-700 mb-4">
              Provide detailed information about the collateral you're offering
              to secure this loan
            </p>

            <div className="space-y-4">
              <FormSelectInput
                label="Collateral Type"
                options={collateralTypes}
                option={selectedCollateralType}
                setOption={(value) => {
                  setSelectedCollateralType(value);
                  setValue("collateralType", value?.value || "");
                }}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  name="collateralValue"
                  label="Market Value (UGX)"
                  icon={DollarSign}
                  type="number"
                  placeholder="0"
                  isRequired={false}
                />

                <TextInput
                  register={register}
                  errors={errors}
                  name="forcedSaleValue"
                  label="Forced Sale Value - FSV (UGX)"
                  icon={DollarSign}
                  type="number"
                  placeholder="0"
                  isRequired={false}
                />
              </div>

              {/* FSV Ratio Display */}
              {watched.collateralValue && watched.forcedSaleValue && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">FSV Ratio:</span>
                    <span className="font-semibold text-blue-700">
                      {fsvRatio}% of Market Value
                    </span>
                  </div>
                  <p className="text-xs text-blue-600">
                    Typically 70-80% of market value
                  </p>
                </div>
              )}

              <TextInput
                register={register}
                errors={errors}
                name="collateralLocation"
                label="Collateral Location"
                icon={Building2}
                placeholder="e.g., Kampala, Plot 123, Block 45"
                isRequired={false}
              />

              <div className="space-y-2">
                <Label>Collateral Details</Label>
                <Textarea
                  {...register("collateralDetails")}
                  placeholder="Provide detailed description (size, condition, ownership documents, registration details, etc.)"
                  className="min-h-[100px]"
                />
              </div>

              {/* LTV Ratio Warning */}
              {watched.amountApplied &&
                watched.forcedSaleValue &&
                Number(ltv) > 0 && (
                  <div
                    className={`p-4 rounded-lg border ${
                      Number(ltv) <= 80
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {Number(ltv) <= 80 ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            Loan-to-Value (LTV) Ratio:
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              Number(ltv) <= 80
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {ltv}%
                          </span>
                        </div>
                        {Number(ltv) > 80 ? (
                          <p className="text-sm text-red-700">
                            ⚠️ LTV exceeds 80%. Additional collateral may be
                            required or loan amount may be adjusted during
                            review.
                          </p>
                        ) : (
                          <p className="text-sm text-green-700">
                            ✓ LTV is within acceptable range (≤80%)
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          LTV = Net Loan Amount ÷ Forced Sale Value × 100
                          {netLoanCalculation.hasDeduction &&
                            " (using projected net disbursement after previous-loan deduction)"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="mt-4 p-3 bg-indigo-100 rounded flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-indigo-600 mt-0.5" />
              <div className="text-xs text-indigo-700">
                <p className="font-medium mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Original ownership documents will be required during
                    processing
                  </li>
                  <li>
                    Collateral may be subject to physical inspection and
                    valuation
                  </li>
                  <li>
                    For land/property, please provide land title or sale
                    agreement
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* F. Bank & Payment Information */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Banknote className="h-4 w-4 text-indigo-600" />
            <h3 className="text-lg font-semibold">
              F. Bank & Payment Information
            </h3>
          </div>

          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-bold text-indigo-900 text-lg">Strict Disbursement Policy</p>
                <p className="text-sm text-indigo-700 leading-relaxed">
                  For security and compliance purposes, all loan disbursements are strictly processed through the member's regular SACCO Savings account.
                </p>
              </div>
            </div>

            {selectedMember ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-5 bg-white rounded-xl border-2 shadow-sm flex justify-between items-center transition-all ${getPrimarySavingsAccount(memberAccounts) ? "border-indigo-100 hover:border-indigo-300" : "border-amber-200"}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                          {isVoluntarySavingsAccount(getPrimarySavingsAccount(memberAccounts))
                            ? "Voluntary Savings (Fallback)"
                            : "Main Savings Account"}
                        </span>
                      </div>
                      <p className={`font-mono text-xl font-bold ${getPrimarySavingsAccount(memberAccounts) ? "text-slate-800" : "text-amber-700"}`}>
                        {getPrimarySavingsAccount(memberAccounts)?.accountNumber || "No savings account found"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {isVoluntarySavingsAccount(getPrimarySavingsAccount(memberAccounts))
                          ? "Member has a voluntary savings account which will be used for disbursement."
                          : "Disbursement will be credited to this account."}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Available Balance</p>
                      <p className="font-bold text-2xl text-green-600">
                        {fmt(getPrimarySavingsAccount(memberAccounts)?.balance || 0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 italic text-sm">
                    No secondary accounts linked
                  </div>
                </div>
                
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 text-xs flex items-center gap-3">
                  <Info className="h-5 w-5 shrink-0 text-orange-500" />
                  <p className="leading-normal">
                    <span className="font-bold">Note:</span> External transfers to commercial banks or mobile money providers are not supported for this loan product at this stage.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center border-2 border-dashed rounded-xl border-indigo-100">
                <p className="text-sm text-indigo-400">Search and select a member above to view their disbursement target account</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* G. Declarations & Agreements */}
      {selectedMember && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <FileSignature className="h-4 w-4 text-red-600" />
            <h3 className="text-lg font-semibold">
              G. Declarations & Agreements
            </h3>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border border-red-200 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="applicantDeclaration"
                  checked={watched.applicantDeclaration}
                  onCheckedChange={(checked) =>
                    setValue("applicantDeclaration", checked as boolean)
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="applicantDeclaration"
                    className="text-sm font-medium cursor-pointer leading-relaxed"
                  >
                    <span className="text-red-600">*</span> Applicant
                    Declaration
                  </Label>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    I hereby declare that the information provided in this
                    application is true and accurate to the best of my
                    knowledge. I understand that any false information may lead
                    to rejection of my application or termination of the loan
                    agreement.
                    {netLoanCalculation.hasDeduction && (
                      <span className="block mt-2 text-amber-800 font-medium">
                        I acknowledge that my outstanding balance of{" "}
                        {fmt(eligibility.totalOutstanding)} will be submitted as
                        a deduction for approval and applied when the new loan
                        is disbursed.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {errors.applicantDeclaration && (
                <p className="text-xs text-red-600 ml-7">
                  You must accept this declaration
                </p>
              )}

              <div className="ml-7">
                <TextInput
                  register={register}
                  errors={errors}
                  name="applicantSignature"
                  label="Applicant Signature (Type your full name)"
                  icon={FileSignature}
                  placeholder="Type your full name as signature"
                  isRequired={false}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-red-300 space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="guarantorAgreementAccepted"
                  checked={watched.guarantorAgreementAccepted}
                  onCheckedChange={(checked) =>
                    setValue("guarantorAgreementAccepted", checked as boolean)
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="guarantorAgreementAccepted"
                    className="text-sm font-medium cursor-pointer leading-relaxed"
                  >
                    <span className="text-red-600">*</span> Guarantor Agreement
                  </Label>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    I/We, the guarantor(s), agree to guarantee the loan applied
                    for by the applicant and understand that in case of default,
                    I/we shall be liable to repay the outstanding loan amount.
                  </p>
                </div>
              </div>

              {errors.guarantorAgreementAccepted && (
                <p className="text-xs text-red-600 ml-7">
                  Guarantor agreement must be accepted
                </p>
              )}
            </div>

            <div className="p-3 bg-red-100 rounded flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-700 mt-0.5" />
              <p className="text-xs text-red-700">
                Both declarations are mandatory and legally binding. Please read
                carefully before accepting.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Application Summary */}
      {selectedMember && selectedLoanProduct && watched.amountApplied && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Application Summary
            </h3>
          </div>

          <div className="bg-gradient-to-r from-gray-50 to-green-50 p-6 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Applicant:</span>
                  <span className="font-medium">
                    {selectedMember.user.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Member Number:</span>
                  <span className="font-medium">
                    #{selectedMember.memberNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Product:</span>
                  <span className="font-medium">{product?.name}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Applied:</span>
                  <span className="font-medium text-green-600">
                    {fmt(Number(watched.amountApplied) || 0)}
                  </span>
                </div>
                {netLoanCalculation.hasDeduction && (
                  <div className="flex justify-between">
                    <span className="text-amber-700 text-xs">
                      Outstanding Deduction:
                    </span>
                    <span className="font-medium text-amber-700 text-xs">
                      - {fmt(netLoanCalculation.deduction)}
                    </span>
                  </div>
                )}
                {netLoanCalculation.hasDeduction && (
                  <div className="flex justify-between">
                    <span className="text-blue-700 font-medium">
                      Net Loan Amount:
                    </span>
                    <span className="font-bold text-blue-700">
                      {fmt(netLoanCalculation.netAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate:</span>
                  <span className="font-medium">
                    {product?.interestRate}% p.a.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Repayment Period:</span>
                  <span className="font-medium">
                    {watched.repaymentPeriodMonths
                      ? `${watched.repaymentPeriodMonths} months`
                      : `${Math.round(
                          (product?.repaymentPeriodDays || 0) / 30
                        )} months`}
                  </span>
                </div>
              </div>
            </div>

            {/* Show Net Disbursement if deductions apply */}
            {watched.amountApplied && Number(watched.amountApplied) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">
                    Net Disbursement Amount:
                  </span>
                  <span className="font-semibold text-green-600">
                    {fmt(deductions.netDisbursement)}
                  </span>
                </div>
                {(deductions.totalDeductions > 0 ||
                  netLoanCalculation.hasDeduction) && (
                  <p className="text-xs text-gray-500 mt-1">
                    After all deductions:{" "}
                    {fmt(
                      deductions.totalDeductions +
                        (netLoanCalculation.hasDeduction
                          ? netLoanCalculation.deduction
                          : 0)
                    )}
                  </p>
                )}
              </div>
            )}

            {netLoanCalculation.netAmount <= 0 && Number(watched.amountApplied) > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-md border border-red-200 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Insufficient Loan Amount</p>
                  <p className="text-xs text-red-700">
                    The requested amount (UGX {fmt(Number(watched.amountApplied))}) is less than or equal to the outstanding balance (UGX {fmt(eligibility.totalOutstanding)}). 
                    No funds will be disbursed. Please increase the requested amount.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
              {watched.applicantDeclaration &&
              watched.guarantorAgreementAccepted ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    All declarations accepted
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 font-medium">
                    Please accept all declarations before submitting
                  </span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-6 border-t print:hidden">
        {/* Show blocking reason when submit is disabled */}
        {selectedMember && (() => {
          if (!selectedLoanProduct) return <p className="text-sm text-amber-700 text-right">Select a loan product to continue.</p>;
          if (!watched.amountApplied) return <p className="text-sm text-amber-700 text-right">Enter the loan amount to continue.</p>;
          if (!isRepaymentPeriodValid()) return <p className="text-sm text-red-700 text-right">Repayment period exceeds the maximum allowed for this product.</p>;
          if (!eligibility.isEligible) return <p className="text-sm text-red-700 text-right">Member has overdue loans that must be cleared before a new application.</p>;
          if (Number(watched.amountApplied) > 0 && netLoanCalculation.netAmount <= 0) return (
            <p className="text-sm text-red-700 text-right">
              Loan amount (UGX {Number(watched.amountApplied).toLocaleString()}) must exceed the outstanding balance (UGX {eligibility.totalOutstanding.toLocaleString()}). Increase the amount requested.
            </p>
          );
          if (!watched.applicantDeclaration || !watched.guarantorAgreementAccepted) return <p className="text-sm text-amber-700 text-right">Accept both declarations at the bottom of Section G.</p>;
          return null;
        })()}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-2 h-12 px-6 hover:bg-slate-50"
          >
            <Printer className="h-5 w-5" />
            Print Application Form
          </Button>
          <SubmitButton
            title="Submit Application"
            loading={loading}
            disabled={
              !selectedMember ||
              !selectedLoanProduct ||
              !watched.amountApplied ||
              !isRepaymentPeriodValid() ||
              !watched.applicantDeclaration ||
              !watched.guarantorAgreementAccepted ||
              !eligibility.isEligible ||
              netLoanCalculation.netAmount <= 0
            }
          />
        </div>
      </div>
    </form>
  );
}
