"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  DollarSign,
  FileSignature,
  CheckCircle,
  Plus,
  Trash2,
  Upload,
  CreditCard,
  Search,
  Calculator,
  Loader2,
  X,
  UserPlus,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ========================
// TYPES
// ========================
interface InstitutionFromDB {
  id: string;
  institutionName: string;
  institutionType: string;
  institutionNumber: string;
  district?: string | null;
  institutionPhone: string;
  institutionEmail: string;
  registrationDate: Date;
  isApproved: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    branch: { name: string } | null;
  };
}

interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  interestPeriod: string;
  interestType: string;
  repaymentPeriodDays: number;
  description: string | null;
}

interface GuarantorResult {
  id: string;
  memberNumber: string;
  name: string;
  phone: string;
  branch: string;
}

interface GuarantorEntry {
  memberId: string;
  name: string;
  memberNumber: string;
  phone: string;
  relationship: string;
}

interface FormData {
  institutionId: string;
  loanProductId: string;
  amountApplied: number;
  purpose: string;
  repaymentPeriodMonths?: number;
  collateralOffered?: string;
  administrators: Array<{
    name: string;
    post: string;
    mobileNumber: string;
    signature?: string;
  }>;
  operatingInstructions: string;
  changeOfSignatoryInstructions?: string;
  accountTitle: string;
  accountType: string;
  // financial
  annualRevenue?: number;
  monthlyRevenue?: number;
  annualExpenses?: number;
  monthlyExpenses?: number;
  // disbursement
  disbursementMethod: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  mobileMoneyNumber?: string;
  // documents
  hasRegistrationCertificate: boolean;
  hasLCRecommendation: boolean;
  hasVicarRecommendation: boolean;
  hasMinutes: boolean;
  hasByeLaws: boolean;
  hasDissolutionResolution: boolean;
  // terms
  agreesToTerms: boolean;
  applicantSignature: string;
  // fees
  gracePeriod?: number;
  applyLoanProcessingFee: boolean;
  loanProcessingFeePercentage?: number;
  applyLoanInsurance: boolean;
  loanInsurancePercentage?: number;
  applyShareDeduction: boolean;
  shareAmount?: number;
}

// ========================
// PROPS
// ========================
interface InstitutionLoanApplicationFormProps {
  isOpen?: boolean;
  onClose: () => void;
  currentUserId: string;
  isEmbedded?: boolean;
}

// ========================
// FORMAT HELPER
// ========================
const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(n || 0);

