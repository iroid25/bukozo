"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building, Calendar, ChevronRight } from "lucide-react";
import { Loan, getLoanStatusInfo } from "@/types/loan";
import { formatISODate } from "@/lib/utils";
import DisburseLoanForm from "../DisburseLoanForm";
import LoanRescheduleForm from "../LoanRescheduleForm";
import { Banknote, CheckCircle, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PayFromAccountForm from "../PayFromAccountForm";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RotateCcw, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LoanHeaderProps {
  loan: Loan & {
    member: {
      user: {
        name: string;
      };
      accounts: any[];
    };
      loanApplication: {
        loanOfficer?: {
          id: string;
          name: string;
          role?: string | null;
          email?: string | null;
        } | null;
        loanProduct: {
          name: string;
        };
    };
    branch?: {
      name: string;
    } | null;
  };
  userRole: string;
  currentUserId: string;
}

export default function LoanHeader({ loan, userRole, currentUserId }: LoanHeaderProps) {
  const router = useRouter();
  const statusInfo = getLoanStatusInfo(loan.status);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"repaid" | "extend" | "pay-from-account" | null>(null);
  const [loading, setLoading] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officersError, setOfficersError] = useState<string | null>(null);
  const [loanOfficers, setLoanOfficers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>(loan.loanApplication.loanOfficer?.id || "");
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (!reassignDialogOpen) return;

    const currentOfficerId = loan.loanApplication.loanOfficer?.id || "";
    setSelectedOfficerId(currentOfficerId);

    const loadOfficers = async () => {
      try {
        setOfficersLoading(true);
        setOfficersError(null);

        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to load loan officers");
        }

        setLoanOfficers(Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        setOfficersError(error instanceof Error ? error.message : "Failed to load loan officers");
        setLoanOfficers([]);
      } finally {
        setOfficersLoading(false);
      }
    };

    void loadOfficers();
  }, [loan.loanApplication.loanOfficer?.id, reassignDialogOpen]);

  const handleMarkAsRepaid = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/loans/${loan.id}/repaid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!result.success) {
        toast.error("Failed to mark loan as repaid", { 
          description: result.error || "Unknown error occurred" 
        });
        return;
      }

      toast.success("Loan marked as fully repaid");
      setActionDialogOpen(false);
      setActionType(null);
      router.refresh();
    } catch (error) {
      console.error("Error marking loan as repaid:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReassignOfficer = async () => {
    if (!selectedOfficerId) {
      toast.error("Please select a loan officer");
      return;
    }

    if (selectedOfficerId === loan.loanApplication.loanOfficer?.id) {
      toast.info("This loan is already assigned to that officer");
      return;
    }

    try {
      setReassigning(true);
      const response = await fetch(`/api/v1/loans/${loan.id}/reassign-loan-officer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanOfficerId: selectedOfficerId }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to reassign loan officer");
      }

      toast.success("Loan officer reassigned successfully");
      setReassignDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reassign loan officer");
    } finally {
      setReassigning(false);
    }
  };

  const currentOfficer = loan.loanApplication.loanOfficer?.name || "Unassigned";
  const currentOfficerId = loan.loanApplication.loanOfficer?.id || "";
  const isCurrentUserAssignedOfficer = currentUserId && currentOfficerId && currentUserId === currentOfficerId;
  const canReassignLoan =
    ["ADMIN", "BRANCHMANAGER"].includes(userRole) ||
    (userRole === "LOANOFFICER" && isCurrentUserAssignedOfficer);

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-neutral-100 rounded-full"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 shadow-sm flex items-center gap-1.5 ${statusInfo.color
                .replace("bg-", "bg-opacity-10 text-")
                .replace("text-", "border-")}`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.color}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.color}`}
                ></span>
              </span>
              {statusInfo.label}
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-neutral-100 px-2 py-1 rounded">
              #{loan.id.slice(-8)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            {loan.member.user.name}
            <ChevronRight className="h-6 w-6 text-neutral-300" />
            <span className="text-gray-500">
              {loan.loanApplication.loanProduct.name}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground italic">
            <span className="flex items-center gap-1.5">
              <Building className="h-4 w-4" />{" "}
              {loan.branch?.name || "Main Branch"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Disbursed{" "}
              {loan.disbursementDate
                ? formatISODate(loan.disbursementDate)
                : "Pending"}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Loan Officer: {currentOfficer}
              {isCurrentUserAssignedOfficer && (
                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-100">
                  You
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            {/* Action Buttons */}
          {loan.status === "APPROVED" && (
            <DisburseLoanForm loan={loan} memberAccounts={loan.member.accounts || []} />
          )}

          {loan.status === "DISBURSED" && (
            <LoanRescheduleForm
              loanId={loan.id}
              currentDueDate={loan.dueDate}
            />
          )}

          {loan.status === "DISBURSED" && loan.outstandingBalance > 0 && userRole !== "TELLER" && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-2xl border-neutral-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all active:scale-[0.98]"
              onClick={() => {
                setActionType("pay-from-account");
                setActionDialogOpen(true);
              }}
            >
              <Banknote className="h-4 w-4 mr-2" />
              Instant Collection
            </Button>
          )}

          {loan.status === "DISBURSED" && loan.outstandingBalance === 0 && (
            <Button
              variant="default"
              size="lg"
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
              onClick={() => {
                setActionType("repaid");
                setActionDialogOpen(true);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalize Closure
            </Button>
          )}

          {canReassignLoan && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-2xl border-indigo-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all active:scale-[0.98]"
              onClick={() => setReassignDialogOpen(true)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reassign Officer
            </Button>
          )}

          <div className="h-12 w-px bg-neutral-100 mx-2 hidden lg:block" />
          
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 px-4"
            onClick={() => window.open(`/dashboard/loans/reports/ledger?loanId=${loan.id}`, '_blank')}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Print Ledger
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 px-4"
            onClick={() => window.open(`/dashboard/loans/reports/repayment-schedule?loanId=${loan.id}`, '_blank')}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Print Schedule
          </Button>
        </div>
      </div>

       {/* Action Dialog */}
       <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none ring-1 ring-neutral-100 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 mx-auto shadow-inner shadow-indigo-100">
               {actionType === "repaid" ? <CheckCircle className="h-8 w-8" /> : <Banknote className="h-8 w-8" />}
            </div>
            <div className="text-center">
               <DialogTitle className="text-2xl font-black tracking-tighter">
                 {actionType === "repaid" ? "Finalize Loan Closure" : "Execute Savings Recovery"}
               </DialogTitle>
               <DialogDescription className="text-sm font-medium text-muted-foreground mt-2 italic px-4 leading-relaxed">
                 {actionType === "repaid" 
                   ? "You are about to formally retire this loan instrument. This will reconcile all balances and close the analytical window for this account." 
                   : "Verify member liquidity and transfer authorization. This will deduct the outstanding amount directly from the member's strategic savings account."}
               </DialogDescription>
            </div>
          </DialogHeader>

          {actionType === "pay-from-account" ? (
             <div className="mt-8">
                <PayFromAccountForm
                  loanId={loan.id}
                  totalDue={loan.totalAmountDue - loan.amountPaid}
                  loanInterestAmount={loan.interestAmount || 0}
                  loanInterestPaid={loan.interestPaid || 0}
                  memberAccounts={loan.member.accounts || []}
                  onSuccess={() => {
                    setActionDialogOpen(false);
                    router.refresh();
                  }}
                  onCancel={() => setActionDialogOpen(false)}
                />
             </div>
          ) : (
          <div className="flex flex-col gap-3 mt-10">
            <Button 
                onClick={handleMarkAsRepaid} 
                disabled={loading} 
                className="w-full py-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-base font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
            >
              {loading ? "Reconciling Ledger..." : "Authorize Closure"}
            </Button>
            <Button 
                variant="ghost" 
                onClick={() => setActionDialogOpen(false)}
                className="w-full py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground hover:bg-neutral-50"
            >
              Discard Action
            </Button>
          </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none ring-1 ring-neutral-100 shadow-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-black tracking-tighter">
              Reassign Loan Officer
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground">
              Change the officer responsible for this loan application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Officer</span>
                <span className="font-semibold">{currentOfficer}</span>
              </div>
            </div>

            {officersError && (
              <Alert variant="destructive">
                <AlertTitle>Unable to load officers</AlertTitle>
                <AlertDescription>{officersError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Loan Officer</label>
              <Select
                value={selectedOfficerId}
                onValueChange={setSelectedOfficerId}
                disabled={officersLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={officersLoading ? "Loading officers..." : "Choose officer"} />
                </SelectTrigger>
                <SelectContent>
                  {loanOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.name} {officer.role ? `(${officer.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)} disabled={reassigning}>
              Cancel
            </Button>
            <Button onClick={handleReassignOfficer} disabled={reassigning || officersLoading || !selectedOfficerId}>
              {reassigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
