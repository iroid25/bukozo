"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const currentAssetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  assetName: z.string().min(2, "Asset name is required"),
  branchId: z.string().min(1, "Branch is required"),
  assetDate: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  officerName: z.string().min(2, "Officer name is required"),
  notes: z.string().optional(),
});

type CurrentAssetFormValues = z.infer<typeof currentAssetSchema>;

interface CurrentAssetCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Branch = { id: string; name: string };

export function CurrentAssetCreateForm({
  isOpen,
  onClose,
  onSuccess,
}: CurrentAssetCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const form = useForm<CurrentAssetFormValues>({
    resolver: zodResolver(currentAssetSchema),
    defaultValues: {
      category: "",
      assetName: "",
      branchId: "",
      assetDate: new Date().toISOString().split("T")[0],
      amount: 0,
      invoiceNumber: "",
      officerName: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      try {
        setBranchLoading(true);
        const [branchesResponse, sessionResponse] = await Promise.all([
          fetch("/api/v1/branches", {
            cache: "no-store",
            credentials: "include",
          }),
          axios.get("/api/auth/session"),
        ]);

        const branchesPayload = await branchesResponse.json().catch(() => null);
        setBranches(Array.isArray(branchesPayload?.data) ? branchesPayload.data : []);
        const sessionUser = sessionResponse.data?.user;
        if (
          sessionUser?.role !== "ADMIN" &&
          sessionUser?.branchId &&
          !form.getValues("branchId")
        ) {
          form.setValue("branchId", sessionUser.branchId, {
            shouldValidate: true,
          });
        }
        if (sessionUser?.name) {
          form.setValue("officerName", sessionUser.name, {
            shouldValidate: true,
          });
        }
      } catch (error) {
        console.error("Failed to load current asset form data", error);
        toast.error("Failed to load current asset form data");
      } finally {
        setBranchLoading(false);
      }
    };

    void loadInitialData();
  }, [form, isOpen]);

  const onSubmit = async (values: CurrentAssetFormValues) => {
    try {
      setLoading(true);
      const response = await axios.post("/api/v1/current-assets", {
        ...values,
        amount: Number(values.amount),
      });

      if (response.status === 200 || response.status === 201) {
        toast.success("Current asset submitted for approval");
        form.reset({
          category: "",
          assetName: "",
          branchId: "",
          assetDate: new Date().toISOString().split("T")[0],
          amount: 0,
          invoiceNumber: "",
          officerName: form.getValues("officerName"),
          notes: "",
        });
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to create current asset", error);
      toast.error(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to create current asset",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Register Current Asset</DialogTitle>
          <DialogDescription>
            Register a bank account, cash at hand, mobile money, Wendi, advance,
            or other current asset. The request will go for approval before it
            is posted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Asset Type
            </p>
            <p className="text-sm font-semibold text-foreground">
              Current Asset
            </p>
          </div>
          <Badge variant="secondary">Current</Badge>
        </div>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Cash at hand, Bank account, Advance"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assetName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Wendi, Centenary Agency Account"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              branchLoading ? "Loading branches..." : "Select branch"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
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
                name="assetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice No</FormLabel>
                    <FormControl>
                      <Input placeholder="Invoice or receipt number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="officerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name of Officer</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of officer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="For example: money advanced to a member for 2 months"
                      className="min-h-[110px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Approval
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
