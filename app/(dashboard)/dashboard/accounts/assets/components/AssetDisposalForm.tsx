"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ASSET_PARENT_OPTIONS,
  getClassificationHierarchyLabel,
  sortClassificationOptions,
  type AssetClassificationOption,
} from "./asset-classification-utils";

const disposalSchema = z
  .object({
    disposalMethod: z.enum(["SALE", "DONATION", "WRITE_OFF"]),
    disposalDate: z.string().min(1, "Disposal date is required"),
    disposalAmount: z.coerce
      .number()
      .min(0, "Amount cannot be negative")
      .default(0),
    disposalNotes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.disposalMethod === "SALE" && values.disposalAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disposalAmount"],
        message: "Sale disposals require a disposal amount greater than zero.",
      });
    }
  });

type DisposalFormValues = z.infer<typeof disposalSchema>;

type AssetKind = "FIXED" | "CURRENT";

type Branch = { id: string; name: string };

export interface AssetDisposalTarget {
  id: string;
  assetCode: string;
  assetName: string;
  status: string;
  assetType?: string;
  category?: string | null;
  approvalStatus?: string;
  receiptNo?: string | null;
  accountId?: string | null;
  currentValue?: number | null;
  purchasePrice?: number | null;
  disposalDate?: string | null;
  disposalMethod?: string | null;
  disposalAmount?: number | null;
  branch?: {
    id: string;
    name: string;
  } | null;
}

type AssetOption = AssetDisposalTarget & {
  assetType: AssetKind;
};

interface AssetDisposalFormProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDisposalTarget | null;
  onSuccess?: () => void;
  embedded?: boolean;
}

const today = () => new Date().toISOString().split("T")[0];

