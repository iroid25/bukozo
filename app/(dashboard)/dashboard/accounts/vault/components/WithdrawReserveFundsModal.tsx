// app/dashboard/accountant/vault/components/WithdrawReserveFundsModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpRight,
  TrendingDown,
  AlertCircle,
  DollarSign,
} from "lucide-react";

const withdrawFundsSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be greater than zero",
    }),
  description: z.string().optional(),
});

type WithdrawFundsFormValues = z.infer<typeof withdrawFundsSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  accountantId: string;
  currentBalance: number;
}

export default function WithdrawReserveFundsModal({
  isOpen,
  onClose,
  vaultId,
  accountantId,
  currentBalance,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WithdrawFundsFormValues>({
    resolver: zodResolver(withdrawFundsSchema),
    defaultValues: {
      amount: "",
      description: "",
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const watchAmount = form.watch("amount");
  const withdrawAmount = Number(watchAmount) || 0;
  const newBalance = currentBalance - withdrawAmount;
  const isInsufficientBalance = withdrawAmount > currentBalance;

  const onSubmit = async (data: WithdrawFundsFormValues) => {
    const amount = parseFloat(data.amount);

    // Validation
    if (amount > currentBalance) {
      toast.error("Insufficient balance", {
        description: `Available balance: ${formatCurrency(currentBalance)}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/vault/withdraw-funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId,
          amount,
          description: data.description,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to withdraw funds", {
          description: result.error || "Please try again",
        });
        return;
      }

      toast.success("Funds withdrawn successfully", {
        description: `${formatCurrency(amount)} withdrawn from reserve`,
      });

      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("An unexpected error occurred", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[90vh] overflow-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-orange-600" />
            Withdraw Funds from Reserve
          </DialogTitle>
          <DialogDescription>
            Withdraw money from the reserve to deposit in the bank or for other
            purposes
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Balance Display */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {formatCurrency(currentBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">New Balance</p>
                    <p
                      className={`text-2xl font-bold ${isInsufficientBalance ? "text-red-700" : "text-blue-700"}`}
                    >
                      {formatCurrency(Math.max(0, newBalance))}
                    </p>
                  </div>
                </div>
                {watchAmount && Number(watchAmount) > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-200 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span
                      className={`text-sm font-medium ${isInsufficientBalance ? "text-red-700" : "text-orange-700"}`}
                    >
                      -{formatCurrency(withdrawAmount)}
                    </span>
                    {isInsufficientBalance && (
                      <span className="text-xs text-red-600 ml-auto">
                        Exceeds available balance!
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Amount Input */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Withdraw (UGX) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter amount (e.g., 5000000)"
                      {...field}
                      className="text-lg"
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the amount to withdraw from the reserve in Ugandan
                    Shillings
                  </FormDescription>
                  <FormMessage />
                  {isInsufficientBalance && (
                    <p className="text-sm text-red-600 mt-1">
                      Amount exceeds available balance of{" "}
                      {formatCurrency(currentBalance)}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Bank deposit for operational expenses at Standard Bank"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Add any notes about the purpose of this withdrawal
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning Notice */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Important Notice
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      This operation will reduce your reserve balance. Ensure you
                      deposit this amount in the bank or use it for the intended
                      purpose. Keep proper records and receipts for audit
                      purposes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Summary */}
            {watchAmount &&
              Number(watchAmount) > 0 &&
              !isInsufficientBalance && (
                <Card className="bg-gray-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Transaction Summary:
                    </p>
                    <div className="space-y-1 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>Current Reserve Balance:</span>
                        <span className="font-medium">
                          {formatCurrency(currentBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>Amount to Withdraw:</span>
                        <span className="font-medium">
                          -{formatCurrency(withdrawAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="font-medium">New Balance:</span>
                        <span className="font-bold">
                          {formatCurrency(newBalance)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !watchAmount ||
                  Number(watchAmount) <= 0 ||
                  isInsufficientBalance
                }
                className="min-w-[150px] bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Withdraw Funds
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
