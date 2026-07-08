"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Search, Send, Loader2, ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const transferSchema = z.object({
  sourceAccountId: z.string().min(1, "Source account is required"),
  targetMemberNumber: z.string().min(1, "Target member number is required"),
  numberOfShares: z.coerce.number().min(1, "Must transfer at least 1 share"),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default function ShareTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shareAccounts, setShareAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      sourceAccountId: "",
      targetMemberNumber: "",
      numberOfShares: 1,
      notes: "",
    },
  });

  useEffect(() => {
    loadMyAccounts();
  }, []);

  const loadMyAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/members/me");
      const json = await res.json();
      const member = json.data || json;
      if (member && member.accounts) {
        // Filter for Share Accounts
        const shares = member.accounts.filter(
          (acc: any) => acc.accountType.isShareAccount
        );
        setShareAccounts(shares);
        
        if (shares.length === 1) {
            form.setValue("sourceAccountId", shares[0].id);
            setSelectedAccount(shares[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load accounts", error);
      toast.error("Failed to load your share accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = (value: string) => {
    form.setValue("sourceAccountId", value);
    const account = shareAccounts.find((acc) => acc.id === value);
    setSelectedAccount(account);
  };

  const onSubmit = async (values: TransferFormValues) => {
    if (!selectedAccount) {
        toast.error("Please select a source account");
        return;
    }

    if (values.numberOfShares > (selectedAccount.sharesCount || 0)) {
        toast.error("Insufficient shares for transfer");
        return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/shares/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        toast.success("Shares transferred successfully");
        form.reset();
        loadMyAccounts();
      } else {
        toast.error(result.error || "Failed to transfer shares");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (shareAccounts.length === 0) {
      return (
          <div className="max-w-2xl mx-auto p-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Transfer Shares</CardTitle>
                      <CardDescription>Move shares to another member</CardDescription>
                  </CardHeader>
                  <CardContent className="py-8 text-center text-muted-foreground">
                      You do not have any active Share Accounts to transfer from.
                  </CardContent>
              </Card>
          </div>
      )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
             <ArrowRight className="h-4 w-4 rotate-180" /> Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Transfer Shares
          </CardTitle>
          <CardDescription>
            Transfer ownership of shares to another member. This action is irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="sourceAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Account (From)</FormLabel>
                    <Select onValueChange={handleSourceChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Share Account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shareAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountNumber} - {account.accountType.name} ({account.sharesCount || 0} Shares)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAccount && (
                         <div className="text-xs text-muted-foreground mt-1 bg-gray-50 p-2 rounded border">
                            Available: <span className="font-medium text-gray-900">{selectedAccount.sharesCount || 0} Shares</span>
                            {selectedAccount.accountType.sharePrice && (
                                <span className="ml-1 text-gray-500">
                                    (Value: {formatCurrency((selectedAccount.sharesCount || 0) * selectedAccount.accountType.sharePrice)})
                                </span>
                            )}
                         </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="targetMemberNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Target Member Number (To)</FormLabel>
                        <FormControl>
                        <div className="relative">
                            <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. M10023" className="pl-9" {...field} />
                        </div>
                        </FormControl>
                        <FormDescription>
                            Enter the member number of the recipient.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="numberOfShares"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Number of Shares</FormLabel>
                        <FormControl>
                        <Input type="number" min="1" {...field} />
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
                      <Textarea 
                        placeholder="Reason for transfer..." 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3 text-xs text-yellow-800 flex gap-2">
                 <span>⚠️</span>
                 <p>
                    Please verify the member number carefully. Share transfers transfer ownership 
                    and value immediately.
                 </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Transfer...
                    </>
                ) : (
                    <>
                        Transfer Shares
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
