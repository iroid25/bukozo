
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Banknote, Loader2 } from "lucide-react";

interface Props {
  loan: any;
  currentReserve: number;
}

export default function DisburseLoanForm({ loan, currentReserve }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const app = loan.loanApplication || {};
  const requestedAmount = Number(app.amountApplied || app.requestedAmount || loan.amountGranted || 0);
  const approvedAmount = Number(loan.amountGranted || app.approvedAmount || app.amountGranted || requestedAmount || 0);

  // Calculate Deductions (Mirroring backend logic)
  const deductions = {
    processingFee: app.applyLoanProcessingFee
        ? Math.round((approvedAmount * (app.loanProcessingFeePercentage || 2)) / 100)
        : 0,
    insurance: (app.applyLoanInsurance && app.loanInsurancePercentage)
        ? Math.round((approvedAmount * app.loanInsurancePercentage) / 100)
        : 0,
    shares: (app.applyShareDeduction && app.shareAmount)
        ? Number(app.shareAmount)
        : 0,
    loanRecovery: (app.existingLoanBalance && app.existingLoanBalance > 0)
        ? Number(app.existingLoanBalance)
        : 0
  };
  const deductionDestinations = {
    processingFee: "Loan fee income",
    insurance: "Loan insurance pool",
    shares: "Share capital account",
    loanRecovery: "Existing loan recovery",
  } as const;

  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
  const netDisbursement = approvedAmount - totalDeductions;

  const hasInsufficientReserve = currentReserve < netDisbursement;

  const handleDisburse = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/loans/${loan.id}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: loan.member?.accounts?.find((account: any) => account.status === "ACTIVE")?.id,
          processingFeePercentage: app.loanProcessingFeePercentage || 2,
          periodMonths: app.repaymentPeriodMonths || 12,
          repaymentStartDate: app.repaymentStartDate
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to disburse loan");
      }

      const grossAmount = Number(data?.grossAmount ?? approvedAmount);
      const netPaid = Number(data?.netDisbursement ?? netDisbursement);
      const deductionsPaid = Number(data?.totalDeductions ?? totalDeductions);

      toast.success("Loan disbursed successfully", {
          description: `Gross: UGX ${grossAmount.toLocaleString()} | Deductions: UGX ${deductionsPaid.toLocaleString()} | Net paid: UGX ${netPaid.toLocaleString()} | Branch reserve debited: UGX ${netPaid.toLocaleString()}`,
      });
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
            <Banknote className="mr-2 h-4 w-4" />
            Disburse Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Disbursement</DialogTitle>
          <DialogDescription>
            Review the disbursement details below. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between font-medium">
                    <span>Total Loan Requested</span>
                    <span>UGX {requestedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Gross Amount Before Deductions</span>
                    <span>UGX {approvedAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Deductions are taken from the approved amount. Only the net cash is paid out to the client, while each deduction is posted to its destination account.
                </p>
                <div className="h-px bg-border my-2" />
                
                <div className="space-y-1 text-sm text-muted-foreground">
                    {deductions.processingFee > 0 && (
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>
                              Processing Fee
                              <span className="block text-[11px] text-muted-foreground">
                                {deductionDestinations.processingFee}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">- UGX {deductions.processingFee.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.insurance > 0 && (
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>
                              Insurance
                              <span className="block text-[11px] text-muted-foreground">
                                {deductionDestinations.insurance}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">- UGX {deductions.insurance.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.shares > 0 && (
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>
                              Shares Deduction
                              <span className="block text-[11px] text-muted-foreground">
                                {deductionDestinations.shares}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">- UGX {deductions.shares.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.loanRecovery > 0 && (
                        <div className="flex justify-between gap-4 text-red-500">
                            <span>
                              Loan Recovery
                              <span className="block text-[11px] text-muted-foreground">
                                {deductionDestinations.loanRecovery}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">- UGX {deductions.loanRecovery.toLocaleString()}</span>
                        </div>
                    )}
                </div>

                <div className="h-px bg-border my-2" />
                <div className="flex justify-between font-bold text-lg">
                    <span>Net Cash to Client</span>
                    <span className="text-green-600">UGX {netDisbursement.toLocaleString()}</span>
                </div>
            </div>

            {hasInsufficientReserve && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Insufficient Branch Reserve</AlertTitle>
                    <AlertDescription>
                        You have UGX {currentReserve.toLocaleString()} available in the branch reserve, but need UGX {netDisbursement.toLocaleString()} to pay the client after deductions.
                    </AlertDescription>
                </Alert>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDisburse} 
            disabled={loading || hasInsufficientReserve}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Disbursement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
