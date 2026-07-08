"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2, DollarSign } from "lucide-react";

interface DisburseLoanFormProps {
  loan: any; // Using any for simplicity with complex relations, but should be typed
  memberAccounts: any[];
}

export default function DisburseLoanForm({ loan, memberAccounts }: DisburseLoanFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    memberAccounts.length > 0 ? memberAccounts[0].id : ""
  );
  const [periodMonths, setPeriodMonths] = useState<string>(
    loan.loanApplication?.repaymentPeriodMonths?.toString() || 
    Math.ceil((loan.loanApplication?.loanProduct?.repaymentPeriodDays || 30) / 30).toString()
  );
  const [repaymentStartDate, setRepaymentStartDate] = useState<string>(
    loan.loanApplication?.repaymentStartDate ? new Date(loan.loanApplication.repaymentStartDate).toISOString().split('T')[0] : 
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDeductions = () => {
    const { amountGranted, loanApplication } = loan;
    const requestedAmount = Number(loanApplication?.amountApplied || loanApplication?.requestedAmount || amountGranted || 0);
    const grossAmount = Number(amountGranted || loanApplication?.approvedAmount || loanApplication?.amountGranted || requestedAmount || 0);
    const breakdown = {
      processingFee: 0,
      insurance: 0,
      shareCapital: 0,
      existingLoanRecovery: 0,
      total: 0
    };

    if (loanApplication.applyLoanProcessingFee && loanApplication.loanProcessingFeePercentage) {
      breakdown.processingFee = Math.round((grossAmount * loanApplication.loanProcessingFeePercentage) / 100);
    }

    if (loanApplication.applyLoanInsurance && loanApplication.loanInsurancePercentage) {
      breakdown.insurance = Math.round((grossAmount * loanApplication.loanInsurancePercentage) / 100);
    }

    if (loanApplication.applyShareDeduction && loanApplication.shareAmount) {
      breakdown.shareCapital = Number(loanApplication.shareAmount);
    }

    if (loanApplication.existingLoanBalance && loanApplication.existingLoanBalance > 0) {
        breakdown.existingLoanRecovery = loanApplication.existingLoanBalance;
    }

    breakdown.total = breakdown.processingFee + breakdown.insurance + breakdown.shareCapital + breakdown.existingLoanRecovery;
    
    return breakdown;
  };

  const deductionDestinations = {
    processingFee: "Loan fee income",
    insurance: "Loan insurance pool",
    shareCapital: "Share capital account",
    existingLoanRecovery: "Existing loan recovery",
  } as const;

  const deductions = calculateDeductions();
  const requestedAmount = Number(loan.loanApplication?.amountApplied || loan.loanApplication?.requestedAmount || loan.amountGranted || 0);
  const grossAmount = Number(loan.amountGranted || loan.loanApplication?.approvedAmount || loan.loanApplication?.amountGranted || requestedAmount || 0);
  const netAmount = grossAmount - deductions.total;

  const handleDisburse = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account for disbursement");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/v1/loans/${loan.id}/disburse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          periodMonths: Number(periodMonths),
          repaymentStartDate,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disburse loan");
      }

      toast.success("Loan disbursed successfully");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Disbursement error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disburse loan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <DollarSign className="w-4 h-4 mr-2" />
          Disburse Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disburse Loan</DialogTitle>
          <DialogDescription>
            Review the disbursement details and confirm to credit the member's account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Loan Requested:</span>
                <span className="font-medium">{formatCurrency(requestedAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-gray-500">Gross Amount Before Deductions:</span>
                <span className="font-medium">{formatCurrency(grossAmount)}</span>
            </div>
            
            <div className="border-t border-gray-200 my-2 pt-2 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Deductions Taken From Approved Loan</p>
                {deductions.processingFee > 0 && (
                    <div className="flex justify-between gap-4 text-sm">
                        <span className="text-gray-500">
                          Processing Fee
                          <span className="block text-[10px] text-gray-400">{deductionDestinations.processingFee}</span>
                        </span>
                        <span className="text-red-600 whitespace-nowrap">-{formatCurrency(deductions.processingFee)}</span>
                    </div>
                )}
                {deductions.insurance > 0 && (
                    <div className="flex justify-between gap-4 text-sm">
                        <span className="text-gray-500">
                          Insurance
                          <span className="block text-[10px] text-gray-400">{deductionDestinations.insurance}</span>
                        </span>
                        <span className="text-red-600 whitespace-nowrap">-{formatCurrency(deductions.insurance)}</span>
                    </div>
                )}
                {deductions.shareCapital > 0 && (
                    <div className="flex justify-between gap-4 text-sm">
                        <span className="text-gray-500">
                          Share Capital
                          <span className="block text-[10px] text-gray-400">{deductionDestinations.shareCapital}</span>
                        </span>
                        <span className="text-red-600 whitespace-nowrap">-{formatCurrency(deductions.shareCapital)}</span>
                    </div>
                )}
                {deductions.existingLoanRecovery > 0 && (
                     <div className="flex justify-between gap-4 text-sm">
                     <span className="text-gray-500">
                       Loan Recovery
                       <span className="block text-[10px] text-gray-400">{deductionDestinations.existingLoanRecovery}</span>
                     </span>
                     <span className="text-red-600 whitespace-nowrap">-{formatCurrency(deductions.existingLoanRecovery)}</span>
                 </div>
                )}
                {deductions.total === 0 && (
                    <span className="text-sm text-gray-400 italic">No deductions applicable</span>
                )}
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-lg">
                <span>Net Cash to Client:</span>
                <span className="text-green-700">{formatCurrency(netAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Account</Label>
            <Select 
                value={selectedAccountId} 
                onValueChange={setSelectedAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {memberAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountNumber} - {account.accountType?.name || 'Account'} ({formatCurrency(account.balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
                <Label>Repayment Period (Months)</Label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={periodMonths}
                        onChange={(e) => setPeriodMonths(e.target.value)}
                    />
                </div>
                <p className="text-[10px] text-gray-400 italic">Default: {loan.loanApplication?.repaymentPeriodMonths || 'N/A'} mo</p>
            </div>
            <div className="space-y-2">
                <Label>First Repayment Date</Label>
                <input
                    type="date"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={repaymentStartDate}
                    onChange={(e) => setRepaymentStartDate(e.target.value)}
                />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes about this disbursement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
                onClick={handleDisburse} 
                className="bg-green-600 hover:bg-green-700"
                disabled={loading || !selectedAccountId}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Disbursement"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
