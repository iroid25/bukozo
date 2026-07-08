// app/dashboard/float/users/[userId]/components/FloatReconciliationForm.tsx
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatReconciliationCreateDTO } from "@/types/float";
export type iroid={
  name:string;
  id:string
}

interface FloatReconciliationCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: FloatReconciliationCreateDTO
  ) => Promise<{ success: boolean }>;
  floatId: string;
  currentBalance: number;
}

export default function FloatReconciliationCreateForm({
  isOpen,
  onClose,
  onSubmit,
  floatId,
  currentBalance,
}: FloatReconciliationCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actualCash, setActualCash] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (actualCash < 0) {
      alert("Actual cash amount cannot be negative");
      setIsSubmitting(false);
      return;
    }

    const result = await onSubmit({
      floatId,
      actualCash,
    });

    if (result.success) {
      setActualCash(0);
    }

    setIsSubmitting(false);
  };

  const difference = actualCash - currentBalance;
  const tolerance = 1000; // 1000 UGX tolerance
  const isBalanced = Math.abs(difference) <= tolerance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reconcile Float</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemBalance">System Balance</Label>
            <Input
              id="systemBalance"
              type="text"
              value={currentBalance.toLocaleString() + " UGX"}
              disabled
            />
            <p className="text-sm text-gray-500">
              This is the current balance according to the system.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actualCash">Actual Cash Count</Label>
            <Input
              id="actualCash"
              type="number"
              min="0"
              step="any"
              value={actualCash}
              onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
              required
            />
            <p className="text-sm text-gray-500">
              Enter the actual physical cash count.
            </p>
          </div>

          {actualCash > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <h4 className="font-medium">Reconciliation Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">System Balance: </span>
                  <span className="font-medium">
                    {currentBalance.toLocaleString()} UGX
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Actual Cash: </span>
                  <span className="font-medium">
                    {actualCash.toLocaleString()} UGX
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Difference: </span>
                  <span
                    className={`font-medium ${
                      difference > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {difference > 0 ? "+" : ""}
                    {difference.toLocaleString()} UGX
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Status: </span>
                  <span
                    className={`font-medium ${
                      isBalanced ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isBalanced ? "Balanced" : "Unbalanced"}
                  </span>
                </div>
              </div>
            </div>
          )}

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
              {isSubmitting ? "Processing..." : "Reconcile Float"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