// ========================
// COMPONENT
// ========================
export default function InstitutionLoanApplicationForm({
  isOpen = true,
  onClose,
  currentUserId,
  isEmbedded = false,
}: InstitutionLoanApplicationFormProps) {
  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Data
  const [institutions, setInstitutions] = useState<InstitutionFromDB[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);

  // Selections
  const [selectedInstitution, setSelectedInstitution] =
    useState<InstitutionFromDB | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(
    null
  );
  const [institutionSearchOpen, setInstitutionSearchOpen] = useState(false);

  // Guarantors
  const [guarantors, setGuarantors] = useState<GuarantorEntry[]>([]);
  const [guarantorSearchOpen, setGuarantorSearchOpen] = useState(false);
  const [guarantorQuery, setGuarantorQuery] = useState("");
  const [guarantorResults, setGuarantorResults] = useState<GuarantorResult[]>(
    []
  );
  const [searchingGuarantors, setSearchingGuarantors] = useState(false);

  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      administrators: [
        { name: "", post: "", mobileNumber: "", signature: "" },
        { name: "", post: "", mobileNumber: "", signature: "" },
      ],
      disbursementMethod: "SACCO_SAVINGS",
      hasRegistrationCertificate: false,
      hasLCRecommendation: false,
      hasVicarRecommendation: false,
      hasMinutes: false,
      hasByeLaws: false,
      hasDissolutionResolution: false,
      agreesToTerms: false,
      gracePeriod: 0,
      applyLoanProcessingFee: false,
      loanProcessingFeePercentage: 2,
      applyLoanInsurance: false,
      loanInsurancePercentage: 1,
      applyShareDeduction: false,
      shareAmount: 0,
    },
  });

  const {
    fields: adminFields,
    append: appendAdmin,
    remove: removeAdmin,
  } = useFieldArray({ control, name: "administrators" });

  const watched = watch();

  // ========================
  // LOAD DATA
  // ========================
  useEffect(() => {
    loadFormData();
  }, []);

  async function loadFormData() {
    try {
      setLoadingData(true);
      const [institutionsRes, productsRes] = await Promise.all([
        fetch("/api/v1/institutions").then((r) => r.json()),
        fetch("/api/v1/loan-products").then((r) => r.json()),
      ]);

      if (institutionsRes.data && Array.isArray(institutionsRes.data)) {
        const approved = institutionsRes.data.filter((inst: any) => inst.isApproved);
        setInstitutions(approved as any);
      }
      if (productsRes.data && Array.isArray(productsRes.data)) {
        setLoanProducts(productsRes.data as any);
      }
    } catch (e) {
      console.error("Failed to load form data:", e);
      toast.error("Failed to load form data");
    } finally {
      setLoadingData(false);
    }
  }

  // ========================
  // GUARANTOR SEARCH
  // ========================
  const searchGuarantors = useCallback(async (query: string) => {
    if (query.length < 2) {
      setGuarantorResults([]);
      return;
    }
    setSearchingGuarantors(true);
    try {
      const response = await fetch(`/api/v1/members/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setGuarantorResults(result.data);
      } else {
        setGuarantorResults([]);
      }
    } catch (err) {
      console.error("Guarantor search error:", err);
      setGuarantorResults([]);
    } finally {
      setSearchingGuarantors(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (guarantorQuery) searchGuarantors(guarantorQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [guarantorQuery, searchGuarantors]);

  const addGuarantor = (member: GuarantorResult) => {
    if (guarantors.find((g) => g.memberId === member.id)) {
      toast.error("This member is already added as a guarantor");
      return;
    }
    setGuarantors((prev) => [
      ...prev,
      {
        memberId: member.id,
        name: member.name,
        memberNumber: member.memberNumber,
        phone: member.phone,
        relationship: "",
      },
    ]);
    setGuarantorSearchOpen(false);
    setGuarantorQuery("");
  };

  const removeGuarantor = (memberId: string) => {
    setGuarantors((prev) => prev.filter((g) => g.memberId !== memberId));
  };

  // ========================
  // CALCULATIONS
  // ========================
  const calc = (() => {
    const amount = Number(watched.amountApplied);
    if (!selectedProduct || !amount || amount <= 0) return null;

    const principal = amount;
    const rate = selectedProduct.interestRate;
    const monthlyRate =
      selectedProduct.interestPeriod === "ANNUAL" ? rate / 12 : rate;
    const repaymentMonths =
      watched.repaymentPeriodMonths ||
      Math.round(selectedProduct.repaymentPeriodDays / 30);
    const totalInterest = principal * (monthlyRate / 100) * repaymentMonths;
    const totalAmountDue = principal + totalInterest;
    const monthlyPayment = totalAmountDue / repaymentMonths;

    // Deductions calc
    let processingFee = 0;
    if (watched.applyLoanProcessingFee) {
      processingFee = (principal * (Number(watched.loanProcessingFeePercentage) || 0)) / 100;
    }
    let insurance = 0;
    if (watched.applyLoanInsurance) {
      insurance = (principal * (Number(watched.loanInsurancePercentage) || 0)) / 100;
    }
    let shares = 0;
    if (watched.applyShareDeduction) {
      shares = Number(watched.shareAmount) || 0;
    }
    const totalDeductions = processingFee + insurance + shares;
    const netDisbursement = principal - totalDeductions;

    return {
      principal,
      totalInterest,
      totalAmountDue,
      monthlyPayment,
      monthlyRate,
      repaymentMonths,
      processingFee,
      insurance,
      shares,
      totalDeductions,
      netDisbursement,
    };
  })();

  // ========================
  // SUBMIT
  // ========================
  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);

      if (!selectedInstitution) {
        toast.error("Please select an institution");
        return;
      }
      if (!selectedProduct) {
        toast.error("Please select a loan product");
        return;
      }
      if (!data.agreesToTerms) {
        toast.error("Please accept the terms and conditions");
        return;
      }

      const validAdmins = data.administrators.filter(
        (a) => a.name.trim() && a.post.trim()
      );
      if (validAdmins.length < 2) {
        toast.error("At least 2 administrators are required");
        return;
      }

      // Compute net monthly income
      const monthlyRev = Number(data.monthlyRevenue) || 0;
      const monthlyExp = Number(data.monthlyExpenses) || 0;
      const netMonthlyIncome = monthlyRev - monthlyExp;

      const payload = {
        institutionId: selectedInstitution.id,
        loanProductId: selectedProduct.id,
        amountApplied: Number(data.amountApplied),
        purpose: data.purpose,
        repaymentPeriodMonths: data.repaymentPeriodMonths
          ? Number(data.repaymentPeriodMonths)
          : undefined,
        collateralOffered: data.collateralOffered || undefined,
        guarantors: guarantors.length > 0 ? guarantors : undefined,
        administrators: validAdmins,
        operatingInstructions: data.operatingInstructions,
        changeOfSignatoryInstructions: data.changeOfSignatoryInstructions,
        accountTitle: data.accountTitle,
        accountType: data.accountType,
        // Financial
        annualRevenue: Number(data.annualRevenue) || undefined,
        monthlyRevenue: monthlyRev || undefined,
        annualExpenses: Number(data.annualExpenses) || undefined,
        monthlyExpenses: monthlyExp || undefined,
        netMonthlyIncome: netMonthlyIncome || undefined,
        // Disbursement
        bankName:
          data.disbursementMethod === "BANK"
            ? data.bankName
            : data.disbursementMethod === "SACCO_SAVINGS"
            ? "SACCO Voluntary Savings"
            : undefined,
        bankBranch:
          data.disbursementMethod === "BANK" ? data.bankBranch : undefined,
        bankAccountNumber:
          data.disbursementMethod === "BANK"
            ? data.bankAccountNumber
            : undefined,
        mobileMoneyNumber:
          data.disbursementMethod === "MOBILE_MONEY"
            ? data.mobileMoneyNumber
            : undefined,
        // Docs
        hasRegistrationCertificate: data.hasRegistrationCertificate,
        hasLCRecommendation: data.hasLCRecommendation,
        hasVicarRecommendation: data.hasVicarRecommendation,
        hasMinutes: data.hasMinutes,
        hasByeLaws: data.hasByeLaws,
        hasDissolutionResolution: data.hasDissolutionResolution,
        // Terms
        applicantDeclaration: data.agreesToTerms,
        applicantSignature: data.applicantSignature,
        gracePeriod: Number(data.gracePeriod) || 0,
        interestType: selectedProduct.interestType,
        interestPeriod: selectedProduct.interestPeriod,
        // Deductions
        applyLoanProcessingFee: data.applyLoanProcessingFee,
        loanProcessingFeePercentage: data.applyLoanProcessingFee ? Number(data.loanProcessingFeePercentage) : undefined,
        applyLoanInsurance: data.applyLoanInsurance,
        loanInsurancePercentage: data.applyLoanInsurance ? Number(data.loanInsurancePercentage) : undefined,
        applyShareDeduction: data.applyShareDeduction,
        shareAmount: data.applyShareDeduction ? Number(data.shareAmount) : undefined,
      };

      const apiRes = await fetch("/api/v1/loans/applications/institution-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, currentUserId }),
      });
      const res = await apiRes.json();

      if (!apiRes.ok || res.error) {
        toast.error("Failed to submit application", {
          description: res.error,
        });
        return;
      }

      toast.success("Institution Loan Application Created!", {
        description: `Application for ${fmt(
          payload.amountApplied
        )} submitted for ${selectedInstitution.institutionName}`,
      });

      handleReset();

      if (res.success) {
        router.push(`/dashboard/loans/institution-loan-process-tracking`);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedInstitution(null);
    setSelectedProduct(null);
    setGuarantors([]);
    onClose();
  };

  // ========================
  // LOADING / EMPTY STATES
  // ========================
  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            Loading institutions and loan products...
          </p>
        </div>
      </div>
    );
  }

  if (institutions.length === 0) {
    return (
      <div className="p-8 text-center">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Approved Institutions Available
        </h3>
        <p className="text-gray-600 mb-4">
          There are no approved institutions that can apply for loans.
        </p>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </div>
    );
  }

  // ========================
  // RENDER
  // ========================
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ===================== A. INSTITUTION SELECTION ===================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Building2 className="h-4 w-4 text-blue-600" />
          <h3 className="text-lg font-semibold">
            A. Select Institution/Organization
          </h3>
        </div>

        <div className="space-y-3">
          <Label>Institution/Organization *</Label>
          <Popover
            open={institutionSearchOpen}
            onOpenChange={setInstitutionSearchOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full h-16 justify-between px-4 text-left"
              >
                {selectedInstitution ? (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {selectedInstitution.institutionName}
                      </span>
                      <span className="text-sm text-gray-500">
                        {selectedInstitution.institutionNumber} •{" "}
                        {selectedInstitution.district || "N/A"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Search className="h-4 w-4" />
                    <span>Search and select an institution...</span>
                  </div>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search by name, number, or district..."
                  className="h-12 text-base"
                />
                <CommandList>
                  <CommandEmpty>No institutions found.</CommandEmpty>
                  <CommandGroup className="max-h-80 overflow-y-auto">
                    {institutions.map((inst: any) => (
                      <CommandItem
                        key={inst.id}
                        value={`${inst.institutionName} ${inst.institutionNumber} ${inst.district || ""}`}
                        onSelect={() => {
                          setSelectedInstitution(inst);
                          setValue("institutionId", inst.id);
                          setInstitutionSearchOpen(false);
                          // Auto-fill bank & account details from institution
                          if (inst.accountTitle) setValue("accountTitle", inst.accountTitle);
                          if (inst.accountType) setValue("accountType", inst.accountType);
                          if (inst.bankName) setValue("bankName", inst.bankName);
                          if (inst.bankAccountNumber) setValue("bankAccountNumber", inst.bankAccountNumber);
                          if (inst.operatingInstructions) setValue("operatingInstructions", inst.operatingInstructions);
                          if (inst.signatoryChangeRules) setValue("changeOfSignatoryInstructions", inst.signatoryChangeRules);
                          // Auto-fill administrators if present
                          if (inst.administrators && Array.isArray(inst.administrators)) {
                            const admins = inst.administrators as Array<{name: string; post: string; mobileNumber: string; signature?: string}>;
                            if (admins.length > 0) {
                              // Remove all existing admin fields from the end first
                              for (let idx = adminFields.length - 1; idx >= 0; idx--) {
                                removeAdmin(idx);
                              }
                              // Then append from institution data
                              admins.forEach((admin) => {
                                appendAdmin({
                                  name: admin.name || "",
                                  post: admin.post || "",
                                  mobileNumber: admin.mobileNumber || "",
                                  signature: admin.signature || "",
                                });
                              });
                            }
                          }
                        }}
                        className="p-3"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Building2 className="h-5 w-5 text-gray-500" />
                          <div className="flex-1">
                            <p className="font-medium">
                              {inst.institutionName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {inst.institutionNumber}
                              {inst.district && ` • ${inst.district}`}
                            </p>
                          </div>
                          <span className="text-xs text-blue-600 capitalize">
                            {inst.institutionType}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedInstitution && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900">
                    Selected: {selectedInstitution.institutionName}
                  </h4>
                  <div className="text-xs text-blue-600 flex gap-3 mt-1">
                    <span>📧 {selectedInstitution.institutionEmail}</span>
                    <span>📱 {selectedInstitution.institutionPhone}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Only show remaining sections if institution is selected */}
      {selectedInstitution && (
        <>
          {/* ===================== B. LOAN DETAILS ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <DollarSign className="h-4 w-4 text-green-600" />
              <h3 className="text-lg font-semibold">B. Loan Details</h3>
            </div>

            <div className="space-y-3">
              <Label>Loan Product *</Label>
              <Select
                onValueChange={(val) => {
                  setValue("loanProductId", val);
                  const prod = loanProducts.find(
                    (p) => p.id === val
                  ) as LoanProduct;
                  setSelectedProduct(prod || null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a loan product" />
                </SelectTrigger>
                <SelectContent>
                  {loanProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.interestRate}%{" "}
                      {p.interestPeriod === "ANNUAL" ? "p.a." : "p.m."} (
                      {fmt(p.minAmount)} - {fmt(p.maxAmount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Product:</span>
                    <p className="font-medium">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Interest Rate:</span>
                    <p className="font-medium">
                      {selectedProduct.interestRate}%{" "}
                      {selectedProduct.interestPeriod === "ANNUAL"
                        ? "per annum"
                        : "per month"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Range:</span>
                    <p className="font-medium">
                      {fmt(selectedProduct.minAmount)} -{" "}
                      {fmt(selectedProduct.maxAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Loan Amount Requested (UGX) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("amountApplied", {
                    required: "Amount is required",
                    min: {
                      value: 1,
                      message: "Amount must be greater than 0",
                    },
                  })}
                />
                {errors.amountApplied && (
                  <p className="text-sm text-red-500">
                    {errors.amountApplied.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Repayment Period (Months)</Label>
                <Input
                  type="number"
                  placeholder="12"
                  {...register("repaymentPeriodMonths")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Grace Period (Days)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("gracePeriod")}
                />
              </div>

              <div className="space-y-2">
                <Label>Collateral Offered</Label>
                <Input
                  placeholder="Describe collateral..."
                  {...register("collateralOffered")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Loan Purpose *</Label>
              <Textarea
                {...register("purpose", { required: "Purpose is required" })}
                placeholder="Describe the purpose of this loan"
                className="min-h-[100px]"
              />
              {errors.purpose && (
                <p className="text-sm text-red-500">
                  {errors.purpose.message}
                </p>
              )}
            </div>

            {/* Loan Calculation Preview */}
            {calc && (
              <div className="bg-gradient-to-r from-gray-50 to-orange-50 p-6 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-600 mb-3">
                  📊 Loan Estimate
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Principal:</span>
                    <p className="font-semibold text-lg">
                      {fmt(calc.principal)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">
                      Total Interest ({calc.monthlyRate.toFixed(1)}%/mo ×{" "}
                      {calc.repaymentMonths}mo):
                    </span>
                    <p className="font-semibold text-lg text-orange-600">
                      {fmt(calc.totalInterest)}
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

                {calc.totalDeductions > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-gray-500">
                    {calc.processingFee > 0 && (
                      <div>
                        <span>Processing Fee:</span>
                        <p className="text-red-500">-{fmt(calc.processingFee)}</p>
                      </div>
                    )}
                    {calc.insurance > 0 && (
                      <div>
                        <span>Insurance:</span>
                        <p className="text-red-500">-{fmt(calc.insurance)}</p>
                      </div>
                    )}
                    {calc.shares > 0 && (
                      <div>
                        <span>Share Capital / Equity Contribution:</span>
                        <p className="text-red-500">-{fmt(calc.shares)}</p>
                      </div>
                    )}
                    <div className="col-span-full md:col-span-1 md:ml-auto">
                       <span className="text-blue-700 font-bold">Net Disbursement:</span>
                       <p className="text-lg font-bold text-blue-800">{fmt(calc.netDisbursement)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ===================== C. LOAN DEDUCTIONS (OPTIONAL) ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Calculator className="h-4 w-4 text-orange-600" />
              <h3 className="text-lg font-semibold">C. Loan Deductions (Optional)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Processing Fee */}
              <div className="p-4 rounded-lg border bg-white space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applyLoanProcessingFee"
                    checked={watched.applyLoanProcessingFee}
                    onCheckedChange={(v) => setValue("applyLoanProcessingFee", v === true)}
                  />
                  <Label htmlFor="applyLoanProcessingFee">Apply Processing Fee</Label>
                </div>
                {watched.applyLoanProcessingFee && (
                  <div className="space-y-1">
                    <Label className="text-xs">Fee Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register("loanProcessingFeePercentage")}
                    />
                  </div>
                )}
              </div>

              {/* Insurance */}
              <div className="p-4 rounded-lg border bg-white space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applyLoanInsurance"
                    checked={watched.applyLoanInsurance}
                    onCheckedChange={(v) => setValue("applyLoanInsurance", v === true)}
                  />
                  <Label htmlFor="applyLoanInsurance">Apply Insurance</Label>
                </div>
                {watched.applyLoanInsurance && (
                  <div className="space-y-1">
                    <Label className="text-xs">Insurance Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register("loanInsurancePercentage")}
                    />
                  </div>
                )}
              </div>

              {/* Shares */}
              <div className="p-4 rounded-lg border bg-white space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applyShareDeduction"
                    checked={watched.applyShareDeduction}
                    onCheckedChange={(v) => setValue("applyShareDeduction", v === true)}
                  />
                  <Label htmlFor="applyShareDeduction">
                    Apply Share Capital / Equity Contribution
                  </Label>
                </div>
                {watched.applyShareDeduction && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Share Capital / Equity Amount (UGX)
                    </Label>
                    <Input
                      type="number"
                      {...register("shareAmount")}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ===================== C. FINANCIAL INFORMATION ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Calculator className="h-4 w-4 text-purple-600" />
              <h3 className="text-lg font-semibold">
                D. Financial Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Annual Revenue (UGX)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("annualRevenue")}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Revenue (UGX)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("monthlyRevenue")}
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Expenses (UGX)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("annualExpenses")}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Expenses (UGX)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("monthlyExpenses")}
                />
              </div>
            </div>

            {watched.monthlyRevenue && watched.monthlyExpenses && (
              <div className="p-3 bg-gray-50 rounded border text-sm">
                <span className="text-gray-600">
                  Net Monthly Income:{" "}
                </span>
                <span className="font-semibold">
                  {fmt(
                    Number(watched.monthlyRevenue) -
                      Number(watched.monthlyExpenses)
                  )}
                </span>
              </div>
            )}
          </section>

          {/* ===================== D. GUARANTOR SEARCH ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <UserPlus className="h-4 w-4 text-teal-600" />
              <h3 className="text-lg font-semibold">E. Guarantors</h3>
            </div>

            <p className="text-sm text-gray-600">
              Search and add SACCO members as guarantors for this loan.
            </p>

            {/* Inline Guarantor Search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Type member name, number, or phone to search..."
                  value={guarantorQuery}
                  onChange={(e) => {
                    setGuarantorQuery(e.target.value);
                    setGuarantorSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (guarantorQuery.length >= 2) setGuarantorSearchOpen(true);
                  }}
                  className="pl-10 h-12 text-base"
                />
                {searchingGuarantors && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {guarantorSearchOpen && guarantorQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                  {searchingGuarantors && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Searching members...
                    </div>
                  )}
                  {!searchingGuarantors && guarantorResults.length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No members found for &ldquo;{guarantorQuery}&rdquo;
                    </div>
                  )}
                  {guarantorResults.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors border-b last:border-b-0"
                      onClick={() => {
                        addGuarantor(member);
                        setGuarantorSearchOpen(false);
                        setGuarantorQuery("");
                      }}
                    >
                      <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {member.memberNumber} • {member.phone} • {member.branch}
                        </p>
                      </div>
                      <Plus className="h-5 w-5 text-green-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Added Guarantors */}
            {guarantors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {guarantors.length} guarantor(s) added
                </p>
                {guarantors.map((g, i) => (
                  <div
                    key={g.memberId}
                    className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200"
                  >
                    <div className="h-8 w-8 rounded-full bg-teal-200 flex items-center justify-center text-sm font-bold text-teal-700">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-gray-500">
                        {g.memberNumber} • {g.phone}
                      </p>
                    </div>
                    <Input
                      placeholder="Relationship"
                      className="w-40 h-8 text-sm"
                      value={g.relationship}
                      onChange={(e) => {
                        const updated = [...guarantors];
                        updated[i].relationship = e.target.value;
                        setGuarantors(updated);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuarantor(g.memberId)}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ===================== E. BANKING & DISBURSEMENT ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <h3 className="text-lg font-semibold">
                F. Banking & Disbursement Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Account Title</Label>
                <Input
                  placeholder="Account title"
                  {...register("accountTitle")}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  onValueChange={(val) => setValue("accountType", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings Account</SelectItem>
                    <SelectItem value="current">Current Account</SelectItem>
                    <SelectItem value="fixed_deposit">
                      Fixed Deposit Account
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Disbursement Method *</Label>
              <Select
                defaultValue="SACCO_SAVINGS"
                onValueChange={(val) => setValue("disbursementMethod", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SACCO_SAVINGS">
                    💰 SACCO Voluntary Savings Account (Default)
                  </SelectItem>
                  <SelectItem value="BANK">🏦 Bank Account</SelectItem>
                  <SelectItem value="MOBILE_MONEY">
                    📱 Mobile Money
                  </SelectItem>
                </SelectContent>
              </Select>
              {watched.disbursementMethod === "SACCO_SAVINGS" && (
                <p className="text-sm text-green-600 italic">
                  Funds will be disbursed to the institution&apos;s SACCO
                  voluntary savings account.
                </p>
              )}
            </div>

            {watched.disbursementMethod === "BANK" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input placeholder="Bank name" {...register("bankName")} />
                </div>
                <div className="space-y-2">
                  <Label>Bank Branch</Label>
                  <Input
                    placeholder="Bank branch"
                    {...register("bankBranch")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    placeholder="Account number"
                    {...register("bankAccountNumber")}
                  />
                </div>
              </div>
            )}

            {watched.disbursementMethod === "MOBILE_MONEY" && (
              <div className="space-y-2">
                <Label>Mobile Money Number</Label>
                <Input
                  placeholder="07..."
                  {...register("mobileMoneyNumber")}
                />
              </div>
            )}
          </section>

          {/* ===================== F. ADMINISTRATORS ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Users className="h-4 w-4 text-orange-600" />
              <h3 className="text-lg font-semibold">
                G. Current Administrators/Managers
              </h3>
            </div>

            <p className="text-sm text-gray-600">
              Provide details of at least 2 administrators who will control the
              account.
            </p>

            {adminFields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4 bg-orange-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Administrator {index + 1}</h4>
                  {adminFields.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeAdmin(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name *</Label>
                    <Input
                      placeholder="Full name"
                      {...register(`administrators.${index}.name`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position/Post *</Label>
                    <Input
                      placeholder="e.g., Chairperson"
                      {...register(`administrators.${index}.post`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mobile Number</Label>
                    <Input
                      placeholder="07..."
                      {...register(`administrators.${index}.mobileNumber`)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                appendAdmin({
                  name: "",
                  post: "",
                  mobileNumber: "",
                  signature: "",
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Administrator
            </Button>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Account Operating Instructions/Mandate *</Label>
                <Textarea
                  {...register("operatingInstructions", {
                    required: "Operating instructions are required",
                  })}
                  placeholder="e.g., 'Any two signatories to sign'"
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Change of Signatory Instructions</Label>
                <Textarea
                  {...register("changeOfSignatoryInstructions")}
                  placeholder="Describe procedures for changing signatories"
                />
              </div>
            </div>
          </section>

          {/* ===================== G. SUPPORTING DOCUMENTS ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Upload className="h-4 w-4 text-indigo-600" />
              <h3 className="text-lg font-semibold">
                H. Supporting Documents Checklist
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "hasRegistrationCertificate" as const,
                  label: "Registration Certificate",
                },
                {
                  name: "hasLCRecommendation" as const,
                  label: "LC Recommendation Letter",
                },
                {
                  name: "hasVicarRecommendation" as const,
                  label: "Vicar/Parish Recommendation",
                },
                { name: "hasMinutes" as const, label: "Meeting Minutes" },
                { name: "hasByeLaws" as const, label: "Bye-Laws / Constitution" },
                {
                  name: "hasDissolutionResolution" as const,
                  label: "Dissolution Resolution",
                },
              ].map((doc) => (
                <div
                  key={doc.name}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <Checkbox
                    id={doc.name}
                    checked={watched[doc.name] || false}
                    onCheckedChange={(checked) =>
                      setValue(doc.name, checked === true)
                    }
                  />
                  <Label htmlFor={doc.name} className="text-sm cursor-pointer">
                    {doc.label}
                  </Label>
                </div>
              ))}
            </div>
          </section>

          {/* ===================== H. DECLARATION & SUBMIT ===================== */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <FileSignature className="h-4 w-4 text-red-600" />
              <h3 className="text-lg font-semibold">
                I. Declaration & Submission
              </h3>
            </div>

            <div className="space-y-2">
              <Label>Applicant Signature (Type Full Name)</Label>
              <Input
                placeholder="Type your full name as signature"
                {...register("applicantSignature")}
              />
            </div>

            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <Checkbox
                id="agreesToTerms"
                checked={watched.agreesToTerms || false}
                onCheckedChange={(checked) =>
                  setValue("agreesToTerms", checked === true)
                }
              />
              <Label htmlFor="agreesToTerms" className="text-sm cursor-pointer">
                I declare that the information provided is true and accurate. I
                agree to the terms and conditions of the SACCO loan facility and
                authorize the SACCO to verify all information provided.
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !watched.agreesToTerms}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Institution Loan Application
              </Button>
            </div>
          </section>
        </>
      )}
    </form>
  );
}