export function AssetDisposalForm({
  isOpen,
  onClose,
  asset,
  onSuccess,
  embedded = false,
}: AssetDisposalFormProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUserName, setCurrentUserName] = useState("");
  const [fixedAssets, setFixedAssets] = useState<AssetOption[]>([]);
  const [currentAssets, setCurrentAssets] = useState<AssetOption[]>([]);
  const [assetType, setAssetType] = useState<AssetKind>("FIXED");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [classificationOptions, setClassificationOptions] = useState<
    AssetClassificationOption[]
  >([]);

  const form = useForm<DisposalFormValues>({
    resolver: zodResolver(disposalSchema),
    defaultValues: {
      disposalMethod: "WRITE_OFF",
      disposalDate: today(),
      disposalAmount: 0,
      disposalNotes: "",
    },
  });

  const normalizedFixedAssets = useMemo(
    () =>
      fixedAssets.map((item) => ({
        ...item,
        assetType: "FIXED" as const,
      })),
    [fixedAssets],
  );

  const normalizedCurrentAssets = useMemo(
    () =>
      currentAssets.map((item) => ({
        ...item,
        assetType: "CURRENT" as const,
      })),
    [currentAssets],
  );

  const allAssets = useMemo(
    () => [...normalizedFixedAssets, ...normalizedCurrentAssets],
    [normalizedCurrentAssets, normalizedFixedAssets],
  );

  const selectedAsset = useMemo(
    () => allAssets.find((item) => item.id === selectedAssetId) || null,
    [allAssets, selectedAssetId],
  );

  const defaultAmount = useMemo(() => {
    if (!selectedAsset || selectedAsset.assetType !== "FIXED") return 0;
    return Number(selectedAsset.currentValue ?? selectedAsset.purchasePrice ?? 0);
  }, [selectedAsset]);

  const orderedClassificationOptions = useMemo(() => {
    const options =
      classificationOptions.length > 0
        ? classificationOptions
        : DEFAULT_ASSET_PARENT_OPTIONS.FIXED;
    return sortClassificationOptions(options);
  }, [classificationOptions]);

  const selectedClassification = useMemo(() => {
    const category = selectedAsset?.category?.trim().toLowerCase();
    if (!category) return null;

    return (
      orderedClassificationOptions.find(
        (item) => item.accountName.trim().toLowerCase() === category,
      ) || null
    );
  }, [orderedClassificationOptions, selectedAsset?.category]);

  const loadData = async () => {
    try {
      setInitialLoading(true);
      const [branchesResponse, sessionResponse, fixedResponse, currentResponse] =
        await Promise.all([
          fetch("/api/v1/branches", {
            cache: "no-store",
            credentials: "include",
          }),
          axios.get("/api/auth/session"),
          axios.get("/api/v1/assets", {
            params: {
              assetType: "FIXED",
            },
          }),
          axios.get("/api/v1/current-assets"),
        ]);

      const branchesPayload = await branchesResponse.json().catch(() => null);
      setBranches(Array.isArray(branchesPayload?.data) ? branchesPayload.data : []);

      const fixedRows = Array.isArray(fixedResponse.data?.data)
        ? fixedResponse.data.data
        : [];
      const currentRows = Array.isArray(currentResponse.data?.data)
        ? currentResponse.data.data
        : [];

      setFixedAssets(
        fixedRows.filter((item: AssetDisposalTarget) =>
          item.assetType ? item.assetType === "FIXED" : true,
        ),
      );
      setCurrentAssets(
        currentRows.filter(
          (item: AssetDisposalTarget) =>
            (item.assetType ? item.assetType === "CURRENT" : true),
        ),
      );

      const classificationResponse = await axios.get("/api/v1/accounts/assets", {
        params: {
          page: 1,
          limit: 500,
          isActive: true,
        },
      });

      const accountRows = Array.isArray(classificationResponse.data?.data)
        ? classificationResponse.data.data
        : [];
      setClassificationOptions(
        accountRows.filter((item: AssetClassificationOption) =>
          item.accountCode.startsWith("101"),
        ),
      );
      setCurrentUserName(sessionResponse.data?.user?.name || "");

      const preselected = asset?.id
        ? [...fixedRows, ...currentRows].find(
            (item: AssetDisposalTarget) => item.id === asset.id,
          )
        : null;

      if (preselected) {
        setAssetType(
          preselected.assetType === "CURRENT" ? "CURRENT" : "FIXED",
        );
        setSelectedAssetId(preselected.id);
      } else {
        setAssetType("FIXED");
        setSelectedAssetId("");
      }
    } catch (error) {
      console.error("Failed to load disposal form data", error);
      toast.error("Failed to load disposal form data");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setSearchQuery("");
    setPickerOpen(false);
    setSelectedAssetId("");
    setAssetType("FIXED");
    form.reset({
      disposalMethod: "WRITE_OFF",
      disposalDate: today(),
      disposalAmount: 0,
      disposalNotes: "",
    });

    void loadData();
  }, [asset?.id, form, isOpen]);

  useEffect(() => {
    if (!selectedAsset || selectedAsset.assetType !== "FIXED") return;

    form.reset({
      disposalMethod: "WRITE_OFF",
      disposalDate: today(),
      disposalAmount: defaultAmount,
      disposalNotes: "",
    });
  }, [defaultAmount, form, selectedAsset]);

  const disposalMethod = form.watch("disposalMethod");

  useEffect(() => {
    if (!isOpen || !selectedAsset || selectedAsset.assetType !== "FIXED") return;

    if (disposalMethod === "SALE") {
      if (Number(form.getValues("disposalAmount") || 0) <= 0) {
        form.setValue("disposalAmount", defaultAmount || 0, {
          shouldValidate: true,
        });
      }
      return;
    }

    form.setValue("disposalAmount", 0, { shouldValidate: true });
  }, [defaultAmount, disposalMethod, form, isOpen, selectedAsset]);

  const visibleAssets = useMemo(() => {
    const list = assetType === "FIXED" ? normalizedFixedAssets : normalizedCurrentAssets;
    const query = searchQuery.trim().toLowerCase();

    if (!query) return list;

    return list.filter((item) => {
      const haystack = [
        item.assetCode,
        item.assetName,
        item.category || "",
        item.branch?.name || "",
        item.receiptNo || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [assetType, normalizedCurrentAssets, normalizedFixedAssets, searchQuery]);

  const isCurrentAssetSelected = selectedAsset?.assetType === "CURRENT";
  const submitDisabled =
    loading || !selectedAsset || isCurrentAssetSelected || initialLoading;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const selectedAssetAmount = selectedAsset
    ? Number(selectedAsset.currentValue ?? selectedAsset.purchasePrice ?? 0)
    : 0;

  const onSubmit = async (values: DisposalFormValues) => {
    if (!selectedAsset) {
      toast.error("Please select a fixed asset first.");
      return;
    }

    if (selectedAsset.assetType !== "FIXED") {
      toast.error("Current assets are listed for reference only in this form.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`/api/v1/fixed-assets/${selectedAsset.id}/dispose`, {
        disposalMethod: values.disposalMethod,
        disposalAmount: values.disposalAmount,
        disposalDate: values.disposalDate,
        disposalNotes: values.disposalNotes,
      });

      toast.success("Sent to Branch Manager for approval");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.details ||
        error?.message ||
        "Failed to dispose asset";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetPick = (id: string) => {
    const picked = allAssets.find((item) => item.id === id) || null;
    setSelectedAssetId(id);
    setPickerOpen(false);

    if (!picked) return;

    setAssetType(picked.assetType);

    if (picked.assetType === "FIXED") {
      form.setValue("disposalMethod", "WRITE_OFF", { shouldValidate: true });
      form.setValue("disposalDate", today(), { shouldValidate: true });
      form.setValue("disposalAmount", Number(picked.currentValue ?? picked.purchasePrice ?? 0), {
        shouldValidate: true,
      });
      form.setValue("disposalNotes", "", { shouldValidate: false });
    } else {
      form.setValue("disposalAmount", 0, { shouldValidate: true });
    }
  };

  const pickerLabel =
    assetType === "FIXED"
      ? "Search approved fixed assets"
      : "Search approved current assets";

  const body = (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        {!embedded && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Trash2 className="h-5 w-5 text-destructive" />
              Record Disposal
            </DialogTitle>
            <DialogDescription>
              Pick a real asset from the system, review its details, and submit
              the disposal request for approval.
            </DialogDescription>
          </DialogHeader>
        )}

        {initialLoading ? (
          <div className="flex items-center justify-center rounded-2xl border bg-muted/20 py-12">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading assets...
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[58vh] pr-3">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Asset Browser
                    </p>
                    <h3 className="mt-1 text-xl font-black">Choose disposal target</h3>
                    <p className="text-sm text-white/70">
                      Load and inspect approved fixed assets or current assets
                      without leaving the dialog.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-white/10 text-white hover:bg-white/15">
                      {fixedAssets.length} Fixed
                    </Badge>
                    <Badge className="bg-white/10 text-white hover:bg-white/15">
                      {currentAssets.length} Current
                    </Badge>
                    <Badge className="bg-white/10 text-white hover:bg-white/15">
                      {branches.length} Branches
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/60">
                  Prepared by {currentUserName || "current user"}.
                </p>
              </div>

              <Tabs
                value={assetType}
                onValueChange={(value) => {
                  setAssetType(value as AssetKind);
                  setSearchQuery("");
                  setPickerOpen(false);
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="FIXED">Fixed Assets</TabsTrigger>
                  <TabsTrigger value="CURRENT">Current Assets</TabsTrigger>
                </TabsList>

                <TabsContent value="FIXED" className="mt-4 space-y-4">
                  <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <FormLabel className="mb-2 block">Select Fixed Asset</FormLabel>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          <span className="truncate text-left">
                            {selectedAsset && selectedAsset.assetType === "FIXED"
                              ? `${selectedAsset.assetCode} - ${selectedAsset.assetName}`
                              : "Choose a fixed asset"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(92vw,520px)] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder={pickerLabel}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No fixed assets found.</CommandEmpty>
                            <CommandGroup>
                              {visibleAssets.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.assetCode} ${item.assetName} ${item.category || ""} ${item.branch?.name || ""}`}
                                  onSelect={() => handleAssetPick(item.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedAssetId === item.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">
                                      {item.assetCode} - {item.assetName}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                      {item.branch?.name || "No branch"} ·{" "}
                                      {item.category || "Uncategorized"}
                                    </span>
                                  </div>
                                  <span className="ml-3 text-xs text-muted-foreground">
                                    {formatCurrency(Number(item.currentValue ?? item.purchasePrice ?? 0))}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fixed assets are loaded from the live assets endpoint so the
                      list stays in sync with the ledger.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="CURRENT" className="mt-4 space-y-4">
                  <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <FormLabel className="mb-2 block">Select Current Asset</FormLabel>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          <span className="truncate text-left">
                            {selectedAsset && selectedAsset.assetType === "CURRENT"
                              ? `${selectedAsset.assetCode} - ${selectedAsset.assetName}`
                              : "Choose a current asset"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(92vw,520px)] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder={pickerLabel}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No current assets found.</CommandEmpty>
                            <CommandGroup>
                              {visibleAssets.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.assetCode} ${item.assetName} ${item.category || ""} ${item.branch?.name || ""}`}
                                  onSelect={() => handleAssetPick(item.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedAssetId === item.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">
                                      {item.assetCode} - {item.assetName}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                      {item.branch?.name || "No branch"} ·{" "}
                                      {item.category || "Uncategorized"}
                                    </span>
                                  </div>
                                  <span className="ml-3 text-xs text-muted-foreground">
                                    {formatCurrency(Number(item.currentValue ?? item.purchasePrice ?? 0))}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current assets are loaded from the same live source used in
                      the assets ledger. They are listed for visibility only.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {selectedAsset ? (
                <div className="rounded-2xl border bg-muted/20 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Selected Asset
                      </p>
                      <h4 className="mt-1 text-2xl font-black">
                        {selectedAsset.assetName}
                      </h4>
                      <p className="font-mono text-sm text-muted-foreground">
                        {selectedAsset.assetCode}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {selectedAsset.assetType === "FIXED"
                          ? "Fixed Asset"
                          : "Current Asset"}
                      </Badge>
                      <Badge variant="outline">
                        {selectedAsset.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border bg-background p-3">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Branch
                      </p>
                      <p className="mt-1 font-semibold">
                        {selectedAsset.branch?.name || "No branch"}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background p-3">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Classification
                      </p>
                      <p className="mt-1 font-semibold">
                        {selectedClassification
                          ? getClassificationHierarchyLabel(selectedClassification)
                          : selectedAsset.category || "Unclassified"}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background p-3">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Value
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatCurrency(selectedAssetAmount)}
                      </p>
                    </div>
                  </div>

                  {selectedAsset.assetType === "CURRENT" && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Current assets are visible here for reference, but disposal
                      posting is only enabled for fixed assets in this flow.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  Select an asset to see its details and disposal options.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Disposal Details
                    </p>
                    <h4 className="mt-1 text-xl font-black">Approval request</h4>
                  </div>
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>

                <div className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="disposalMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Method</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={field.value}
                            onChange={field.onChange}
                          >
                            <option value="WRITE_OFF">Write Off</option>
                            <option value="DONATION">Donation</option>
                            <option value="SALE">Sale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="disposalDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="disposalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {disposalMethod === "SALE"
                              ? "Sale Amount"
                              : "Disposal Amount"}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {disposalMethod === "SALE"
                              ? "Enter the amount received from the sale."
                              : "Leave as zero if there was no cash received."}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="disposalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Optional disposal notes"
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {!selectedAsset || selectedAsset.assetType !== "FIXED" ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  Confirm is disabled until a fixed asset is selected.
                </div>
              ) : null}
            </div>
          </div>
          </ScrollArea>
        )}

        {!initialLoading && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitDisabled}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Disposal
            </Button>
          </DialogFooter>
        )}
      </form>
    </Form>
  );

  if (embedded) {
    return body;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden">
        {body}
      </DialogContent>
    </Dialog>
  );
}
