// app/dashboard/accountant/vault/components/AddReserveFundsModal.tsx
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
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

const addFundsSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be greater than zero",
    }),
  description: z.string().optional(),
});

type AddFundsFormValues = z.infer<typeof addFundsSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  accountantId: string;
  currentBalance: number;
}

export default function AddReserveFundsModal({
  isOpen,
  onClose,
  vaultId,
  accountantId,
  currentBalance,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddFundsFormValues>({
    resolver: zodResolver(addFundsSchema),
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
  const newBalance = currentBalance + (Number(watchAmount) || 0);

  const onSubmit = async (data: AddFundsFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/vault/add-funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId,
          amount: parseFloat(data.amount),
          description: data.description,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Failed to add funds", {
          description: result.error || "Failed to add funds",
        });
        return;
      }

      toast.success("Funds added successfully", {
        description: `${formatCurrency(parseFloat(data.amount))} added to reserve`,
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Add Funds to Reserve
          </DialogTitle>
          <DialogDescription>
            Add money from bank withdrawal or other sources to increase reserve
            balance
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-1 pr-2 space-y-4">
              {/* Current Balance Display */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Current Balance</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(currentBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">New Balance</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(newBalance)}
                      </p>
                    </div>
                  </div>
                  {watchAmount && Number(watchAmount) > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">
                        +{formatCurrency(Number(watchAmount))}
                      </span>
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
                    <FormLabel>Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter amount (e.g., 5000000)"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the amount to add to the reserve in Ugandan Shillings
                    </FormDescription>
                    <FormMessage />
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
                        placeholder="e.g., Bank withdrawal from Standard Bank Account #12345"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Add any notes about the source of these funds
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
                        Ensure you have the physical cash on hand before adding
                        funds to the reserve. This operation will increase your
                        reserve balance and you will be responsible for this amount.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="flex gap-3 justify-end pt-4 border-t mt-auto">
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
                  isSubmitting || !watchAmount || Number(watchAmount) <= 0
                }
                className="min-w-[150px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Adding Funds...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Add Funds
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
