"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeftRight, Check, ChevronsUpDown, Loader2, Banknote } from "lucide-react";
import { AdvanceRequestDialog } from "./AdvanceRequestDialog";
import { AdvanceRepaymentDialog } from "./AdvanceRepaymentDialog";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ClassificationOption = {
  id: string;
  accountCode: string;
  accountName: string;
  level: number;
};

type Branch = { id: string; name: string };

const transferSchema = z
  .object({
    sourceAssetId: z.string().min(1, "Source asset is required"),
    targetAssetId: z.string().min(1, "Destination asset is required"),
    branchId: z.string().min(1, "Branch is required"),
    transferDate: z.string().min(1, "Transfer date is required"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    receiptNo: z.string().min(1, "Receipt / invoice is required"),
    officerName: z.string().min(2, "Officer name is required"),
    notes: z.string().optional(),
  })
  .refine((values) => values.sourceAssetId !== values.targetAssetId, {
    path: ["targetAssetId"],
    message: "Source and destination assets must be different.",
  });

type TransferFormValues = z.infer<typeof transferSchema>;

interface CurrentAssetTransferFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  embedded?: boolean;
}

const today = () => new Date().toISOString().split("T")[0];

export function CurrentAssetTransferForm({
  isOpen,
  onClose,
  onSuccess,
  embedded = false,
}: CurrentAssetTransferFormProps) {
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [classifications, setClassifications] = useState<ClassificationOption[]>([]);
  const [classificationsLoading, setClassificationsLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [repaymentDialogOpen, setRepaymentDialogOpen] = useState(false);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    mode: "onChange",
    defaultValues: {
      sourceAssetId: "",
      targetAssetId: "",
      branchId: "",
      transferDate: today(),
      amount: 0,
      receiptNo: "",
      officerName: "",
      notes: "",
    },
  });

  const watchedBranchId = form.watch("branchId");
  const watchedSourceAssetId = form.watch("sourceAssetId");
  const watchedTargetAssetId = form.watch("targetAssetId");

  const selectedSourceAsset = useMemo(
    () => classifications.find((c) => c.id === watchedSourceAssetId) || null,
    [classifications, watchedSourceAssetId],
  );


  const selectedTargetAsset = useMemo(
    () => classifications.find((c) => c.id === watchedTargetAssetId) || null,
    [classifications, watchedTargetAssetId],
  );

  const sourceAssetOptions = useMemo(
    () => classifications.filter((c) => c.id !== watchedTargetAssetId),
    [classifications, watchedTargetAssetId],
  );

  const targetAssetOptions = useMemo(
    () => classifications.filter((c) => c.id !== watchedSourceAssetId),
    [classifications, watchedSourceAssetId],
  );

  const filteredSourceAssetOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sourceAssetOptions;
    return sourceAssetOptions.filter((c) =>
      `${c.accountCode} ${c.accountName}`.toLowerCase().includes(query),
    );
  }, [searchQuery, sourceAssetOptions]);

  const filteredTargetAssetOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return targetAssetOptions;
    return targetAssetOptions.filter((c) =>
      `${c.accountCode} ${c.accountName}`.toLowerCase().includes(query),
    );
  }, [searchQuery, targetAssetOptions]);

  const loadClassifications = async () => {
    try {
      setClassificationsLoading(true);
      const response = await axios.get("/api/v1/accounts/assets", {
        params: { page: 1, limit: 500, isActive: true },
      });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      const filtered = data.filter((item: ClassificationOption) =>
        item.accountCode.startsWith("102") && item.accountCode !== "102004",
      );
      setClassifications(filtered);
    } catch (error) {
      console.error("Failed to load current asset classifications", error);
      toast.error("Failed to load current asset classifications");
      setClassifications([]);
    } finally {
      setClassificationsLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setDataLoading(true);
      setBranchLoading(true);

      const [branchesData, sessionResponse] = await Promise.all([
        fetch("/api/v1/branches", {
          cache: "no-store",
          credentials: "include",
        }).then((response) => response.json()),
        axios.get("/api/auth/session"),
      ]);

      setBranches(Array.isArray(branchesData?.data) ? branchesData.data : []);

      const sessionUser = sessionResponse.data?.user;
      const nextRole = sessionUser?.role || "";
      setCurrentUserRole(nextRole);

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

      await loadClassifications();
    } catch (error) {
      console.error("Failed to load transfer form data", error);
      toast.error("Failed to load transfer form data");
    } finally {
      setBranchLoading(false);
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setSearchQuery("");
    setSourceOpen(false);
    setTargetOpen(false);

    form.reset({
      sourceAssetId: "",
      targetAssetId: "",
      branchId: "",
      transferDate: today(),
      amount: 0,
      receiptNo: "",
      officerName: form.getValues("officerName") || "",
      notes: "",
    });

    void loadInitialData();
  }, [form, isOpen]);

  const onSubmit = async (values: TransferFormValues) => {
    try {
      setLoading(true);
      const response = await axios.post(
        "/api/v1/current-asset-transfers",
        values,
      );
      if (response.status === 200 || response.status === 201) {
        toast.success("Sent to Branch Manager for approval");
        form.reset({
          sourceAssetId: "",
          targetAssetId: "",
          branchId: "",
          transferDate: today(),
          amount: 0,
          receiptNo: "",
          officerName: form.getValues("officerName"),
          notes: "",
        });
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to create transfer", error);
      toast.error(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to create transfer",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAssetPick = (
    assetId: string,
    type: "source" | "target",
    setOpen: (open: boolean) => void,
  ) => {
    form.setValue(
      type === "source" ? "sourceAssetId" : "targetAssetId",
      assetId,
      { shouldValidate: true },
    );
    setOpen(false);
    setSearchQuery("");
  };

  const sourcePlaceholder = classificationsLoading
    ? "Loading classifications..."
    : "Select source asset";
  const targetPlaceholder = classificationsLoading
    ? "Loading classifications..."
    : "Select target asset";

  const assetPicker = (
    type: "source" | "target",
    label: string,
    selectedAsset: ClassificationOption | null,
    open: boolean,
    setOpen: (open: boolean) => void,
  ) => (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setSearchQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="h-12 w-full justify-between rounded-xl border-muted/70 bg-white px-4 shadow-sm"
          >
            <span className="truncate text-left">
              {selectedAsset
                ? `${selectedAsset.accountCode} - ${selectedAsset.accountName}`
                : type === "source"
                  ? sourcePlaceholder
                  : targetPlaceholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,520px)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={`Search ${type === "source" ? "source" : "destination"} asset...`}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-72 overflow-y-auto">
              <CommandEmpty>
                {classificationsLoading
                  ? "Loading classifications..."
                  : "No current asset classifications found."}
              </CommandEmpty>
              <CommandGroup>
                {(type === "source"
                  ? filteredSourceAssetOptions
                  : filteredTargetAssetOptions
                ).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.accountCode} ${item.accountName}`}
                    onSelect={() => handleAssetPick(item.id, type, setOpen)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedAsset?.id === item.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {item.accountCode} - {item.accountName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Current Assets Classification
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormItem>
  );

  const body = (
    <Form {...form}>
      <form className="flex h-full min-h-0 flex-1 flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        {!embedded && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Transfer Current Asset
            </DialogTitle>
            <DialogDescription>
              Move value between approved current assets using a cleaner,
              searchable workflow.
            </DialogDescription>
          </DialogHeader>
        )}

        <div className="shrink-0 rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                Current Transfer
              </p>
              <h3 className="mt-1 text-2xl font-black">
                Move balances with confidence
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Choose real current assets from the system, confirm the
                receiving account, and submit the transfer for approval before
                posting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/10 text-white hover:bg-white/15">
                {classifications.length} Current Asset Classifications
              </Badge>
              <Badge className="bg-white/10 text-white hover:bg-white/15">
                {branches.length} Branches
              </Badge>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue
                            placeholder={
                              branchLoading
                                ? "Loading branches..."
                                : "Select branch"
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
                name="transferDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-3xl border-muted/60 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Source
                      </p>
                      <h4 className="text-lg font-bold">
                        Current asset to transfer
                      </h4>
                    </div>
                    {selectedSourceAsset ? (
                      <Badge variant="secondary">Selected</Badge>
                    ) : null}
                  </div>
                  {assetPicker(
                    "source",
                    "Current Asset to Transfer",
                    selectedSourceAsset,
                    sourceOpen,
                    setSourceOpen,
                  )}
                  {selectedSourceAsset ? (
                    <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          Account Code
                        </p>
                        <p className="mt-1 font-semibold">
                          {selectedSourceAsset.accountCode}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          Classification
                        </p>
                        <p className="mt-1 font-semibold">
                          {selectedSourceAsset.accountName}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-muted/60 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Destination
                      </p>
                      <h4 className="text-lg font-bold">Transfer to</h4>
                    </div>
                    {selectedTargetAsset ? (
                      <Badge variant="secondary">Selected</Badge>
                    ) : null}
                  </div>
                  {assetPicker(
                    "target",
                    "Transfer To",
                    selectedTargetAsset,
                    targetOpen,
                    setTargetOpen,
                  )}
                  {selectedTargetAsset ? (
                    <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          Account Code
                        </p>
                        <p className="mt-1 font-semibold">
                          {selectedTargetAsset.accountCode}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          Classification
                        </p>
                        <p className="mt-1 font-semibold">
                          {selectedTargetAsset.accountName}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {selectedSourceAsset?.accountCode === "102005" && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 px-5 py-3">
                <Banknote className="h-5 w-5 shrink-0 text-amber-600" />
                <span className="text-sm text-amber-800 flex-1">
                  102005 — Advances: Quick actions
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdvanceDialogOpen(true)}
                >
                  Initiate Advance Request
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRepaymentDialogOpen(true)}
                >
                  Record Repayment
                </Button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receiptNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt / Invoice</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Receipt or invoice number"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="officerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name of Officer</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Name of officer handling the money"
                      className="h-12 rounded-xl"
                      {...field}
                    />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional transfer notes"
                      className="min-h-[120px] rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || dataLoading || !form.formState.isValid}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  const dialogs = (
    <>
      <AdvanceRequestDialog
        isOpen={advanceDialogOpen}
        onClose={() => setAdvanceDialogOpen(false)}
        branchId={form.watch("branchId") || undefined}
        onSuccess={() => setAdvanceDialogOpen(false)}
      />
      <AdvanceRepaymentDialog
        isOpen={repaymentDialogOpen}
        onClose={() => setRepaymentDialogOpen(false)}
        onSuccess={() => setRepaymentDialogOpen(false)}
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {body}
        {dialogs}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="flex h-[92vh] max-w-4xl flex-col overflow-hidden p-8">
          {body}
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}
