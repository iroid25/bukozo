"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawVaultFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  accountantId: string;
  currentBalance: number;
}

export default function WithdrawVaultFundsModal({ isOpen, onClose, vaultId, currentBalance }: WithdrawVaultFundsModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Please enter a valid amount");
        setIsLoading(false);
        return;
      }
      if (amountNum > currentBalance) {
        setError(`Insufficient balance. Available: ${formatCurrency(currentBalance)}`);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/v1/vault/withdraw-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, amount: amountNum, description: description.trim() || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to withdraw funds");

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setAmount("");
        setDescription("");
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setAmount("");
      setDescription("");
      setError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-orange-600" />
            Withdraw Funds from Vault
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">✓ Funds withdrawn successfully!</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Current Vault Balance</Label>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(currentBalance)}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Withdraw (UGX) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g., 5000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                max={currentBalance}
                step="1000"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">Enter amount for bank deposit</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Bank deposit for operational expenses"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <strong>Important:</strong> This reduces your vault balance. Deposit in bank and keep records.
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !amount} className="flex-1 bg-orange-600 hover:bg-orange-700">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Withdraw Funds"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
