"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  User,
  CreditCard,
  DollarSign,
  Calculator,
  CheckCircle,
  AlertCircle,
  XCircle,
  Calendar,
  Clock,
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Shield,
  FileSignature,
} from "lucide-react";
import { format } from "date-fns";

interface LoanApplication {
  id: string;
  memberId: string;
  memberName?: string;
  memberNumber?: string;
  loanProductId: string;
  loanProduct?: {
    id: string;
    name: string;
    interestRate: number;
    maxAmount: number;
  };
  amountApplied: number;
  amountApproved?: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISBURSED";
  applicationDate: Date;
  approvedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  approvedBy?: string;
  repaymentPeriodMonths?: number;
  monthlyRepayment?: number;
  totalRepayment?: number;
  applicationType?: "MEMBER" | "INSTITUTION";
  organizationName?: string;
  organizationType?: string;
  district?: string;
  mobileNumber?: string;
  emailAddress?: string;
  loanOfficer?: { name: string } | null;
  allocatedTeller?: { name: string } | null;
  modeOfRepayment?: string | null;
  applyLoanProcessingFee?: boolean;
  loanProcessingFeePercentage?: number | null;
  applyLoanInsurance?: boolean;
  loanInsurancePercentage?: number | null;
  applyShareDeduction?: boolean;
  shareAmount?: number | null;
  hasExistingLoanWithSacco?: boolean;
  existingLoanBalance?: number | null;
}

interface LoanApplicationDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  application: LoanApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  userRole: string;
}

