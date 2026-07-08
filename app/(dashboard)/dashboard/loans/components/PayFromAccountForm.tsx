"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Info, PieChart } from "lucide-react";

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  accountType: { name: string };
  branch: { name: string };
}

interface PayFromAccountFormProps {
  loanId: string;
  totalDue: number;
  loanInterestAmount?: number;
  loanInterestPaid?: number;
  memberAccounts: Account[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PayFromAccountForm({
  loanId,
  totalDue,
  loanInterestAmount = 0,
  loanInterestPaid = 0,
  memberAccounts,
  onSuccess,
  onCancel,
}: PayFromAccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<string>(totalDue.toString());
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  
  // Splitting states
  const [interestPaid, setInterestPaid] = useState<number>(0);
  const [penaltyPaid, setPenaltyPaid] = useState<number>(0);
  const [principalPaid, setPrincipalPaid] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const selectedAccount = memberAccounts.find((a) => a.id === selectedAccountId);
  const totalSplit = interestPaid + penaltyPaid + principalPaid;
  const remainingAfterPayment = Math.max(0, totalDue - parseFloat(amount || "0"));

  // Auto-calculate split when amount changes - Proportional Method
  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    if (amountValue <= 0) {
      setInterestPaid(0);
      setPenaltyPaid(0);
      setPrincipalPaid(0);
      return;
    }

    // Proportional Split Ratio: (Total Interest / Initial Total Due)
    const initialInterest = loanInterestAmount;
    const initialTotal = totalDue + loanInterestPaid; // approximate initial total due
    const ratio = initialTotal > 0 ? (initialInterest / initialTotal) : 0;

    let calculatedInterest = amountValue * ratio;
    const remainingInterestToPay = Math.max(0, loanInterestAmount - loanInterestPaid);
    const finalInterest = Math.min(calculatedInterest, remainingInterestToPay);
    
    let remaining = amountValue - finalInterest;
    
    // For simplicity, penalty is 0 in auto-split
    setInterestPaid(Number(finalInterest.toFixed(2)));
    setPenaltyPaid(0);
    setPrincipalPaid(Number(remaining.toFixed(2)));
  }, [amount, loanInterestAmount, loanInterestPaid, totalDue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !amount) {
      toast.error("Please fill in all fields");
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error("Invalid amount");
      return;
    }

    if (amountValue > Number((totalDue + 0.1).toFixed(2))) {
      toast.error("Amount exceeds outstanding balance", {
        description: `Maximum allowed: ${formatCurrency(totalDue)}`
      });
      return;
    }

    if (selectedAccount && selectedAccount.balance < amountValue) {
      toast.error("Insufficient balance in selected account", {
        description: `Available: ${formatCurrency(selectedAccount.balance)}`
      });
      return;
    }

    // Validation for manual split sum
    if (Math.abs(totalSplit - amountValue) > 0.01) {
      toast.error("Total split does not match repayment amount", {
        description: `Split total: ${formatCurrency(totalSplit)}, Amount: ${formatCurrency(amountValue)}`
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/loans/${loanId}/pay-from-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccountId: selectedAccountId,
          amount: amountValue,
          interestPaid,
          penaltyPaid,
          principalPaid,
          notes: notes.trim() || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process payment");
      }

      toast.success("Payment successful");
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const maxAllowed = Math.min(totalDue, selectedAccount ? selectedAccount.balance : Infinity);

  const handleAmountChange = (val: string) => {
    let num = parseFloat(val) || 0;
    if (num > maxAllowed) {
      num = maxAllowed;
      toast.info("Amount capped", {
        description: `Maximum allowed: ${formatCurrency(maxAllowed)}`
      });
    }
    setAmount(num.toString());
  };

  const eligibleAccounts = memberAccounts.filter((a) => 
    a.balance > 0 && 
    !a.accountType.name.toLowerCase().includes("share")
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Repayment Snapshot
              </p>
              <p className="text-sm text-slate-600">
                The selected source account will be debited, then the payment is split into principal, interest, and penalty against the loan.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Remaining After
              </p>
              <p className="text-lg font-black text-emerald-700">
                {formatCurrency(remainingAfterPayment)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Outstanding</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(totalDue)}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Principal</p>
              <p className="mt-1 text-sm font-black text-rose-700">{formatCurrency(principalPaid)}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interest</p>
              <p className="mt-1 text-sm font-black text-amber-700">{formatCurrency(interestPaid)}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Penalty</p>
              <p className="mt-1 text-sm font-black text-blue-700">{formatCurrency(penaltyPaid)}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Posting logic: source account debit, loan principal credit to 107000 Loans, interest to income, penalty to penalty income.
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Source Account</Label>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Select account to pay from" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {eligibleAccounts.length === 0 ? (
                <SelectItem value="none" disabled>
                  No accounts with funds available
                </SelectItem>
              ) : (
                eligibleAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountType.name} - {account.accountNumber} ({formatCurrency(account.balance)})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedAccount && (
            <p className="text-[10px] text-muted-foreground">
              Selected source balance: {formatCurrency(selectedAccount.balance)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Payment Amount (UGX)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              min={1}
              max={maxAllowed}
              className="h-11 rounded-xl font-bold text-lg"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground italic">
              <span>Outstanding: {formatCurrency(totalDue)}</span>
              <span className={amount && parseFloat(amount) >= maxAllowed ? "text-orange-600 font-bold" : ""}>
                Max Allowed: {formatCurrency(maxAllowed)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal reference or reason"
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        {/* Allocation Breakdown */}
        {parseFloat(amount) > 0 && (
          <div className="space-y-3 p-4 border rounded-2xl bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
              <PieChart className="h-4 w-4 text-indigo-500" />
              Repayment Allocation
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col gap-1">
                <Label className="text-[10px] text-orange-600 font-bold uppercase tracking-tighter">Interest</Label>
                <Input
                  type="number"
                  value={interestPaid}
                  onChange={(e) => setInterestPaid(parseFloat(e.target.value) || 0)}
                  className="h-8 p-0 border-0 focus-visible:ring-0 font-bold text-orange-700"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col gap-1">
                <Label className="text-[10px] text-red-600 font-bold uppercase tracking-tighter">Penalty</Label>
                <Input
                  type="number"
                  value={penaltyPaid}
                  onChange={(e) => setPenaltyPaid(parseFloat(e.target.value) || 0)}
                  className="h-8 p-0 border-0 focus-visible:ring-0 font-bold text-red-700"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col gap-1">
                <Label className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter">Principal</Label>
                <Input
                  type="number"
                  value={principalPaid}
                  onChange={(e) => setPrincipalPaid(parseFloat(e.target.value) || 0)}
                  className="h-8 p-0 border-0 focus-visible:ring-0 font-bold text-indigo-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white/50 p-2">
              <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <Info className="h-3.3 w-3.5 text-indigo-400 flex-shrink-0" />
                Allocated automatically based on the repayment split rule. You may override these values if necessary.
              </p>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Total Split: {formatCurrency(totalSplit)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl h-11 px-6 font-bold text-xs uppercase tracking-widest text-muted-foreground hover:bg-neutral-50"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading || !selectedAccountId || !amount}
          className="rounded-xl h-11 px-8 bg-indigo-600 hover:bg-indigo-700 font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            "Authorize Recovery"
          )}
        </Button>
      </div>
    </form>
  );
}
