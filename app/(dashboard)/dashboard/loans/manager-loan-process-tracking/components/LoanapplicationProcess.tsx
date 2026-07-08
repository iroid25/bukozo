// app/dashboard/loans/manager-loan-process-tracking/components/ManagerLoanApplicationsManager.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Eye,
  RefreshCw,
  MoreHorizontal,
  User,
  Search,
  FileDown,
  Calendar,
  Phone,
  Mail,
  Briefcase,
  Users,
  Receipt,
  Percent,
  Banknote,
  FileText,
  Printer,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Link from "next/link";
import LoanRepaymentCreateForm from "@/app/(dashboard)/dashboard/loan-repayments/components/LoanRepaymentCreateForm";
import { Send } from "lucide-react";

interface LoanApplication {
  id: string;
  isInstitution?: boolean;
  memberId: string;
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
  loanProduct: {
    id: string;
    name: string;
    interestRate: number;
    minAmount: number;
    maxAmount: number;
    repaymentPeriodDays: number;
  };
  amountApplied: number;
  purpose: string | null;
  status: string;
  stage: string;
  applicationDate: Date;
  approvalDate?: Date | null;
  rejectionReason?: string | null;
  employer?: string | null;
  employmentStatus?: string | null;
  grossMonthlyIncome?: number | null;
  netMonthlyIncome?: number | null;
  repaymentPeriodMonths?: number | null;
  guarantors?: any;
  applyLoanProcessingFee?: boolean;
  loanProcessingFeePercentage?: number | null;
  applyLoanInsurance?: boolean;
  loanInsurancePercentage?: number | null;
  applyShareDeduction?: boolean;
  shareAmount?: number | null;
  collateralType?: string | null;
  collateralValue?: number | null;
  hasExistingLoanWithSacco?: boolean;
  existingLoanBalance?: number | null;
  approver?: {
    id: string;
    name: string;
    role: string;
  } | null;
  loan?: {
    id: string;
    amountGranted: number;
    totalAmountDue: number;
    outstandingBalance: number;
    disbursementDate: Date;
    dueDate: Date;
  } | null;
}

interface Statistics {
  pending: number;
  approved: number;
  rejected: number;
  disbursed: number;
  totalAmount: number;
}

interface Props {
  initialApplications: LoanApplication[];
  initialStatistics: Statistics;
  loanOfficers: Array<{ value: string; label: string }>;
  userRole: string;
  currentUserId: string;
  currentUserName: string;
  highlightId?: string;
}

