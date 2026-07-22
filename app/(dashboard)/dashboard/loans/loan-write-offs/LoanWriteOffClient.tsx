// FILE: app/(dashboard)/dashboard/loan-write-offs/LoanWriteOffClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Eye,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface LoanWriteOffClientProps {
  writeOffs: any[];
  eligibleLoans: any[];
  statistics: any;
  currentUserRole: string;
}

export default function LoanWriteOffClient({
  writeOffs,
  eligibleLoans,
  statistics,
  currentUserRole,
}: LoanWriteOffClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedWriteOff, setSelectedWriteOff] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [reason, setReason] = useState("");
  const [minuteNumber, setMinuteNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  // Institution loans and individual loans have different shapes — these
  // helpers handle both a write-off record (which nests `.loan` or
  // `.institutionLoan`) and a raw loan/institutionLoan record (as returned
  // directly by the eligible-loans list), so nothing below crashes when an
  // institution write-off/loan shows up instead of an individual one.
  const getBorrowerName = (item: any) => {
    if (!item) return "Unknown";
    if (item.loan) return item.loan.member?.user?.name || "Unknown";
    if (item.institutionLoan) return item.institutionLoan.institution?.institutionName || "Unknown";
    if (item.institution) return item.institution.institutionName || "Unknown";
    if (item.member) return item.member.user?.name || "Unknown";
    return "Unknown";
  };
  const getBorrowerNumber = (item: any) => {
    if (!item) return "";
    if (item.loan) return item.loan.member?.memberNumber || "";
    if (item.institutionLoan) return item.institutionLoan.institution?.institutionNumber || "";
    if (item.institution) return item.institution.institutionNumber || "";
    if (item.member) return item.member.memberNumber || "";
    return "";
  };
  const getLoanProductName = (item: any) => {
    if (!item) return "Loan";
    if (item.loan) return item.loan.loanApplication?.loanProduct?.name || "Loan";
    if (item.institutionLoan) return item.institutionLoan.application?.loanProduct?.name || "Loan";
    if (item.application) return item.application.loanProduct?.name || "Loan";
    if (item.loanApplication) return item.loanApplication.loanProduct?.name || "Loan";
    return "Loan";
  };
  const getBorrowerAccounts = (item: any) => {
    if (!item) return [];
    if (item.loan) return item.loan.member?.accounts || [];
    if (item.institutionLoan) return item.institutionLoan.institution?.accounts || [];
    if (item.institution) return item.institution.accounts || [];
    if (item.member) return item.member.accounts || [];
    return [];
  };
  const isInstitutionItem = (item: any) =>
    !!(item?.institutionLoan || item?.institution || item?.isInstitution);

  // Filter write-offs
  const filteredWriteOffs = useMemo(() => {
    if (!searchQuery.trim() && statusFilter === "all") return writeOffs;

    return writeOffs.filter((writeOff) => {
      const matchesSearch =
        !searchQuery.trim() ||
        getBorrowerName(writeOff)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        getBorrowerNumber(writeOff)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        writeOff.reason.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        writeOff.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [writeOffs, searchQuery, statusFilter]);

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      PENDING: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: Clock,
      },
      APPROVED: {
        label: "Approved",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
      },
      REJECTED: {
        label: "Rejected",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: XCircle,
      },
    };

    const { label, className, icon: Icon } = config[status] || config.PENDING;

    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Handle create write-off
  const handleCreateWriteOff = async () => {
    if (!selectedLoanId) {
      toast.error("Please select a loan");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for write-off");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/v1/loan-write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isInstitutionItem(selectedLoan) ? { institutionLoanId: selectedLoanId } : { loanId: selectedLoanId }),
          reason: reason.trim(),
          minuteNumber: minuteNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Write-off request created successfully");
        setShowCreateDialog(false);
        setSelectedLoanId("");
        setReason("");
        setMinuteNumber("");
        setNotes("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create write-off request");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle approve
  const handleApprove = async () => {
    if (!selectedWriteOff) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/loan-write-offs/${selectedWriteOff.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAccountId: selectedAccountId || undefined }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Write-off approved successfully");
        setShowApprovalDialog(false);
        setSelectedWriteOff(null);
        setSelectedAccountId("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to approve write-off");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedWriteOff || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/loan-write-offs/${selectedWriteOff.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Write-off rejected successfully");
        setShowApprovalDialog(false);
        setSelectedWriteOff(null);
        setRejectionReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reject write-off");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected loan details
  const selectedLoan = useMemo(() => {
    return eligibleLoans.find((loan) => loan.id === selectedLoanId);
  }, [selectedLoanId, eligibleLoans]);

  return (
    <>
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting manager approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.approved}</div>
            <p className="text-xs text-muted-foreground">
              Total approved write-offs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">Written off to date</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Write-Off Requests</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage loan write-off requests and approvals
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {["LOANOFFICER", "ADMIN"].includes(currentUserRole) && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Write-Off Request
                </Button>
              )}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredWriteOffs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                No write-offs found
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "No write-off requests at the moment"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan Product</TableHead>
                    <TableHead>Amount Disbursed</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWriteOffs.map((writeOff) => (
                    <TableRow key={writeOff.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {getBorrowerName(writeOff)}
                            {isInstitutionItem(writeOff) && (
                              <Badge variant="outline" className="ml-2 text-xs">Institution</Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getBorrowerNumber(writeOff)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getLoanProductName(writeOff)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(writeOff.amountDisbursed)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(writeOff.totalPaid)}
                      </TableCell>
                      <TableCell className="font-bold text-red-600">
                        {formatCurrency(writeOff.totalBalance)}
                      </TableCell>
                      <TableCell>{writeOff.requestedBy.name}</TableCell>
                      <TableCell>
                        {format(new Date(writeOff.requestedAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(writeOff.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWriteOff(writeOff);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {writeOff.status === "PENDING" &&
                            ["BRANCHMANAGER", "ADMIN"].includes(
                              currentUserRole
                            ) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedWriteOff(writeOff);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Write-Off Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Write-Off Request</DialogTitle>
            <DialogDescription>
              Submit a request to write off a loan. This requires manager
              approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Loan Selection */}
            <div className="space-y-2">
              <Label htmlFor="loan">
                Select Loan <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger id="loan">
                  <SelectValue placeholder="Choose loan to write off" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleLoans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {getBorrowerName(loan)}
                      {isInstitutionItem(loan) ? " (Institution)" : ""} -{" "}
                      {getLoanProductName(loan)} (
                      {formatCurrency(loan.outstandingBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loan Details Preview */}
            {selectedLoan && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-3 text-blue-900">
                  Loan Details
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">{isInstitutionItem(selectedLoan) ? "Institution" : "Member"}</p>
                    <p className="font-medium">
                      {getBorrowerName(selectedLoan)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{isInstitutionItem(selectedLoan) ? "Institution Number" : "Member Number"}</p>
                    <p className="font-medium">
                      {getBorrowerNumber(selectedLoan)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Loan Product</p>
                    <p className="font-medium">
                      {getLoanProductName(selectedLoan)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Amount Disbursed</p>
                    <p className="font-medium">
                      {formatCurrency(selectedLoan.amountGranted)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Amount Paid</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(selectedLoan.amountPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Outstanding Balance</p>
                    <p className="font-bold text-red-600">
                      {formatCurrency(selectedLoan.outstandingBalance)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Write-Off <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide detailed reason for writing off this loan..."
                rows={4}
              />
            </div>

            {/* Minute Number */}
            <div className="space-y-2">
              <Label htmlFor="minuteNumber">Minute Number (Optional)</Label>
              <Input
                id="minuteNumber"
                value={minuteNumber}
                onChange={(e) => setMinuteNumber(e.target.value)}
                placeholder="e.g., MIN/2025/001"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>This request requires manager approval</li>
                    <li>
                      The loan will be marked as written off upon approval
                    </li>
                    <li>This action cannot be easily reversed</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateWriteOff}
                disabled={isSubmitting || !selectedLoanId || !reason.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write-Off Details</DialogTitle>
          </DialogHeader>

          {selectedWriteOff && (
            <div className="space-y-4">
              {/* Member & Loan Info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-3 text-blue-900">
                  Member & Loan Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">{isInstitutionItem(selectedWriteOff) ? "Institution Name" : "Member Name"}</p>
                    <p className="font-medium">
                      {getBorrowerName(selectedWriteOff)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{isInstitutionItem(selectedWriteOff) ? "Institution Number" : "Member Number"}</p>
                    <p className="font-medium">
                      {getBorrowerNumber(selectedWriteOff)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Loan Product</p>
                    <p className="font-medium">
                      {getLoanProductName(selectedWriteOff)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Account Number</p>
                    <p className="font-medium">
                      {getBorrowerAccounts(selectedWriteOff)[0]
                        ?.accountNumber || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Details Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-bold">Description</TableHead>
                      <TableHead className="font-bold text-right">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Amount Disbursed
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(selectedWriteOff.amountDisbursed)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50">
                      <TableCell className="font-medium">
                        Principal Paid
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(selectedWriteOff.principalPaid)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50">
                      <TableCell className="font-medium">
                        Interest Paid
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(selectedWriteOff.interestPaid)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50">
                      <TableCell className="font-medium">
                        Penalty Paid
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(selectedWriteOff.penaltyPaid)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-green-100 font-bold">
                      <TableCell>Total Paid</TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatCurrency(selectedWriteOff.totalPaid)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-red-50">
                      <TableCell className="font-medium">
                        Principal Balance
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(selectedWriteOff.principalBalance)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-red-50">
                      <TableCell className="font-medium">
                        Interest Balance
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(selectedWriteOff.interestBalance)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-red-50">
                      <TableCell className="font-medium">
                        Penalty Balance
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(selectedWriteOff.penaltyBalance)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-red-100 font-bold">
                      <TableCell>Total Balance (Write-Off Amount)</TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatCurrency(selectedWriteOff.totalBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Request Details */}
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-600">Reason for Write-Off</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded border">
                    {selectedWriteOff.reason}
                  </p>
                </div>

                {selectedWriteOff.minuteNumber && (
                  <div>
                    <Label className="text-gray-600">Minute Number</Label>
                    <p className="mt-1 p-3 bg-gray-50 rounded border">
                      {selectedWriteOff.minuteNumber}
                    </p>
                  </div>
                )}

                {selectedWriteOff.notes && (
                  <div>
                    <Label className="text-gray-600">Additional Notes</Label>
                    <p className="mt-1 p-3 bg-gray-50 rounded border">
                      {selectedWriteOff.notes}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Requested By</Label>
                    <p className="mt-1 font-medium">
                      {selectedWriteOff.requestedBy.name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Requested At</Label>
                    <p className="mt-1 font-medium">
                      {format(
                        new Date(selectedWriteOff.requestedAt),
                        "MMM dd, yyyy HH:mm"
                      )}
                    </p>
                  </div>
                </div>

                {selectedWriteOff.status === "APPROVED" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Approved By</Label>
                      <p className="mt-1 font-medium">
                        {selectedWriteOff.approvedBy?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Date Written Off</Label>
                      <p className="mt-1 font-medium">
                        {selectedWriteOff.dateWrittenOff
                          ? format(
                              new Date(selectedWriteOff.dateWrittenOff),
                              "MMM dd, yyyy"
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                {selectedWriteOff.status === "REJECTED" && (
                  <div>
                    <Label className="text-gray-600">Rejection Reason</Label>
                    <p className="mt-1 p-3 bg-red-50 rounded border border-red-200 text-red-800">
                      {selectedWriteOff.rejectionReason}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-gray-600">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedWriteOff.status)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Write-Off Request</DialogTitle>
            <DialogDescription>
              Approve or reject this write-off request
            </DialogDescription>
          </DialogHeader>

          {selectedWriteOff && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-2 text-blue-900">Summary</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600">{isInstitutionItem(selectedWriteOff) ? "Institution:" : "Member:"}</span>{" "}
                    <span className="font-medium">
                      {getBorrowerName(selectedWriteOff)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Loan Product:</span>{" "}
                    <span className="font-medium">
                      {getLoanProductName(selectedWriteOff)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Write-Off Amount:</span>{" "}
                    <span className="font-bold text-red-600">
                      {formatCurrency(selectedWriteOff.totalBalance)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Requested By:</span>{" "}
                    <span className="font-medium">
                      {selectedWriteOff.requestedBy.name}
                    </span>
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label className="text-gray-600">Reason for Write-Off</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded border">
                  {selectedWriteOff.reason}
                </p>
              </div>

              {/* Rejection Reason Input */}
              {showApprovalDialog && (
                <div className="space-y-2">
                  <Label htmlFor="rejectionReason">
                    Rejection Reason (if rejecting)
                  </Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide reason if rejecting..."
                    rows={3}
                  />
                </div>
              )}

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-semibold mb-1">Important:</p>
                    <p>
                      Approving this request will permanently write off the loan
                      and cannot be easily reversed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Selection for Transaction Record */}
              {showApprovalDialog &&
                getBorrowerAccounts(selectedWriteOff).length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="accountSelect" className="text-gray-600">
                      Link to {isInstitutionItem(selectedWriteOff) ? "Institution" : "Member"} Account (Optional)
                    </Label>
                    <Select
                      value={selectedAccountId}
                      onValueChange={setSelectedAccountId}
                    >
                      <SelectTrigger id="accountSelect" className="w-full">
                        <SelectValue placeholder="Select account for transaction record" />
                      </SelectTrigger>
                      <SelectContent>
                        {getBorrowerAccounts(selectedWriteOff).map(
                          (account: any) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountType.name} -{" "}
                              {account.accountNumber} (
                              {formatCurrency(account.balance)})
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Select which account the write-off transaction should be
                      recorded against.
                    </p>
                  </div>
                )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalDialog(false);
                    setRejectionReason("");
                    setSelectedAccountId("");
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
