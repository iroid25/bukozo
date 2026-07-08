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
  Building2, 
  ArrowRight, 
  DollarSign, 
  AlertTriangle,
  History
} from "lucide-react";
const allocationSchema = z.object({
  amount: z.string().min(1, "Cash amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  floatAmount: z.string().min(1, "Float amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  notes: z.string().optional(),
});

type AllocationFormValues = z.infer<typeof allocationSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetBranch: any;
  sourceVault: any;
}

export default function ProposeReserveAllocationModal({
  isOpen,
  onClose,
  targetBranch,
  sourceVault,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      amount: "",
      floatAmount: "",
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

  const watchAmount = form.watch("amount");
  const watchFloat = form.watch("floatAmount");
  const totalAmount = (Number(watchAmount) || 0) + (Number(watchFloat) || 0);
  const targetVault = targetBranch?.activeVault ?? targetBranch?.vaults?.[0];

  const onSubmit = async (data: AllocationFormValues) => {
    if (!sourceVault) {
      toast.error("SACCO Reserve not found");
      return;
    }

    if (!targetVault) {
      toast.error("Branch Reserve not initialized");
      return;
    }

    if (totalAmount > sourceVault.balance) {
      toast.error("Insufficient Funds", {
        description: `SACCO Reserve only has ${formatCurrency(sourceVault.balance)}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/reserve/allocate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(data.amount),
          floatAmount: Number(data.floatAmount),
          sourceVaultId: sourceVault.id,
          targetVaultId: targetVault.id,
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || "Failed to propose reserve allocation");
        return;
      }

      toast.success("Allocation Proposed", {
        description: `Proposed ${formatCurrency(totalAmount)} for ${targetBranch.name}`,
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Propose Reserve Allocation
          </DialogTitle>
          <DialogDescription>
            Propose moving funds from SACCO Reserve to {targetBranch?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 items-center gap-4 py-4">
          <Card className="col-span-2 bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-blue-600 uppercase mb-1">Source</p>
              <p className="font-bold truncate">SACCO Reserve</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bal: {sourceVault ? formatCurrency(sourceVault.balance) : "N/A"}
              </p>
            </CardContent>
          </Card>
          
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <Card className="col-span-2 bg-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-emerald-600 uppercase mb-1">Destination</p>
              <p className="font-bold truncate">{targetBranch?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Res: {targetVault ? formatCurrency(targetVault.balance) : "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter cash amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="floatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Float Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter float amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Reason for allocation, bank references, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Total Proposed Investment:</span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-600 mt-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5" />
                  <p>
                    This is a proposal. Funds will only be deducted from SACCO Reserve
                    once the Branch Accountant confirms receiving the physical cash.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || totalAmount <= 0}>
                {isSubmitting ? "Submitting..." : "Propose Allocation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