export default function ManagerLoanApplicationsManager({
  initialApplications,
  initialStatistics,
  loanOfficers,
  userRole,
  currentUserId,
  currentUserName,
  highlightId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Fetch applications via API
  const { data: appsData, isLoading: isAppsLoading } = useQuery({
    queryKey: ["loan-applications-process"],
    queryFn: async () => {
      const response = await axios.get("/api/v1/loans/applications?limit=200");
      return response.data.data as LoanApplication[];
    },
    initialData: initialApplications,
  });

  // Fetch statistics via API
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["loan-application-statistics"],
    queryFn: async () => {
      const response = await axios.get("/api/v1/loans/applications/statistics");
      return response.data as Statistics;
    },
    initialData: initialStatistics,
  });

  const applications = appsData || initialApplications;
  const statistics = statsData || initialStatistics;

  // Mutation for loan decision
  const decisionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...data } = payload;
      const response = await axios.post(`/api/v1/loans/applications/${id}/decision`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-applications-process"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-statistics"] });
      toast.success(
        `Application ${decision === "APPROVED" ? "approved and moved to disbursement queue" : "rejected"} successfully!`
      );
      setShowDecisionDialog(false);
      setShowDetailsDialog(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to process decision";
      toast.error(message);
    },
  });

  // Mutation for resending notification
  const resendNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.post(`/api/v1/loans/applications/${id}/resend-notification`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Notification resent successfully!");
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to resend notification";
      toast.error(message);
    },
  });


  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [approvedRepaymentPeriod, setApprovedRepaymentPeriod] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedLoanOfficer, setSelectedLoanOfficer] = useState("");
  const [disbursementMethod, setDisbursementMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [selectedLoanIdForRepayment, setSelectedLoanIdForRepayment] = useState<string | undefined>(undefined);
  const [selectedIsInstitutionForRepayment, setSelectedIsInstitutionForRepayment] = useState(false);

  // Auto-open highlighted application
  useEffect(() => {
    if (highlightId) {
      const app = applications.find((a) => a.id === highlightId);
      if (app) {
        handleViewDetails(app);
      }
    }
  }, [highlightId]);

  // Check if user can approve
  const canApprove = ["ADMIN", "BRANCHMANAGER"].includes(
    userRole
  );

  // Filter applications
  const filteredApplications = useMemo(() => {
    let filtered = [...applications];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((app) => {
        const searchableText = [
          app.id,
          app.member.memberNumber,
          app.member.user.name,
          app.member.user.email,
          app.loanProduct.name,
          app.status,
          app.purpose,
          app.employer,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    return filtered;
  }, [applications, searchQuery, statusFilter]);

  // Format currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  // Calculate deductions
  const calculateDeductions = (app: LoanApplication) => {
    const amountGranted = Number(approvedAmount) || app.amountApplied;
    let totalDeductions = 0;
    const breakdown: any = {
      processingFee: 0,
      insurance: 0,
      shareCapital: 0,
      existingLoanRecovery: 0,
    };

    if (app.applyLoanProcessingFee && app.loanProcessingFeePercentage) {
      breakdown.processingFee =
        (amountGranted * app.loanProcessingFeePercentage) / 100;
      totalDeductions += breakdown.processingFee;
    }

    if (app.applyLoanInsurance && app.loanInsurancePercentage) {
      breakdown.insurance =
        (amountGranted * app.loanInsurancePercentage) / 100;
      totalDeductions += breakdown.insurance;
    }

    if (app.applyShareDeduction && app.shareAmount) {
      breakdown.shareCapital = app.shareAmount;
      totalDeductions += breakdown.shareCapital;
    }

    if (app.existingLoanBalance && app.existingLoanBalance > 0) {
      breakdown.existingLoanRecovery = app.existingLoanBalance;
      totalDeductions += breakdown.existingLoanRecovery;
    }

    const netAmount = amountGranted - totalDeductions;

    return {
      grossAmount: amountGranted,
      ...breakdown,
      totalDeductions,
      netAmount,
    };
  };

  // Calculate loan details
  const calculateLoanDetails = (
    principal: number,
    rate: number,
    days: number
  ) => {
    const annualInterest = (principal * rate) / 100;
    const periodInterest = (annualInterest * days) / 365;
    const totalDue = principal + periodInterest;

    return {
      interest: periodInterest,
      totalDue,
    };
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, any> = {
      PENDING: {
        icon: Clock,
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      },
      APPROVED: {
        icon: CheckCircle,
        color: "text-green-600 bg-green-50 border-green-200",
      },
      REJECTED: {
        icon: XCircle,
        color: "text-red-600 bg-red-50 border-red-200",
      },
      DISBURSED: {
        icon: DollarSign,
        color: "text-purple-600 bg-purple-50 border-purple-200",
      },
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Generate PDF
  const generatePDF = (app: LoanApplication) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const deductions = calculateDeductions(app);
    const loanDetails = calculateLoanDetails(
      deductions.grossAmount,
      app.loanProduct.interestRate,
      app.loanProduct.repaymentPeriodDays
    );

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("LOAN APPLICATION DETAILS", pageWidth / 2, 20, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Application Date: ${format(new Date(app.applicationDate), "dd MMM yyyy")}`,
      pageWidth / 2,
      28,
      { align: "center" }
    );
    doc.text(`Application ID: ${app.id}`, pageWidth / 2, 34, {
      align: "center",
    });

    // Status
    doc.setFillColor(
      app.status === "APPROVED" ? 34 : app.status === "REJECTED" ? 220 : 250,
      app.status === "APPROVED" ? 197 : app.status === "REJECTED" ? 38 : 204,
      app.status === "APPROVED" ? 94 : app.status === "REJECTED" ? 38 : 0
    );
    doc.roundedRect(pageWidth / 2 - 15, 38, 30, 7, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(app.status, pageWidth / 2, 43, { align: "center" });
    doc.setTextColor(0, 0, 0);

    let yPos = 55;

    // Member Details
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MEMBER INFORMATION", 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const memberDetails = [
      ["Name:", app.member.user.name],
      ["Member Number:", app.member.memberNumber],
      ["Email:", app.member.user.email || "N/A"],
      ["Phone:", app.member.user.phone || "N/A"],
      ["Employer:", app.employer || "N/A"],
      ["Employment Status:", app.employmentStatus || "N/A"],
    ];

    memberDetails.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(String(label), 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 70, yPos);
      yPos += 6;
    });

    // Loan Details
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LOAN DETAILS", 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const loanInfo = [
      ["Loan Product:", app.loanProduct.name],
      ["Interest Rate:", `${app.loanProduct.interestRate}%`],
      ["Amount Applied:", fmt(app.amountApplied)],
      ["Repayment Period:", `${app.loanProduct.repaymentPeriodDays} days`],
    ];

    loanInfo.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(String(label), 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 70, yPos);
      yPos += 6;
    });

    // Deductions Breakdown
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DEDUCTIONS BREAKDOWN", 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const deductionsInfo = [
      ["Gross Amount:", fmt(deductions.grossAmount)],
      ["Processing Fee:", fmt(deductions.processingFee)],
      ["Insurance:", fmt(deductions.insurance)],
      ["Share Capital:", fmt(deductions.shareCapital)],
      ["Existing Loan Recovery:", fmt(deductions.existingLoanRecovery)],
      ["Total Deductions:", fmt(deductions.totalDeductions)],
      ["Net Amount to Credit:", fmt(deductions.netAmount)],
    ];

    deductionsInfo.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(String(label), 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 70, yPos);
      yPos += 6;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );

    doc.save(
      `loan-application-${app.member.memberNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`
    );
  };

  // Print application
  const printApplication = (app: LoanApplication) => {
    const deductions = calculateDeductions(app);
    const loanDetails = calculateLoanDetails(
      deductions.grossAmount,
      app.loanProduct.interestRate,
      app.loanProduct.repaymentPeriodDays
    );

    const printWindow = window.open("", "", "height=900,width=900");
    if (!printWindow) return;

    const guarantors = Array.isArray(app.guarantors) ? app.guarantors : [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Application - ${app.member.memberNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 10px; color: #111; background: #fff; }
            .page { width: 210mm; margin: 0 auto; padding: 12mm 14mm; }

            /* HEADER */
            .org-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a5c38; padding-bottom: 8px; margin-bottom: 4px; }
            .org-name { font-size: 17px; font-weight: bold; color: #1a5c38; letter-spacing: 0.5px; }
            .org-sub { font-size: 9px; color: #555; margin-top: 2px; }
            .form-title-bar { background: #1a5c38; color: #fff; text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1px; padding: 5px 0; margin: 6px 0 10px; }

            /* REF ROW */
            .ref-row { display: flex; gap: 8px; margin-bottom: 8px; }
            .ref-box { border: 1px solid #888; padding: 3px 6px; font-size: 9px; flex: 1; }
            .ref-box span { font-weight: bold; }

            /* SECTION HEADER */
            .sec-head { background: #1a5c38; color: #fff; font-size: 10px; font-weight: bold; padding: 3px 6px; letter-spacing: 0.5px; margin-top: 8px; margin-bottom: 0; }

            /* FIELD TABLE */
            table.fields { width: 100%; border-collapse: collapse; }
            table.fields td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; }
            table.fields td.lbl { font-weight: bold; width: 22%; background: #f4f4f4; color: #333; white-space: nowrap; }
            table.fields td.val { width: 28%; }
            table.fields tr.full-row td.val { width: auto; }

            /* DEDUCTIONS TABLE */
            table.ded { width: 100%; border-collapse: collapse; margin-top: 0; }
            table.ded td { border: 1px solid #bbb; padding: 3px 6px; }
            table.ded td.lbl { font-weight: bold; background: #f4f4f4; width: 60%; }
            table.ded td.amt { text-align: right; width: 40%; }
            table.ded tr.total td { font-weight: bold; background: #e8f5e9; }
            table.ded tr.net td { font-weight: bold; background: #1a5c38; color: #fff; font-size: 11px; }
            table.ded tr.deduct td { color: #c00; }

            /* GUARANTORS */
            table.guar { width: 100%; border-collapse: collapse; margin-top: 0; }
            table.guar th { background: #2d7a50; color: #fff; padding: 3px 5px; font-size: 9px; border: 1px solid #bbb; text-align: left; }
            table.guar td { border: 1px solid #bbb; padding: 3px 5px; font-size: 9px; }
            table.guar tr:nth-child(even) td { background: #f8f8f8; }

            /* SIGNATURE */
            .sig-section { display: flex; gap: 20px; margin-top: 10px; }
            .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 3px; font-size: 9px; color: #555; }

            /* STATUS BADGE */
            .badge { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 9px; font-weight: bold; }
            .badge-pending { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
            .badge-approved { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
            .badge-rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .badge-disbursed { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }

            .footer { margin-top: 10px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ddd; padding-top: 4px; }

            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { padding: 8mm 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="page">

            <!-- ORG HEADER -->
            <div class="org-header">
              <div>
                <div class="org-name">BUKONZO UNITED TEACHERS SACCO</div>
                <div class="org-sub">Empowering Members Through Savings & Credit</div>
              </div>
              <div style="text-align:right; font-size:9px; color:#555;">
                <div>Application Date: <strong>${format(new Date(app.applicationDate), "dd MMM yyyy")}</strong></div>
                <div>Status: <span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></div>
              </div>
            </div>

            <div class="form-title-bar">LOAN APPLICATION FORM</div>

            <!-- REF ROW -->
            <div class="ref-row">
              <div class="ref-box">Application Ref: <span>${app.id.slice(0, 12).toUpperCase()}</span></div>
              <div class="ref-box">Member No.: <span>${app.member.memberNumber}</span></div>
              <div class="ref-box">Loan Product: <span>${app.loanProduct.name}</span></div>
              <div class="ref-box">Amount Applied: <span>${fmt(app.amountApplied)}</span></div>
            </div>

            <!-- SECTION 1: APPLICANT INFORMATION -->
            <div class="sec-head">SECTION 1: APPLICANT INFORMATION</div>
            <table class="fields">
              <tr>
                <td class="lbl">Full Name</td>
                <td class="val">${app.member.user.name}</td>
                <td class="lbl">Member Number</td>
                <td class="val">${app.member.memberNumber}</td>
              </tr>
              <tr>
                <td class="lbl">Phone</td>
                <td class="val">${app.member.user.phone || "N/A"}</td>
                <td class="lbl">Email Address</td>
                <td class="val">${app.member.user.email || "N/A"}</td>
              </tr>
              <tr>
                <td class="lbl">Employment Status</td>
                <td class="val">${app.employmentStatus || "N/A"}</td>
                <td class="lbl">Employer</td>
                <td class="val">${app.employer || "N/A"}</td>
              </tr>
              <tr>
                <td class="lbl">Gross Monthly Income</td>
                <td class="val">${app.grossMonthlyIncome ? fmt(app.grossMonthlyIncome) : "N/A"}</td>
                <td class="lbl">Net Monthly Income</td>
                <td class="val">${app.netMonthlyIncome ? fmt(app.netMonthlyIncome) : "N/A"}</td>
              </tr>
            </table>

            <!-- SECTION 2: LOAN INFORMATION -->
            <div class="sec-head">SECTION 2: LOAN INFORMATION</div>
            <table class="fields">
              <tr>
                <td class="lbl">Loan Product</td>
                <td class="val">${app.loanProduct.name}</td>
                <td class="lbl">Interest Rate</td>
                <td class="val">${app.loanProduct.interestRate}% per annum</td>
              </tr>
              <tr>
                <td class="lbl">Amount Applied</td>
                <td class="val">${fmt(app.amountApplied)}</td>
                <td class="lbl">Repayment Period</td>
                <td class="val">${app.repaymentPeriodMonths || Math.round(app.loanProduct.repaymentPeriodDays / 30)} months</td>
              </tr>
              <tr>
                <td class="lbl">Mode of Repayment</td>
                <td class="val">${(app as any).modeOfRepayment || "N/A"}</td>
                <td class="lbl">Application Date</td>
                <td class="val">${format(new Date(app.applicationDate), "dd MMMM yyyy")}</td>
              </tr>
              ${app.purpose ? `
              <tr>
                <td class="lbl">Purpose of Loan</td>
                <td class="val" colspan="3">${app.purpose}</td>
              </tr>` : ""}
            </table>

            <!-- SECTION 3: COLLATERAL INFORMATION -->
            <div class="sec-head">SECTION 3: COLLATERAL / SECURITY</div>
            <table class="fields">
              <tr>
                <td class="lbl">Collateral Type</td>
                <td class="val">${app.collateralType || "N/A"}</td>
                <td class="lbl">Estimated Value</td>
                <td class="val">${app.collateralValue ? fmt(app.collateralValue) : "N/A"}</td>
              </tr>
              <tr>
                <td class="lbl">Share Deduction</td>
                <td class="val">${app.applyShareDeduction ? fmt(app.shareAmount || 0) : "N/A"}</td>
                <td class="lbl">Existing Loan Balance</td>
                <td class="val">${app.hasExistingLoanWithSacco ? fmt(app.existingLoanBalance || 0) : "None"}</td>
              </tr>
            </table>

            <!-- SECTION 4: DEDUCTIONS BREAKDOWN -->
            <div class="sec-head">SECTION 4: DEDUCTIONS BREAKDOWN</div>
            <table class="ded">
              <tr>
                <td class="lbl">Gross Loan Amount</td>
                <td class="amt">${fmt(deductions.grossAmount)}</td>
              </tr>
              ${deductions.processingFee > 0 ? `<tr class="deduct"><td class="lbl">Less: Processing Fee (${app.loanProcessingFeePercentage}%)</td><td class="amt">- ${fmt(deductions.processingFee)}</td></tr>` : ""}
              ${deductions.insurance > 0 ? `<tr class="deduct"><td class="lbl">Less: Loan Insurance (${app.loanInsurancePercentage}%)</td><td class="amt">- ${fmt(deductions.insurance)}</td></tr>` : ""}
              ${deductions.shareCapital > 0 ? `<tr class="deduct"><td class="lbl">Less: Share Capital Contribution</td><td class="amt">- ${fmt(deductions.shareCapital)}</td></tr>` : ""}
              ${deductions.existingLoanRecovery > 0 ? `<tr class="deduct"><td class="lbl">Less: Existing Loan Recovery</td><td class="amt">- ${fmt(deductions.existingLoanRecovery)}</td></tr>` : ""}
              <tr class="total">
                <td class="lbl">Total Deductions</td>
                <td class="amt">- ${fmt(deductions.totalDeductions)}</td>
              </tr>
              <tr class="net">
                <td class="lbl">NET AMOUNT TO BE CREDITED TO MEMBER</td>
                <td class="amt">${fmt(deductions.netAmount)}</td>
              </tr>
            </table>

            <!-- SECTION 5: GUARANTORS -->
            ${guarantors.length > 0 ? `
            <div class="sec-head">SECTION 5: GUARANTORS</div>
            <table class="guar">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name</th>
                  <th>Relationship</th>
                  <th>Phone</th>
                  <th>Member No.</th>
                </tr>
              </thead>
              <tbody>
                ${guarantors.map((g: any, i: number) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${g.fullName || "N/A"}</td>
                    <td>${g.relationship || "N/A"}</td>
                    <td>${g.phone || "N/A"}</td>
                    <td>${g.membershipNumber || "N/A"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>` : `
            <div class="sec-head">SECTION 5: GUARANTORS</div>
            <table class="fields"><tr><td style="padding:6px; color:#777;">No guarantors provided for this application.</td></tr></table>`}

            <!-- SECTION 6: APPROVAL INFO (if approved) -->
            ${app.approver ? `
            <div class="sec-head">SECTION 6: APPROVAL INFORMATION</div>
            <table class="fields">
              <tr>
                <td class="lbl">Approved By</td>
                <td class="val">${app.approver.name} (${app.approver.role})</td>
                <td class="lbl">Approval Date</td>
                <td class="val">${app.approvalDate ? format(new Date(app.approvalDate), "dd MMM yyyy") : "N/A"}</td>
              </tr>
            </table>` : ""}

            <!-- DECLARATION & SIGNATURES -->
            <div class="sec-head">DECLARATION & SIGNATURES</div>
            <table class="fields">
              <tr>
                <td colspan="4" style="padding: 5px; font-size: 9px; line-height: 1.5; color: #444;">
                  I/We hereby apply for the above loan and declare that the information given above is true and correct.
                  I/We agree to abide by the SACCO's terms and conditions governing loans. I/We authorize the SACCO
                  to deduct repayments from my/our salary/account as may be applicable.
                </td>
              </tr>
            </table>
            <div class="sig-section">
              <div class="sig-box">
                <div style="height: 30px;"></div>
                Applicant Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _________________
              </div>
              <div class="sig-box">
                <div style="height: 30px;"></div>
                Loans Officer &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _________________
              </div>
              <div class="sig-box">
                <div style="height: 30px;"></div>
                Manager / Approver &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _________________
              </div>
            </div>

            <div class="footer">
              BUKONZO UNITED TEACHERS SACCO &mdash; Loan Application Form &mdash;
              Printed: ${format(new Date(), "dd MMM yyyy HH:mm")} &mdash;
              Ref: ${app.id.slice(0, 12).toUpperCase()}
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Handle view details
  const handleViewDetails = (app: LoanApplication) => {
    setSelectedApplication(app);
    setApprovedAmount(app.amountApplied.toString());
    setApprovedRepaymentPeriod(
      (app.repaymentPeriodMonths || Math.ceil((app.loanProduct.repaymentPeriodDays || 30) / 30)).toString()
    );
    setShowDetailsDialog(true);
  };

  // Handle open decision dialog
  const handleOpenDecisionDialog = () => {
    if (!selectedApplication) return;
    setDecision("APPROVED");
    setRejectionReason("");
    setSelectedLoanOfficer("");
    setDisbursementMethod("CASH");
    setShowDecisionDialog(true);
  };

  // Handle submit decision
  const handleSubmitDecision = async () => {
    if (!selectedApplication) return;

    if (decision === "REJECTED" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    if (decision === "APPROVED") {
      if (!approvedAmount) {
        toast.error("Please enter the approved amount");
        return;
      }
      if (!selectedLoanOfficer) {
        toast.error("Please select a loans officer to disburse this loan");
        return;
      }

      const amount = Number(approvedAmount);
      if (amount < selectedApplication.loanProduct.minAmount || 
          amount > selectedApplication.loanProduct.maxAmount) {
        toast.error(`Amount must be between ${fmt(selectedApplication.loanProduct.minAmount)} and ${fmt(selectedApplication.loanProduct.maxAmount)}`);
        return;
      }

      // Check if net amount will be positive
      const deductions = calculateDeductions(selectedApplication);
      if (deductions.netAmount <= 0) {
        toast.error("Cannot approve: deductions exceed the loan amount");
        return;
      }
    }

    setLoading(true);

    try {
      decisionMutation.mutate({
        id: selectedApplication.id,
        status: decision,
        amountGranted: decision === "APPROVED" ? Number(approvedAmount) : undefined,
        repaymentPeriodMonths: decision === "APPROVED" ? Number(approvedRepaymentPeriod) : undefined,
        rejectionReason: decision === "REJECTED" ? rejectionReason : undefined,
        loanOfficerId: decision === "APPROVED" ? selectedLoanOfficer : undefined,
      });
    } catch (error) {
      console.error("Error initiating decision:", error);
      toast.error("Failed to initiate decision");
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    const exportData = applications.map((app) => ({
      "Application ID": app.id,
      "Member Name": app.member.user.name,
      "Member Number": app.member.memberNumber,
      Email: app.member.user.email,
      "Loan Product": app.loanProduct.name,
      "Interest Rate": `${app.loanProduct.interestRate}%`,
      "Amount Applied": app.amountApplied,
      Status: app.status,
      "Application Date": format(new Date(app.applicationDate), "dd/MM/yyyy"),
      "Approved By": app.approver?.name || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loan Applications");
    XLSX.writeFile(
      wb,
      `loan-applications-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
    toast.success("Exported successfully");
  };

  // Table columns
  const columns: Column<LoanApplication>[] = [
    {
      header: "Member",
      accessorKey: (row) => row.member.user.name,
      cell: (row: LoanApplication) => (
        <div className="space-y-1 min-w-[200px]">
          <div className="font-medium">{row.member.user.name}</div>
          <div className="text-xs text-gray-500">{row.member.memberNumber}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {row.member.user.email}
          </div>
        </div>
      ),
    },
    {
      header: "Loan Product",
      accessorKey: (row) => row.loanProduct.name,
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div className="font-medium">{row.loanProduct.name}</div>
          <div className="text-xs text-gray-500">
            Rate: {row.loanProduct.interestRate}%
          </div>
        </div>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amountApplied",
      cell: (row: LoanApplication) => (
        <div className="font-semibold text-green-600">
          {fmt(row.amountApplied)}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          {getStatusBadge(row.status)}
          {row.approver && (
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <UserCheck className="h-3 w-3" />
              {row.approver.name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Application Date",
      accessorKey: "applicationDate",
      cell: (row: LoanApplication) => (
        <div className="space-y-1">
          <div>{format(new Date(row.applicationDate), "dd MMM yyyy")}</div>
          <div className="text-xs text-gray-500">
            {format(new Date(row.applicationDate), "HH:mm")}
          </div>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: LoanApplication) => (
        <div className="flex items-center gap-2">
          {/* Show Approve button for PENDING loans */}
          {row.status === "PENDING" && canApprove && (
            <Button
              size="sm"
              onClick={() => handleViewDetails(row)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-3 w-3" />
              Review
            </Button>
          )}

          {row.status === "DISBURSED" && row.loan && (
            <Button
              size="sm"
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              onClick={() => {
                setSelectedLoanIdForRepayment(row.loan?.id);
                setSelectedIsInstitutionForRepayment(row.isInstitution || false);
                setRepaymentModalOpen(true);
              }}
            >
              <DollarSign className="mr-2 h-3 w-3" />
              Repay
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewDetails(row)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generatePDF(row)}>
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printApplication(row)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </DropdownMenuItem>
              {row.loan && (
                <DropdownMenuItem 
                  onClick={() => router.push(`/dashboard/loans/reports/ledger?loanId=${row.loan?.id}`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Loan Ledger
                </DropdownMenuItem>
              )}
              {["APPROVED", "DISBURSED"].includes(row.status) && (
                <DropdownMenuItem 
                  onClick={() => resendNotificationMutation.mutate(row.id)}
                  disabled={resendNotificationMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {resendNotificationMutation.isPending ? "Resending..." : "Resend Notification"}
                </DropdownMenuItem>
              )}
              {row.status === "DISBURSED" && row.loan && (
                <>
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedLoanIdForRepayment(row.loan?.id);
                      setSelectedIsInstitutionForRepayment(row.isInstitution || false);
                      setRepaymentModalOpen(true);
                    }}
                  >
                    <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                    Make Repayment
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/loan-repayments/initiate?loanId=${row.loan.id}`}>
                      <div className="flex items-center">
                        <Send className="mr-2 h-4 w-4 text-blue-600" />
                        Initiate from Account
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // Statistics cards
  const statsCards = [
    {
      title: "Pending",
      value: statistics.pending,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Approved",
      value: statistics.approved,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Rejected",
      value: statistics.rejected,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Disbursed",
      value: statistics.disbursed,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Amount",
      value: fmt(statistics.totalAmount),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      isAmount: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Loan Applications Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Review, approve, and manage loan applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.isAmount ? stat.value : stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Applications</CardTitle>
              <CardDescription>
                View and manage all member loan applications
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by member, product, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="DISBURSED">Disbursed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<LoanApplication>
            title="Applications List"
            columns={columns}
            data={filteredApplications}
            keyField="id"
          />
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedApplication && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Loan Application Review
              </DialogTitle>
              <DialogDescription>
                Application ID: {selectedApplication.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            {/* Action Required Alert for PENDING applications */}
            {selectedApplication.status === "PENDING" && canApprove && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-900">
                  Action Required
                </AlertTitle>
                <AlertDescription className="text-yellow-800">
                  This loan application requires your review and decision.
                  <Button
                    onClick={handleOpenDecisionDialog}
                    size="sm"
                    className="ml-4 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-3 w-3" />
                    Make Decision Now
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[calc(90vh-280px)]">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="deductions">Deductions</TabsTrigger>
                  <TabsTrigger value="calculation">Calculation</TabsTrigger>
                  <TabsTrigger value="guarantors">Guarantors</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6 mt-6">
                  {/* Status and Approver Info */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      {getStatusBadge(selectedApplication.status)}
                      {selectedApplication.approver && (
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Approved by: {selectedApplication.approver.name} (
                          {selectedApplication.approver.role})
                        </div>
                      )}
                      {selectedApplication.approvalDate && (
                        <div className="text-xs text-gray-500">
                          on{" "}
                          {format(
                            new Date(selectedApplication.approvalDate),
                            "dd MMM yyyy HH:mm"
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printApplication(selectedApplication)}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePDF(selectedApplication)}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Member Details */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Member Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Name</Label>
                        <div className="font-medium">
                          {selectedApplication.member.user.name}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Member Number
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.member.memberNumber}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          <Mail className="h-3 w-3 inline mr-1" />
                          Email
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.member.user.email}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          <Phone className="h-3 w-3 inline mr-1" />
                          Phone
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.member.user.phone || "N/A"}
                        </div>
                      </div>
                      {selectedApplication.employer && (
                        <>
                          <div>
                            <Label className="text-xs text-gray-500">
                              <Briefcase className="h-3 w-3 inline mr-1" />
                              Employer
                            </Label>
                            <div className="font-medium">
                              {selectedApplication.employer}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">
                              Employment Status
                            </Label>
                            <div className="font-medium">
                              {selectedApplication.employmentStatus || "N/A"}
                            </div>
                          </div>
                        </>
                      )}
                      {selectedApplication.grossMonthlyIncome && (
                        <>
                          <div>
                            <Label className="text-xs text-gray-500">
                              Gross Monthly Income
                            </Label>
                            <div className="font-medium">
                              {fmt(selectedApplication.grossMonthlyIncome)}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">
                              Net Monthly Income
                            </Label>
                            <div className="font-medium">
                              {selectedApplication.netMonthlyIncome
                                ? fmt(selectedApplication.netMonthlyIncome)
                                : "N/A"}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Loan Details */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Loan Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          Loan Product
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.loanProduct.name}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Interest Rate
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.loanProduct.interestRate}%
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Amount Applied
                        </Label>
                        <div className="font-semibold text-green-600 text-lg">
                          {fmt(selectedApplication.amountApplied)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Repayment Period
                        </Label>
                        <div className="font-medium">
                          {selectedApplication.repaymentPeriodMonths || Math.round(selectedApplication.loanProduct.repaymentPeriodDays / 30)}{" "}
                          months
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Application Date
                        </Label>
                        <div className="font-medium">
                          {format(
                            new Date(selectedApplication.applicationDate),
                            "dd MMM yyyy HH:mm"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Purpose */}
                  {selectedApplication.purpose && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Loan Purpose
                      </h3>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {selectedApplication.purpose}
                      </p>
                    </div>
                  )}

                  {/* Existing Loan Warning */}
                  {selectedApplication.hasExistingLoanWithSacco && (
                    <>
                      <Separator />
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <h3 className="text-lg font-semibold mb-2 text-yellow-900 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          Existing Loan Balance
                        </h3>
                        <p className="text-sm text-yellow-800">
                          This member has an existing loan balance of{" "}
                          <span className="font-bold">
                            {fmt(selectedApplication.existingLoanBalance || 0)}
                          </span>{" "}
                          that will be deducted from the new loan.
                        </p>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="deductions" className="space-y-6 mt-6">
                  {(() => {
                    const deductions = calculateDeductions(selectedApplication);
                    return (
                      <>
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Deductions Breakdown
                          </h3>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-lg">
                              <span className="font-medium">Gross Amount:</span>
                              <span className="font-bold text-blue-600">
                                {fmt(deductions.grossAmount)}
                              </span>
                            </div>

                            <Separator />

                            {deductions.processingFee > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 flex items-center gap-2">
                                  <Percent className="h-4 w-4" />
                                  Processing Fee (
                                  {
                                    selectedApplication.loanProcessingFeePercentage
                                  }
                                  %):
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{fmt(deductions.processingFee)}
                                </span>
                              </div>
                            )}

                            {deductions.insurance > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 flex items-center gap-2">
                                  <Percent className="h-4 w-4" />
                                  Loan Insurance (
                                  {selectedApplication.loanInsurancePercentage}
                                  %):
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{fmt(deductions.insurance)}
                                </span>
                              </div>
                            )}

                            {deductions.shareCapital > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 flex items-center gap-2">
                                  <Banknote className="h-4 w-4" />
                                  Share Capital:
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{fmt(deductions.shareCapital)}
                                </span>
                              </div>
                            )}

                            {deductions.existingLoanRecovery > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  Existing Loan Recovery:
                                </span>
                                <span className="font-semibold text-red-600">
                                  -{fmt(deductions.existingLoanRecovery)}
                                </span>
                              </div>
                            )}

                            <Separator className="my-3" />

                            <div className="flex justify-between items-center text-lg">
                              <span className="font-medium">
                                Total Deductions:
                              </span>
                              <span className="font-bold text-red-600">
                                -{fmt(deductions.totalDeductions)}
                              </span>
                            </div>

                            <Separator className="my-3" />

                            <div className="flex justify-between items-center text-xl bg-white p-4 rounded-lg">
                              <span className="font-bold">
                                Net Amount to Credit:
                              </span>
                              <span className="font-bold text-green-600">
                                {fmt(deductions.netAmount)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {deductions.netAmount <= 0 && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Warning</AlertTitle>
                            <AlertDescription>
                              Deductions exceed the loan amount. This loan
                              cannot be disbursed with current deductions.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="calculation" className="space-y-6 mt-6">
                  {(() => {
                    const deductions = calculateDeductions(selectedApplication);
                    const loanDetails = calculateLoanDetails(
                      deductions.grossAmount,
                      selectedApplication.loanProduct.interestRate,
                      selectedApplication.loanProduct.repaymentPeriodDays
                    );
                    return (
                      <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Loan Calculation Summary
                        </h3>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Principal:</span>
                            <span className="font-semibold">
                              {fmt(deductions.grossAmount)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              Interest Rate:
                            </span>
                            <span className="font-semibold">
                              {selectedApplication.loanProduct.interestRate}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Period:</span>
                            <span className="font-semibold">
                              {
                                selectedApplication.repaymentPeriodMonths ||
                                Math.round(selectedApplication.loanProduct.repaymentPeriodDays / 30)
                              }{" "}
                              months
                            </span>
                          </div>

                          <Separator />

                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              Interest Amount:
                            </span>
                            <span className="font-semibold text-orange-600">
                              {fmt(loanDetails.interest)}
                            </span>
                          </div>

                          <Separator className="my-3" />

                          <div className="flex justify-between items-center text-xl bg-white p-4 rounded-lg">
                            <span className="font-bold">Total Amount Due:</span>
                            <span className="font-bold text-green-600">
                              {fmt(loanDetails.totalDue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="guarantors" className="space-y-6 mt-6">
                  {selectedApplication.guarantors &&
                  Array.isArray(selectedApplication.guarantors) &&
                  selectedApplication.guarantors.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Guarantors Information
                      </h3>
                      {selectedApplication.guarantors.map(
                        (guarantor: any, index: number) => (
                          <Card key={index}>
                            <CardContent className="pt-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Full Name
                                  </Label>
                                  <div className="font-medium">
                                    {guarantor.fullName || "N/A"}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Relationship
                                  </Label>
                                  <div className="font-medium">
                                    {guarantor.relationship || "N/A"}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Phone Number
                                  </Label>
                                  <div className="font-medium">
                                    {guarantor.phoneNumber || "N/A"}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Address
                                  </Label>
                                  <div className="font-medium">
                                    {guarantor.address || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>No guarantors provided for this application</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>

            <DialogFooter className="gap-2">
              {selectedApplication.status === "PENDING" && canApprove && (
                <Button
                  onClick={handleOpenDecisionDialog}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Make Decision
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => printApplication(selectedApplication)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={() => generatePDF(selectedApplication)}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Make Loan Decision</DialogTitle>
            <DialogDescription>
              Review and approve or reject this loan application. You are
              making this decision as{" "}
              <span className="font-semibold">{currentUserName}</span> (
              {userRole})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Decision Type */}
            <div className="space-y-2">
              <Label>Decision *</Label>
              <Select
                value={decision}
                onValueChange={(value: any) => setDecision(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Approve Application
                    </span>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Reject Application
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approved Amount (if approving) */}
            {decision === "APPROVED" && selectedApplication && (
              <>
                <div className="space-y-2">
                  <Label>Approved Amount *</Label>
                  <Input
                    type="number"
                    placeholder="Enter approved amount"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Amount Applied: {fmt(selectedApplication.amountApplied)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Product Range:{" "}
                    {fmt(selectedApplication.loanProduct.minAmount)} -{" "}
                    {fmt(selectedApplication.loanProduct.maxAmount)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Approved Repayment Period (Months) *</Label>
                  <Input
                    type="number"
                    placeholder="Enter approved period in months"
                    value={approvedRepaymentPeriod}
                    onChange={(e) => setApprovedRepaymentPeriod(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Applied Period: {selectedApplication.repaymentPeriodMonths || "N/A"} months
                  </p>
                  <p className="text-xs text-gray-500">
                    Product Max Period: {Math.ceil((selectedApplication.loanProduct.repaymentPeriodDays || 30) / 30)} months
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assign Loans Officer *</Label>
                  <Select
                    value={selectedLoanOfficer}
                    onValueChange={setSelectedLoanOfficer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loans officer to disburse this loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanOfficers.map((officer) => (
                        <SelectItem key={officer.value} value={officer.value}>
                          {officer.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    The selected loans officer will disburse and manage this loan
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Disbursement Method</Label>
                  <Select
                    value={disbursementMethod}
                    onValueChange={setDisbursementMethod}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Deductions Preview */}
                {approvedAmount && selectedApplication && (() => {
                  const deductions = calculateDeductions(selectedApplication);
                  return (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold mb-3 text-blue-900">
                        Deductions Preview
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gross Amount:</span>
                          <span className="font-semibold">
                            {fmt(deductions.grossAmount)}
                          </span>
                        </div>
                        {deductions.processingFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Processing Fee:
                            </span>
                            <span className="text-red-600">
                              -{fmt(deductions.processingFee)}
                            </span>
                          </div>
                        )}
                        {deductions.insurance > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Insurance:</span>
                            <span className="text-red-600">
                              -{fmt(deductions.insurance)}
                            </span>
                          </div>
                        )}
                        {deductions.shareCapital > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Share Capital:
                            </span>
                            <span className="text-red-600">
                              -{fmt(deductions.shareCapital)}
                            </span>
                          </div>
                        )}
                        {deductions.existingLoanRecovery > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Loan Recovery:
                            </span>
                            <span className="text-red-600">
                              -{fmt(deductions.existingLoanRecovery)}
                            </span>
                          </div>
                        )}
                        <Separator className="my-2" />
                        <div className="flex justify-between text-base">
                          <span className="font-semibold">
                            Total Deductions:
                          </span>
                          <span className="font-bold text-red-600">
                            -{fmt(deductions.totalDeductions)}
                          </span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-base">
                          <span className="font-semibold">Net to Credit:</span>
                          <span className="font-bold text-green-600">
                            {fmt(deductions.netAmount)}
                          </span>
                        </div>
                      </div>
                      
                      {deductions.netAmount <= 0 && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Cannot approve: Deductions exceed the loan amount
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Rejection Reason (if rejecting) */}
            {decision === "REJECTED" && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Provide a detailed reason for rejecting this application..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  The member will be notified of this reason
                </p>
              </div>
            )}

            {/* Summary */}
            {selectedApplication && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-semibold mb-2">Decision Summary</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Member:</span>
                    <span className="font-medium">
                      {selectedApplication.member.user.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Product:</span>
                    <span className="font-medium">
                      {selectedApplication.loanProduct.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Decision:</span>
                    <span
                      className={`font-medium ${
                        decision === "APPROVED"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {decision}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approved By:</span>
                    <span className="font-medium">
                      {currentUserName} ({userRole})
                    </span>
                  </div>
                  {decision === "APPROVED" && selectedLoanOfficer && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assigned Loan Officer:</span>
                      <span className="font-medium">
                        {loanOfficers.find((t) => t.value === selectedLoanOfficer)?.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDecisionDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDecision}
              disabled={loading}
              className={
                decision === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  {decision === "APPROVED" ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve & Disburse
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject Application
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoanRepaymentCreateForm
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        currentUserId={currentUserId}
        initialLoanId={selectedLoanIdForRepayment}
        isInstitution={selectedIsInstitutionForRepayment}
      />
    </div>
  );
}