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
  CheckCircle2, 
  ArrowDownLeft, 
  DollarSign, 
  AlertTriangle,
  Info
} from "lucide-react";
const confirmSchema = z.object({
  physicalCashEntered: z.string().min(1, "Cash received is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  physicalFloatEntered: z.string().min(1, "Float received is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
  notes: z.string().optional(),
});

type ConfirmFormValues = z.infer<typeof confirmSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allocation: any;
}

export default function ConfirmReserveAllocationModal({
  isOpen,
  onClose,
  allocation,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      physicalCashEntered: "",
      physicalFloatEntered: "",
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

  const expectedCash = allocation?.amount || 0;
  const expectedFloat = allocation?.floatAmount || 0;
  const enteredCash = Number(form.watch("physicalCashEntered")) || 0;
  const enteredFloat = Number(form.watch("physicalFloatEntered")) || 0;
  
  const cashVariance = enteredCash - expectedCash;
  const floatVariance = enteredFloat - expectedFloat;

  const onSubmit = async (data: ConfirmFormValues) => {
    if (!allocation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/reserve/allocate/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allocationId: allocation.id,
          physicalCashEntered: Number(data.physicalCashEntered),
          physicalFloatEntered: Number(data.physicalFloatEntered),
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || "Failed to confirm reserve allocation");
        return;
      }

      toast.success("Reception Confirmed", {
        description: `Successfully confirmed receipt of ${formatCurrency(enteredCash + enteredFloat)}`,
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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Confirm Reserve Entry
          </DialogTitle>
          <DialogDescription>
            Verify and record physical receipt of funds from SACCO Reserve.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Expected Cash</p>
              <p className="text-xl font-bold">{formatCurrency(expectedCash)}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Expected Float</p>
              <p className="text-xl font-bold">{formatCurrency(expectedFloat)}</p>
            </CardContent>
          </Card>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="physicalCashEntered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physical Cash Received (UGX) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter actual cash" {...field} />
                    </FormControl>
                    <FormMessage />
                    {cashVariance !== 0 && enteredCash > 0 && (
                      <p className={`text-xs mt-1 ${cashVariance > 0 ? "text-blue-600" : "text-destructive"}`}>
                        Variance: {cashVariance > 0 ? "+" : ""}{formatCurrency(cashVariance)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="physicalFloatEntered"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physical Float Received (UGX) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter actual float" {...field} />
                    </FormControl>
                    <FormMessage />
                    {floatVariance !== 0 && enteredFloat > 0 && (
                      <p className={`text-xs mt-1 ${floatVariance > 0 ? "text-blue-600" : "text-destructive"}`}>
                        Variance: {floatVariance > 0 ? "+" : ""}{formatCurrency(floatVariance)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observations/Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Report any discrepancies or observations during counting." {...field} />
                  </FormControl>
                  <FormDescription>
                    {(cashVariance !== 0 || floatVariance !== 0) && (
                      <span className="text-amber-600 flex items-center gap-1 font-medium italic">
                        <AlertTriangle className="h-3 w-3" />
                        Please explain variances in notes.
                      </span>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-emerald-50 p-4 rounded-lg flex items-start gap-3">
              <Info className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">Workflow Sync:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Branch Reserve balance will increase by entered amount.</li>
                  <li>SACCO Reserve balance will be debited by original proposed amount.</li>
                  <li>Variances will be logged for administrative review.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting || enteredCash + enteredFloat <= 0}>
                {isSubmitting ? "Processing..." : "Confirm Reception"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
