"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// Progress component inline implementation
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
  Calendar,
  TrendingUp,
  AlertCircle,
  Building2,
  Download,
  Eye,
  RefreshCw,
  Phone,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";

interface LoanApplication {
  id: string;
  amountApplied: number;
  approvedAmount?: number | null;
  purpose: string | null;
  status: string;
  stage: string;
  applicationDate: Date;
  approvalDate?: Date | null;
  rejectionReason?: string | null;
  repaymentPeriodMonths?: number | null;
  collateralOffered?: string | null;
  loanProduct: {
    name: string;
    interestRate: number;
  };
  institutionLoan?: {
    id: string;
    amountGranted: number;
    totalAmountDue: number;
    outstandingBalance: number;
    disbursementDate: Date;
    dueDate: Date;
  } | null;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function InstitutionLoanApplicationsTracking({
  institutionId,
  institutionName,
}: Props) {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Load applications
  useEffect(() => {
    loadApplications();
  }, [institutionId]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/loans/applications/institution?institutionId=${institutionId}`);
      const json = await res.json();
      setApplications((json.data || json) as any);
    } catch (error) {
      toast.error("Failed to load loan applications");
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n || 0);

  // Calculate loan details
  const calculateLoanDetails = (
    principal: number,
    rate: number,
    months: number
  ) => {
    const annualInterest = (principal * rate) / 100;
    const periodInterest = (annualInterest * months) / 12;
    const totalDue = principal + periodInterest;
    const monthlyPayment = totalDue / months;

    return {
      interest: periodInterest,
      totalDue,
      monthlyPayment,
    };
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      PENDING: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: Clock,
      },
      UNDER_REVIEW: {
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: AlertCircle,
      },
      APPROVED: {
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
      },
      REJECTED: {
        color: "bg-red-100 text-red-800 border-red-200",
        icon: XCircle,
      },
      DISBURSED: {
        color: "bg-purple-100 text-purple-800 border-purple-200",
        icon: DollarSign,
      },
    };

    const statusConfig = config[status] || config.PENDING;
    const Icon = statusConfig.icon;

    return (
      <Badge variant="outline" className={statusConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Get stage progress
  const getStageProgress = (stage: string) => {
    const stages = {
      DRAFT: 0,
      SUBMITTED: 25,
      IN_ANALYSIS: 50,
      FORWARDED_TO_MANAGER: 75,
      APPROVED: 100,
      REJECTED: 0,
      DISBURSED: 100,
    };
    return stages[stage as keyof typeof stages] || 0;
  };

  // Generate PDF
  const generatePDF = (app: LoanApplication) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("LOAN APPLICATION STATUS", pageWidth / 2, 20, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.text(institutionName, pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageWidth / 2,
      38,
      { align: "center" }
    );

    // Application Details
    let yPos = 55;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("APPLICATION DETAILS", 14, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const details = [
      ["Application ID:", app.id.slice(0, 13)],
      ["Status:", app.status],
      ["Stage:", app.stage.replace("_", " ")],
      ["Loan Product:", app.loanProduct.name],
      ["Interest Rate:", `${app.loanProduct.interestRate}%`],
      ["Amount Applied:", fmt(app.amountApplied)],
      [
        "Application Date:",
        format(new Date(app.applicationDate), "dd MMM yyyy"),
      ],
    ];

    if (app.approvedAmount) {
      details.push(["Approved Amount:", fmt(app.approvedAmount)]);
    }

    if (app.repaymentPeriodMonths) {
      details.push(["Repayment Period:", `${app.repaymentPeriodMonths} months`]);
      const loanDetails = calculateLoanDetails(
        app.amountApplied,
        app.loanProduct.interestRate,
        app.repaymentPeriodMonths
      );
      details.push(["Total Due:", fmt(loanDetails.totalDue)]);
      details.push(["Monthly Payment:", fmt(loanDetails.monthlyPayment)]);
    }

    details.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(String(label), 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 70, yPos);
      yPos += 6;
    });

    // Purpose
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PURPOSE", 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitPurpose = doc.splitTextToSize(app.purpose || "N/A", pageWidth - 28);
    doc.text(splitPurpose, 14, yPos);
    yPos += splitPurpose.length * 5;

    // Loan Status
    if (app.institutionLoan) {
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LOAN STATUS", 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const loanStatus = [
        ["Amount Granted:", fmt(app.institutionLoan.amountGranted)],
        ["Total Due:", fmt(app.institutionLoan.totalAmountDue)],
        ["Outstanding Balance:", fmt(app.institutionLoan.outstandingBalance)],
        [
          "Disbursement Date:",
          format(new Date(app.institutionLoan.disbursementDate), "dd MMM yyyy"),
        ],
        [
          "Due Date:",
          format(new Date(app.institutionLoan.dueDate), "dd MMM yyyy"),
        ],
      ];

      loanStatus.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(String(label), 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 70, yPos);
        yPos += 6;
      });
    }

    // Rejection Reason
    if (app.status === "REJECTED" && app.rejectionReason) {
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("REJECTION REASON", 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const splitReason = doc.splitTextToSize(
        app.rejectionReason,
        pageWidth - 28
      );
      doc.text(splitReason, 14, yPos);
    }

    doc.save(
      `loan-application-${app.id.slice(0, 8)}-${format(new Date(), "yyyy-MM-dd")}.pdf`
    );
  };

  // Statistics
  const stats = {
    pending: applications.filter((a) => a.status === "PENDING").length,
    approved: applications.filter((a) => a.status === "APPROVED").length,
    rejected: applications.filter((a) => a.status === "REJECTED").length,
    disbursed: applications.filter((a) => a.status === "DISBURSED").length,
    totalApplied: applications.reduce((sum, a) => sum + a.amountApplied, 0),
    totalDisbursed: applications
      .filter((a) => a.institutionLoan)
      .reduce((sum, a) => sum + (a.institutionLoan?.amountGranted || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            My Loan Applications
          </h1>
          <p className="text-sm text-muted-foreground">{institutionName}</p>
        </div>
        <Button onClick={loadApplications} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Applications
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved/Disbursed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.approved + stats.disbursed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursed
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {fmt(stats.totalDisbursed)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Loan Applications
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              You haven't submitted any loan applications yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {app.loanProduct.name}
                    </CardTitle>
                    <CardDescription>
                      Applied: {format(new Date(app.applicationDate), "dd MMM yyyy")}
                    </CardDescription>
                  </div>
                  {getStatusBadge(app.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Application Progress</span>
                    <span className="font-medium">
                      {app.stage.replace("_", " ")}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getStageProgress(app.stage)}%` }}
                    />
                  </div>
                </div>

