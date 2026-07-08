
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
  currentFloat: number;
}

export default function DisburseLoanForm({ loan, currentFloat }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const app = loan.loanApplication;
  const amount = loan.amountGranted;

  // Calculate Deductions (Mirroring backend logic)
  const deductions = {
    processingFee: app.applyLoanProcessingFee 
        ? (amount * (app.loanProcessingFeePercentage || 2)) / 100 
        : 0,
    insurance: (app.applyLoanInsurance && app.loanInsurancePercentage) 
        ? (amount * app.loanInsurancePercentage) / 100 
        : 0,
    shares: (app.applyShareDeduction && app.shareAmount) 
        ? app.shareAmount 
        : 0,
    loanRecovery: (app.existingLoanBalance && app.existingLoanBalance > 0) 
        ? app.existingLoanBalance 
        : 0
  };

  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
  const netDisbursement = amount - totalDeductions;
  
  const hasInsufficientFloat = currentFloat < netDisbursement;

  const handleDisburse = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/loans/${loan.id}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processingFeePercentage: app.loanProcessingFeePercentage || 2,
          periodMonths: app.repaymentPeriodMonths || 12,
          repaymentStartDate: app.repaymentStartDate
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to disburse loan");
      }

      toast.success("Loan disbursed successfully", {
        description: `Net amount: UGX ${netDisbursement.toLocaleString()}`,
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
                    <span>Approved Amount</span>
                    <span>UGX {amount.toLocaleString()}</span>
                </div>
                <div className="h-px bg-border my-2" />
                
                <div className="space-y-1 text-sm text-muted-foreground">
                    {deductions.processingFee > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>Processing Fee</span>
                            <span>- UGX {deductions.processingFee.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.insurance > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>Insurance</span>
                            <span>- UGX {deductions.insurance.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.shares > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>Shares Deduction</span>
                            <span>- UGX {deductions.shares.toLocaleString()}</span>
                        </div>
                    )}
                    {deductions.loanRecovery > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>Loan Recovery</span>
                            <span>- UGX {deductions.loanRecovery.toLocaleString()}</span>
                        </div>
                    )}
                </div>

                <div className="h-px bg-border my-2" />
                <div className="flex justify-between font-bold text-lg">
                    <span>Net Disbursement</span>
                    <span className="text-green-600">UGX {netDisbursement.toLocaleString()}</span>
                </div>
            </div>

            {hasInsufficientFloat && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Insufficient Funds</AlertTitle>
                    <AlertDescription>
                        You have UGX {currentFloat.toLocaleString()} available, but need UGX {netDisbursement.toLocaleString()} to process this disbursement.
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
            disabled={loading || hasInsufficientFloat}
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
