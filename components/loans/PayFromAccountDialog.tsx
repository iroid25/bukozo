"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CreditCard, Loader2, CheckCircle } from "lucide-react";

interface PayFromAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  memberId: string;
  memberName: string;
  outstandingBalance: number;
  onSuccess?: () => void;
}

interface Account {
  id: string;
  accountNumber: string;
  accountType: { name: string };
  balance: number;
}

export default function PayFromAccountDialog({
  open,
  onOpenChange,
  loanId,
  memberId,
  memberName,
  outstandingBalance,
  onSuccess,
}: PayFromAccountDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState(outstandingBalance.toString());
  const [loading, setLoading] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);

  // Fetch member accounts when dialog opens
  useEffect(() => {
    if (open && memberId) {
      fetchMemberAccounts();
    }
  }, [open, memberId]);

  const fetchMemberAccounts = async () => {
    setFetchingAccounts(true);
    try {
      const response = await fetch(`/api/v1/members/${memberId}/accounts`);
      const result = await response.json();
      
      if (result.success) {
        // Filter to only show accounts with sufficient balance
        const eligibleAccounts = result.data.filter(
          (acc: Account) => acc.balance > 0
        );
        setAccounts(eligibleAccounts);
        
        if (eligibleAccounts.length === 0) {
          toast.error("Member has no accounts with available balance");
        }
      } else {
        toast.error("Failed to fetch member accounts");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("An error occurred while fetching accounts");
    } finally {
      setFetchingAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
    if (selectedAccount && paymentAmount > selectedAccount.balance) {
      toast.error(`Insufficient balance. Available: ${formatCurrency(selectedAccount.balance)}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/loans/${loanId}/pay-from-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceAccountId: selectedAccountId,
          amount: paymentAmount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Payment processed successfully", {
          description: `${formatCurrency(paymentAmount)} paid from ${selectedAccount?.accountType.name} account`,
        });
        
        onOpenChange(false);
        onSuccess?.();
        
        // Reset form
        setSelectedAccountId("");
        setAmount(outstandingBalance.toString());
      } else {
        toast.error(result.error || "Payment failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("An error occurred while processing payment");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay from Member Account
          </DialogTitle>
          <DialogDescription>
            Transfer funds from {memberName}'s account to pay this loan
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account">Select Account</Label>
            {fetchingAccounts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-red-600">No eligible accounts found</p>
            ) : (
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountType.name} - {account.accountNumber} 
                      <span className="ml-2 text-muted-foreground">
                        ({formatCurrency(account.balance)})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {selectedAccount && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available Balance:</span>
                  <span className="font-semibold text-blue-700">
                    {formatCurrency(selectedAccount.balance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (UGX)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              step="1"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Outstanding Balance:</span>
              <span className="font-medium">{formatCurrency(outstandingBalance)}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(outstandingBalance.toString())}
              className="w-full"
            >
              Pay Full Outstanding Balance
            </Button>
          </div>

          {/* Payment Allocation Info */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800 font-medium mb-1">
              Payment Allocation Order:
            </p>
            <p className="text-xs text-amber-700">
              1. Penalties → 2. Interest → 3. Principal
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedAccountId || accounts.length === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Process Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