                {/* Amount Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Amount Applied</Label>
                    <div className="text-lg font-semibold text-green-600">
                      {fmt(app.amountApplied)}
                    </div>
                  </div>
                  {app.approvedAmount && (
                    <div>
                      <Label className="text-xs text-gray-500">
                        Approved Amount
                      </Label>
                      <div className="text-lg font-semibold text-blue-600">
                        {fmt(app.approvedAmount)}
                      </div>
                    </div>
                  )}
                  {app.repaymentPeriodMonths && (
                    <div>
                      <Label className="text-xs text-gray-500">
                        Repayment Period
                      </Label>
                      <div className="font-medium">
                        {app.repaymentPeriodMonths} months
                      </div>
                    </div>
                  )}
                  {app.institutionLoan && (
                    <div>
                      <Label className="text-xs text-gray-500">
                        Outstanding Balance
                      </Label>
                      <div className="text-lg font-semibold text-purple-600">
                        {fmt(app.institutionLoan.outstandingBalance)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Purpose Preview */}
                <div>
                  <Label className="text-xs text-gray-500">Purpose</Label>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {app.purpose}
                  </p>
                </div>

                {/* Rejection Reason */}
                {app.status === "REJECTED" && app.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <Label className="text-xs text-red-700 font-semibold">
                      Rejection Reason
                    </Label>
                    <p className="text-sm text-red-900 mt-1">
                      {app.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedApplication(app);
                      setShowDetailsDialog(true);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generatePDF(app)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      {selectedApplication && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Loan Application Details
              </DialogTitle>
              <DialogDescription>
                Application ID: {selectedApplication.id.slice(0, 13)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedApplication.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generatePDF(selectedApplication)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>

              <Separator />

              {/* Loan Product */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Loan Product</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Product Name</Label>
                    <div className="font-medium">
                      {selectedApplication.loanProduct.name}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Interest Rate</Label>
                    <div className="font-medium">
                      {selectedApplication.loanProduct.interestRate}%
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Amount Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Amount Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Amount Applied</Label>
                    <div className="text-xl font-semibold text-green-600">
                      {fmt(selectedApplication.amountApplied)}
                    </div>
                  </div>
                  {selectedApplication.approvedAmount && (
                    <div>
                      <Label className="text-xs text-gray-500">
                        Approved Amount
                      </Label>
                      <div className="text-xl font-semibold text-blue-600">
                        {fmt(selectedApplication.approvedAmount)}
                      </div>
                    </div>
                  )}
                </div>

                {selectedApplication.repaymentPeriodMonths && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold mb-3 text-blue-900">
                      Loan Breakdown
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(() => {
                        const details = calculateLoanDetails(
                          selectedApplication.amountApplied,
                          selectedApplication.loanProduct.interestRate,
                          selectedApplication.repaymentPeriodMonths
                        );
                        return (
                          <>
                            <div>
                              <span className="text-gray-600">Principal:</span>
                              <span className="font-semibold ml-2">
                                {fmt(selectedApplication.amountApplied)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Interest:</span>
                              <span className="font-semibold ml-2">
                                {fmt(details.interest)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Total Due:</span>
                              <span className="font-semibold ml-2 text-blue-600">
                                {fmt(details.totalDue)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Monthly Payment:
                              </span>
                              <span className="font-semibold ml-2 text-green-600">
                                {fmt(details.monthlyPayment)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Period:</span>
                              <span className="font-semibold ml-2">
                                {selectedApplication.repaymentPeriodMonths} months
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Purpose */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Loan Purpose</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedApplication.purpose}
                </p>
              </div>

              {/* Collateral */}
              {selectedApplication.collateralOffered && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Collateral Offered
                    </h3>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {selectedApplication.collateralOffered}
                    </p>
                  </div>
                </>
              )}

              {/* Loan Status */}
              {selectedApplication.institutionLoan && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Active Loan Status
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          Amount Granted
                        </Label>
                        <div className="font-semibold text-green-600">
                          {fmt(selectedApplication.institutionLoan.amountGranted)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Total Due</Label>
                        <div className="font-semibold">
                          {fmt(selectedApplication.institutionLoan.totalAmountDue)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Outstanding Balance
                        </Label>
                        <div className="font-semibold text-purple-600">
                          {fmt(
                            selectedApplication.institutionLoan.outstandingBalance
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Due Date</Label>
                        <div className="font-semibold">
                          {format(
                            new Date(selectedApplication.institutionLoan.dueDate),
                            "dd MMM yyyy"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Rejection */}
              {selectedApplication.status === "REJECTED" &&
                selectedApplication.rejectionReason && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-red-600">
                        Rejection Reason
                      </h3>
                      <p className="text-sm text-gray-700 bg-red-50 p-3 rounded-lg border border-red-200">
                        {selectedApplication.rejectionReason}
                      </p>
                    </div>
                  </>
                )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            If you have questions about your loan application, please contact
            your branch manager:
          </p>
          <div className="flex items-center gap-2 text-gray-700">
            <Phone className="h-4 w-4" />
            <span>+256 700 000 000</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Mail className="h-4 w-4" />
            <span>loans@yoursacco.com</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}