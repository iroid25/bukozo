// app/dashboard/float/users/[userId]/components/FloatTransactionForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FloatTransactionCreateDTO, FloatTransactionType } from "@/types/float";

interface FloatTransactionCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FloatTransactionCreateDTO) => Promise<{ success: boolean }>;
  floatId: string;
  currentBalance: number;
}

const transactionTypes = [
  { value: FloatTransactionType.DEPOSIT, label: "Member Deposit" },
  { value: FloatTransactionType.WITHDRAWAL, label: "Member Withdrawal" },
  { value: FloatTransactionType.PURCHASE, label: "Float Purchase" },
  { value: FloatTransactionType.ALLOCATION, label: "Float Allocation" },
  { value: FloatTransactionType.RECONCILIATION, label: "Reconciliation" },
  { value: FloatTransactionType.OTHER, label: "Other" },
];

export default function FloatTransactionCreateForm({
  isOpen,
  onClose,
  onSubmit,
  floatId,
  currentBalance,
}: FloatTransactionCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FloatTransactionCreateDTO>({
    floatId,
    type: FloatTransactionType.DEPOSIT,
    amount: 0,
    description: "",
  });

  const handleInputChange = (
    field: keyof FloatTransactionCreateDTO,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate amount
    if (formData.amount <= 0) {
      alert("Amount must be greater than zero");
      setIsSubmitting(false);
      return;
    }

    // For withdrawals, check if there's sufficient balance
    if (
      formData.type === FloatTransactionType.WITHDRAWAL &&
      formData.amount > currentBalance
    ) {
      alert("Insufficient float balance for this withdrawal");
      setIsSubmitting(false);
      return;
    }

    const result = await onSubmit(formData);

    if (result.success) {
      setFormData({
        floatId,
        type: FloatTransactionType.DEPOSIT,
        amount: 0,
        description: "",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Transaction Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: FloatTransactionType) =>
                handleInputChange("type", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                {transactionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (UGX)
              {formData.type === FloatTransactionType.WITHDRAWAL && (
                <span className="text-sm text-gray-500 ml-2">
                  Available: {currentBalance.toLocaleString()} UGX
                </span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="any"
              value={formData.amount}
              onChange={(e) =>
                handleInputChange("amount", parseFloat(e.target.value) || 0)
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter transaction description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Create Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
