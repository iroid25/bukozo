"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeftRight, AlertCircle } from "lucide-react";

const returnSchema = z.object({
  amount: z.string().min(1, "Cash amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Must be a positive number"
  ),
  floatAmount: z.string().min(1, "Float amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) >= 0,
    "Must be a non-negative number"
  ),
  notes: z.string().optional(),
});

type ReturnFormValues = z.infer<typeof returnSchema>;

interface ProposeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchVault: any;
  orgReserveId: string;
}

export default function ProposeReturnModal({
  isOpen,
  onClose,
  branchVault,
  orgReserveId,
}: ProposeReturnModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      amount: "",
      floatAmount: "",
      notes: "",
    },
  });

  const watchAmount = form.watch("amount");
  const watchFloatAmount = form.watch("floatAmount");
  const totalReturn = (Number(watchAmount) || 0) + (Number(watchFloatAmount) || 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const onSubmit = async (data: ReturnFormValues) => {
    if (totalReturn > branchVault.balance) {
      toast.error("Insufficient balance", {
        description: `You only have ${formatCurrency(branchVault.balance)} available`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/reserve/return/propose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(data.amount),
          floatAmount: Number(data.floatAmount),
          sourceVaultId: branchVault.id,
          targetVaultId: orgReserveId,
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to propose return");
        return;
      }

      toast.success("Return Proposal Submitted", {
        description: "HQ will review and confirm your return request.",
      });

      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen}  onOpenChange={onClose}>
      <DialogContent className="max-w-xl overflow-y-scroll h-[90vh] ">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            Propose Reserve Return to HQ
          </DialogTitle>
          <DialogDescription>
            Propose returning excess cash and float back to the Organisational Reserve.
            This requires HQ approval before funds are transferred.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
              {/* Current Balance Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">
                    Available Balance:
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(branchVault.balance)}
                  </span>
                </div>
              </div>

              {/* Cash Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash Amount to Return (UGX) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 5000000"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>Physical cash to return to HQ</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Float Amount */}
              <FormField
                control={form.control}
                name="floatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Float Amount to Return (UGX) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 2000000"
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>Operational float to return</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Return (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Excess funds from reduced operations"
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Explain why you're returning these funds
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Total Display */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-900">
                    Total Return Amount:
                  </span>
                  <span className="text-2xl font-bold text-purple-900">
                    {formatCurrency(totalReturn)}
                  </span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This is a proposal. The funds will remain in your
                  branch until HQ reviews and confirms this return request.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || totalReturn <= 0 || totalReturn > branchVault.balance}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Submitting..." : "Propose Return"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
