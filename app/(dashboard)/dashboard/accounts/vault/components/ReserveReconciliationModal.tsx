// app/dashboard/accountant/vault/components/ReserveReconciliationModal.tsx
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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
} from "lucide-react";

const reconciliationSchema = z.object({
  physicalCash: z
    .string()
    .min(1, "Physical cash amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Amount must be zero or greater",
    }),
  notes: z.string().optional(),
});

type ReconciliationFormValues = z.infer<typeof reconciliationSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  accountantId: string;
  systemBalance: number;
  physicalCash: number;
}

export default function ReserveReconciliationModal({
  isOpen,
  onClose,
  vaultId,
  accountantId,
  systemBalance,
  physicalCash: initialPhysicalCash,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      physicalCash: initialPhysicalCash.toString(),
      notes: "",
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const watchPhysicalCash = form.watch("physicalCash");
  const physicalAmount = Number(watchPhysicalCash) || 0;
  const variance = physicalAmount - systemBalance;
  const isBalanced = Math.abs(variance) <= 1000; // Allow 1000 UGX tolerance

  const getVarianceStatus = () => {
    if (isBalanced) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        label: "Balanced",
        color: "bg-green-100 text-green-700 border-green-300",
        message: "Reserve is balanced within acceptable tolerance (±1,000 UGX)",
      };
    } else if (variance > 0) {
      return {
        icon: <TrendingUp className="h-5 w-5 text-blue-600" />,
        label: "Overage",
        color: "bg-blue-100 text-blue-700 border-blue-300",
        message: `Physical cash exceeds system balance by ${formatCurrency(variance)}`,
      };
    } else {
      return {
        icon: <TrendingDown className="h-5 w-5 text-red-600" />,
        label: "Shortage",
        color: "bg-red-100 text-red-700 border-red-300",
        message: `Physical cash is less than system balance by ${formatCurrency(Math.abs(variance))}`,
      };
    }
  };

  const varianceStatus = getVarianceStatus();

  const onSubmit = async (data: ReconciliationFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/vault/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId,
          physicalCash: parseFloat(data.physicalCash),
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Verification failed", {
          description: result.error || "Please try again",
        });
        return;
      }

      toast.success(result.message || "Reserve verified successfully", {
        description: `Variance: ${variance === 0 ? "None" : formatCurrency(Math.abs(variance))}`,
      });

      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("Verification failed", {
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            Reserve Verification
          </DialogTitle>
          <DialogDescription>
            Verify physical cash matches system balance and record any variances
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Balance Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">
                      System Balance
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(systemBalance)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Expected amount</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">
                      Physical Cash
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-gray-700">
                    {formatCurrency(physicalAmount)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Actual amount counted
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Variance Display */}
            <Card className={`${varianceStatus.color} border-2`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {varianceStatus.icon}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">Variance Status</p>
                      <Badge className={varianceStatus.color}>
                        {varianceStatus.label}
                      </Badge>
                    </div>
                    <p className="text-sm mb-2">{varianceStatus.message}</p>
                    {variance !== 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span>Variance Amount:</span>
                          <span
                            className={`font-bold ${variance > 0 ? "text-blue-700" : "text-red-700"}`}
                          >
                            {variance > 0 ? "+" : ""}
                            {formatCurrency(variance)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Physical Cash Input */}
            <FormField
              control={form.control}
              name="physicalCash"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Physical Cash Amount (UGX) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter actual cash counted"
                      {...field}
                      className="text-lg"
                    />
                  </FormControl>
                  <FormDescription>
                    Count all physical cash in the reserve and enter the total
                    amount
                  </FormDescription>
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
                  <FormLabel>Verification Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any observations, explanations for variances, or other relevant notes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {!isBalanced &&
                      "Variance detected - please provide explanation"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning for Significant Variance */}
            {Math.abs(variance) > 100000 && (
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Significant Variance Detected
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        The variance exceeds 100,000 UGX. Please double-check
                        your count and provide detailed explanation in the notes
                        section.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Summary */}
            {!isBalanced && (
              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    What will happen:
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                    {variance > 0 && (
                      <>
                        <li>
                          System balance will be updated to match physical cash
                        </li>
                        <li>Overage will be recorded in reserve transactions</li>
                        <li>Audit log will be created for this adjustment</li>
                      </>
                    )}
                    {variance < 0 && (
                      <>
                        <li>
                          System balance will be updated to match physical cash
                        </li>
                        <li>Shortage will be recorded in reserve transactions</li>
                        <li>
                          Investigation may be required for significant
                          shortages
                        </li>
                      </>
                    )}
                  </ul>
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
                disabled={isSubmitting || !watchPhysicalCash}
                className="min-w-[150px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Verification
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
