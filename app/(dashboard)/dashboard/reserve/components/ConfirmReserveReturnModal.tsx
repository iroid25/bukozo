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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle2, 
  ArrowRight, 
  Building2, 
  AlertTriangle,
  Info
} from "lucide-react";
const confirmReturnSchema = z.object({
  notes: z.string().optional(),
});

type ConfirmReturnFormValues = z.infer<typeof confirmReturnSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allocation: any; // This is actually the return record
}

export default function ConfirmReserveReturnModal({
  isOpen,
  onClose,
  allocation,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ConfirmReturnFormValues>({
    resolver: zodResolver(confirmReturnSchema),
    defaultValues: {
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

  const amount = allocation?.amount || 0;
  const floatAmount = allocation?.floatAmount || 0;
  const total = amount + floatAmount;
  const branchName = allocation?.sourceVault?.branch?.name || "Branch";

  const onSubmit = async (data: ConfirmReturnFormValues) => {
    if (!allocation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/reserve/return/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allocationId: allocation.id,
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || "Failed to confirm reserve return");
        return;
      }

      toast.success("Return Confirmed", {
        description: `Successfully confirmed receipt of ${formatCurrency(total)} from ${branchName}`,
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
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Confirm Reserve Return
          </DialogTitle>
          <DialogDescription>
            Confirm that you have physically received the cash returned by {branchName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 items-center gap-4 py-4">
          <Card className="col-span-2 bg-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-emerald-600 uppercase mb-1">From</p>
              <p className="font-bold truncate">{branchName}</p>
              <p className="text-xs text-muted-foreground mt-1">Branch Reserve</p>
            </CardContent>
          </Card>
          
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <Card className="col-span-2 bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-blue-600 uppercase mb-1">To</p>
              <p className="font-bold truncate">SACCO Reserve</p>
              <p className="text-xs text-muted-foreground mt-1">HQ Central Vault</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="bg-gray-50 border-blue-100">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-500 mb-1">Cash Returned</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(amount)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-purple-100">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-500 mb-1">Float Returned</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(floatAmount)}</p>
            </CardContent>
          </Card>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Confirm condition of notes, any discrepancies noted, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Financial Impact:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>SACCO Reserve balance will increase by {formatCurrency(total)}.</li>
                  <li>Branch Reserve balance will decrease by {formatCurrency(total)}.</li>
                  <li>This action completes the fund return workflow.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating balances..." : "Confirm & Complete Return"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
