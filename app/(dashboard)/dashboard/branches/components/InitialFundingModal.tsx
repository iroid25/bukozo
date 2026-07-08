"use client";

import { useState, useEffect } from "react";
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
  Zap
} from "lucide-react";

const fundingSchema = z.object({
  amount: z.string().min(1, "Cash amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  floatAmount: z.string().min(1, "Float amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  notes: z.string().optional(),
});

type FundingFormValues = z.infer<typeof fundingSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  branch: {
    id: string;
    name: string;
    vaults?: any[];
  } | null;
  redirectOnSuccess?: boolean;
  maxAllocatableAmount?: number;
}

export default function InitialFundingModal({
  isOpen,
  onClose,
  branch,
  redirectOnSuccess = true,
  maxAllocatableAmount,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourceVault, setSourceVault] = useState<any>(null);

  const form = useForm<FundingFormValues>({
    resolver: zodResolver(fundingSchema),
    defaultValues: {
      amount: "0",
      floatAmount: "0",
      notes: "Initial Branch Funding",
    },
  });

  useEffect(() => {
    async function loadOrgReserve() {
      try {
        const response = await fetch("/api/v1/reserve");
        if (response.ok) {
          const result = await response.json();
          setSourceVault(result.data);
        }
      } catch (error) {
        console.error("Failed to load reserve:", error);
      }
    }
    if (isOpen) {
      loadOrgReserve();
    }
  }, [isOpen]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const watchAmount = form.watch("amount");
  const watchFloat = form.watch("floatAmount");
  // Total funding is now just the cash amount (float is part of cash or valid from cash)
  const totalAmount = Number(watchAmount) || 0; 
  const targetVault = branch?.vaults?.[0];

  const onSubmit = async (data: FundingFormValues) => {
    if (!sourceVault) {
      toast.error("Organisational Reserve not found");
      return;
    }

    // Check against passed Max Allocatable Amount (from prop) or Source Vault Balance
    const maxAmount = maxAllocatableAmount !== undefined ? maxAllocatableAmount : sourceVault.balance;

    if (totalAmount > maxAmount) {
      toast.error("Insufficient Funds", {
        description: `Cannot allocate more than Sacco Reserve Balance (${formatCurrency(maxAmount)})`,
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
            targetVaultId: targetVault?.id,
            branchId: branch?.id,
            notes: data.notes,
          }),
        });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to allocate funds");
        return;
      }

      toast.success("Branch Funded Successfully", {
        description: `${branch?.name} received ${formatCurrency(totalAmount)} reserve.`,
      });

      form.reset();
      onClose();
      router.refresh();
      
      if (redirectOnSuccess && branch?.id) {
          router.push(`/dashboard/branches/${branch.id}`);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-2 border-blue-500 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-blue-800">
            <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
            Allocate Branch Reserve & Float
          </DialogTitle>
          <DialogDescription className="text-lg">
            Allocate cash and operational float to <strong>{branch?.name}</strong>.
            Funds will be deducted from the Organisational Reserve and transferred instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 items-center gap-4 py-6">
          <Card className="col-span-2 bg-slate-50 border-dashed border-2">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Source</p>
              <p className="font-bold text-blue-900 truncate">Org. Reserve</p>
              <p className="text-sm font-semibold text-blue-600 mt-1">
                {sourceVault ? formatCurrency(sourceVault.balance) : "Loading..."}
              </p>
            </CardContent>
          </Card>
          
          <div className="flex justify-center">
            <ArrowRight className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>

          <Card className="col-span-2 bg-emerald-50 border-emerald-200 border-2 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Destination</p>
              <p className="font-bold text-emerald-900 truncate">{branch?.name}</p>
              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold mt-1">
                NEW BRANCH
              </span>
            </CardContent>
          </Card>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-blue-900 font-bold">Cash Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 10000000" 
                        {...field} 
                        className="h-12 text-lg font-semibold border-blue-200 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormDescription>Physical cash to allocate to branch reserve</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="floatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-blue-900 font-bold">Float Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 5000000" 
                        {...field} 
                        className="h-12 text-lg font-semibold border-blue-200 focus:border-blue-500"
                      />
                    </FormControl>
                  <FormDescription>Operational float for branch transactions</FormDescription>
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
                  <FormLabel className="text-blue-900 font-bold">Funding Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any additional details about this initial funding..." 
                      {...field} 
                      className="border-blue-200"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-900 text-white p-6 rounded-xl shadow-inner">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Total Funding Amount</p>
                  <p className="text-3xl font-black">{formatCurrency(totalAmount)}</p>
                </div>
                <Zap className="h-12 w-12 text-amber-400 opacity-50" />
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Important:</strong> This is a direct real-time transfer. The Cash Amount will be immediately deducted from the Organisational Reserve balance and added to {branch?.name}'s reserve. If the branch reserve does not exist yet, it will be created automatically.
              </p>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="text-slate-500 hover:text-slate-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || totalAmount <= 0}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg"
              >
                {isSubmitting ? "Processing..." : "Allocate Funds"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