export default function LoanApplicationDetailsDialog({
  isOpen,
  onClose,
  application,
  onApprove,
  onReject,
  userRole,
}: LoanApplicationDetailsDialogProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: {
        variant: "default" as const,
        icon: Clock,
        color: "bg-yellow-100 text-yellow-800",
      },
      APPROVED: {
        variant: "default" as const,
        icon: CheckCircle,
        color: "bg-green-100 text-green-800",
      },
      REJECTED: {
        variant: "destructive" as const,
        icon: XCircle,
        color: "bg-red-100 text-red-800",
      },
      DISBURSED: {
        variant: "default" as const,
        icon: DollarSign,
        color: "bg-blue-100 text-blue-800",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.color}`}
      >
        <Icon className="h-4 w-4" />
        <span className="font-medium">{status}</span>
      </div>
    );
  };

  const isInstitution = application.applicationType === "INSTITUTION";
  const requestedAmount = Number(application.amountApplied) || 0;
  const existingLoanDeduction =
    Number(application.existingLoanBalance) > 0
      ? Number(application.existingLoanBalance)
      : 0;
  const processingFee =
    application.applyLoanProcessingFee && requestedAmount > 0
      ? (requestedAmount * (Number(application.loanProcessingFeePercentage) || 0)) / 100
      : 0;
  const insurance =
    application.applyLoanInsurance && requestedAmount > 0
      ? (requestedAmount * (Number(application.loanInsurancePercentage) || 0)) / 100
      : 0;
  const shareDeduction =
    application.applyShareDeduction && Number(application.shareAmount) > 0
      ? Number(application.shareAmount)
      : 0;
  const totalDeductions =
    existingLoanDeduction + processingFee + insurance + shareDeduction;
  const netDisbursement = requestedAmount - totalDeductions;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Loan Application Details
            </DialogTitle>
            {getStatusBadge(application.status)}
          </div>
          <DialogDescription>
            Application ID: {application.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Applicant Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              {isInstitution ? (
                <Building2 className="h-5 w-5 text-purple-600" />
              ) : (
                <User className="h-5 w-5 text-blue-600" />
              )}
              <h3 className="text-lg font-semibold">
                {isInstitution
                  ? "Institution Information"
                  : "Applicant Information"}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              {isInstitution ? (
                <>
                  <InfoItem
                    icon={Building2}
                    label="Organization Name"
                    value={application.organizationName || "N/A"}
                  />
                  <InfoItem
                    icon={FileText}
                    label="Organization Type"
                    value={application.organizationType || "N/A"}
                  />
                  <InfoItem
                    icon={MapPin}
                    label="District"
                    value={application.district || "N/A"}
                  />
                  <InfoItem
                    icon={Phone}
                    label="Mobile Number"
                    value={application.mobileNumber || "N/A"}
                  />
                  {application.emailAddress && (
                    <InfoItem
                      icon={Mail}
                      label="Email"
                      value={application.emailAddress}
                    />
                  )}
                </>
              ) : (
                <>
                  <InfoItem
                    icon={User}
                    label="Member Name"
                    value={application.memberName || "N/A"}
                  />
                  <InfoItem
                    icon={CreditCard}
                    label="Member Number"
                    value={application.memberNumber || "N/A"}
                  />
                  <InfoItem
                    icon={User}
                    label="Member ID"
                    value={application.memberId}
                  />
                </>
              )}
            </div>
          </section>

          <Separator />

          {/* Loan Details */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Loan Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <InfoItem
                icon={FileText}
                label="Loan Product"
                value={application.loanProduct?.name || "N/A"}
              />
              <InfoItem
                icon={Calculator}
                label="Interest Rate"
                value={
                  application.loanProduct?.interestRate
                    ? `${application.loanProduct.interestRate}%`
                    : "N/A"
                }
              />
              <InfoItem
                icon={DollarSign}
                label="Amount Applied"
                value={fmt(application.amountApplied)}
                highlight="text-green-600 font-semibold"
              />
              {application.amountApproved && (
                <InfoItem
                  icon={CheckCircle}
                  label="Amount Approved"
                  value={fmt(application.amountApproved)}
                  highlight="text-blue-600 font-semibold"
                />
              )}
              {application.repaymentPeriodMonths && (
                <InfoItem
                  icon={Calendar}
                  label="Repayment Period"
                  value={`${application.repaymentPeriodMonths} months`}
                />
              )}
              {application.monthlyRepayment && (
                <InfoItem
                  icon={Calculator}
                  label="Monthly Repayment"
                  value={fmt(application.monthlyRepayment)}
                />
              )}
              {application.totalRepayment && (
                <InfoItem
                  icon={DollarSign}
                  label="Total Repayment"
                  value={fmt(application.totalRepayment)}
                />
              )}
              {application.modeOfRepayment && (
                <InfoItem
                  icon={Calendar}
                  label="Schedule Mode of Payment"
                  value={
                    {
                      BI_WEEKLY: "Bi-weekly",
                      MONTHLY: "Monthly",
                      EVERY_TWO_MONTHS: "Every Two Months",
                      QUARTERLY: "Quarterly",
                      HALF_YEAR: "Half a Year",
                    }[application.modeOfRepayment] || application.modeOfRepayment
                  }
                  highlight="text-purple-600 font-medium"
                />
              )}
            </div>

            <div className="mt-4 bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-600 mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Loan Purpose
                  </p>
                  <p className="text-sm text-blue-700">{application.purpose}</p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Deduction Summary */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Deduction Summary</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
              <InfoItem
                icon={DollarSign}
                label="Requested Amount"
                value={fmt(requestedAmount)}
                highlight="text-gray-900 font-semibold"
              />
              <InfoItem
                icon={DollarSign}
                label="Existing Loan Deduction"
                value={`- ${fmt(existingLoanDeduction)}`}
                highlight="text-amber-700 font-semibold"
              />
              <InfoItem
                icon={DollarSign}
                label="Processing Fee"
                value={`- ${fmt(processingFee)}`}
                highlight="text-red-600 font-semibold"
              />
              <InfoItem
                icon={DollarSign}
                label="Insurance"
                value={`- ${fmt(insurance)}`}
                highlight="text-red-600 font-semibold"
              />
              <InfoItem
                icon={DollarSign}
                label="Share Capital / Equity Contribution"
                value={`- ${fmt(shareDeduction)}`}
                highlight="text-red-600 font-semibold"
              />
              <InfoItem
                icon={Calculator}
                label="Total Deductions"
                value={fmt(totalDeductions)}
                highlight="text-amber-700 font-semibold"
              />
              <div className="md:col-span-2 border-t border-amber-200 pt-3 mt-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Net Disbursement After Deductions
                </span>
                <span
                  className={`text-lg font-bold ${
                    netDisbursement > 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {fmt(Math.max(0, netDisbursement))}
                </span>
              </div>
              {netDisbursement <= 0 && (
                <div className="md:col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                  Deductions are equal to or greater than the requested amount.
                  This loan should not be disbursed until the figures are
                  adjusted.
                </div>
              )}
              {shareDeduction > 0 && (
                <div className="md:col-span-2 p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-sm">
                  The share amount will be credited to the member associate share capital
                  and equity account during disbursement.
                </div>
              )}
            </div>
          </section>

          {/* Application Timeline */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold">Application Timeline</h3>
            </div>

            <div className="space-y-3">
              <TimelineItem
                icon={FileText}
                label="Application Submitted"
                value={format(
                  new Date(application.applicationDate),
                  "PPP 'at' p"
                )}
                status="completed"
              />

              {application.approvedDate && (
                <TimelineItem
                  icon={CheckCircle}
                  label="Application Approved"
                  value={format(
                    new Date(application.approvedDate),
                    "PPP 'at' p"
                  )}
                  status="completed"
                  subtitle={
                    application.approvedBy
                      ? `By: ${application.approvedBy}`
                      : undefined
                  }
                />
              )}

              {application.status === "DISBURSED" && (
                <TimelineItem
                  icon={DollarSign}
                  label="Loan Disbursed"
                  value={
                    application.approvedDate
                      ? format(new Date(application.approvedDate), "PPP 'at' p")
                      : "Completed"
                  }
                  status="completed"
                  subtitle={
                    application.allocatedTeller
                      ? `Disbursed By: ${application.allocatedTeller.name}`
                      : undefined
                  }
                />
              )}

              {application.rejectedDate && (
                <TimelineItem
                  icon={XCircle}
                  label="Application Rejected"
                  value={format(
                    new Date(application.rejectedDate),
                    "PPP 'at' p"
                  )}
                  status="rejected"
                  subtitle={application.rejectionReason}
                />
              )}
            </div>
          </section>

          {/* Rejection Reason */}
          {application.status === "REJECTED" && application.rejectionReason && (
            <>
              <Separator />
              <section>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-sm text-red-700">
                        {application.rejectionReason}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          {application.status === "PENDING" &&
            (userRole === "ADMIN" || userRole === "MANAGER") && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    onReject(application.id);
                    onClose();
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    onApprove(application.id);
                    onClose();
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper Components
interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: string;
}

function InfoItem({ icon: Icon, label, value, highlight }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-gray-500 mt-1" />
      <div className="flex-1">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-sm font-medium ${highlight || ""}`}>{value}</p>
      </div>
    </div>
  );
}

interface TimelineItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status: "completed" | "pending" | "rejected";
  subtitle?: string;
}

function TimelineItem({
  icon: Icon,
  label,
  value,
  status,
  subtitle,
}: TimelineItemProps) {
  const statusColors = {
    completed: "bg-green-100 text-green-600 border-green-200",
    pending: "bg-yellow-100 text-yellow-600 border-yellow-200",
    rejected: "bg-red-100 text-red-600 border-red-200",
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${statusColors[status]}`}
    >
      <Icon className="h-5 w-5 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-sm opacity-90">{value}</p>
        {subtitle && <p className="text-xs mt-1 opacity-75">{subtitle}</p>}
      </div>
    </div>
  );
}
