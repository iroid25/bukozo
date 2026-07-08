"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { AccountSearchCombobox } from "./account-search-combobox";

// Local HoldReason enum (matches Prisma schema)
enum HoldReason {
  GUARANTOR_DEFAULT = "GUARANTOR_DEFAULT",
  FRAUD_INVESTIGATION = "FRAUD_INVESTIGATION",
  LEGAL_DISPUTE = "LEGAL_DISPUTE",
  ACCOUNT_REVIEW = "ACCOUNT_REVIEW",
  MANUAL_HOLD = "MANUAL_HOLD",
  OTHER = "OTHER",
}

const formSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  reason: z.nativeEnum(HoldReason),
  reasonText: z.string().optional(),
  notes: z.string().optional(),
});

interface HoldAccountDialogProps {
  userId: string; // Current user ID
  defaultAccountId?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function HoldAccountDialog({
  userId,
  defaultAccountId,
  trigger,
  onSuccess,
}: HoldAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: defaultAccountId || "",
      reason: HoldReason.MANUAL_HOLD,
      reasonText: "",
      notes: "",
    },
  });



  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: values.accountId,
          reason: values.reason,
          reasonText: values.reasonText,
          notes: values.notes,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to place hold");
        return;
      }

      toast.success("Account hold placed successfully");
      setOpen(false);
      form.reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="destructive">Place Hold</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Place Account Hold</DialogTitle>
          <DialogDescription>
            Freeze an account to prevent withdrawals.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {!defaultAccountId && (
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Account</FormLabel>
                    <FormControl>
                      <AccountSearchCombobox
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Search by account, name, or phone..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.keys(HoldReason).map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reasonText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Which loan defaulted?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="Additional context for loan officers..." 
                        className="resize-none" 
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Hold
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
