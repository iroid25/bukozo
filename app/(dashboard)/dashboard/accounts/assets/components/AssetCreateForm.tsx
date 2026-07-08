"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import axios from "axios";
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
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ASSET_PARENT_OPTIONS,
  getClassificationHierarchyLabel,
  sortClassificationOptions,
  type AssetClassificationOption,
} from "./asset-classification-utils";

const assetSchema = z.object({
  assetName: z.string().min(3, "Asset name must be at least 3 characters"),
  assetType: z.enum(["FIXED", "CURRENT"]),
  classificationCode: z.string().min(1, "Classification is required"),
  category: z.string().optional(),
  purchasePrice: z.coerce.number().min(0, "Price cannot be negative"),
  purchaseDate: z.string(),
  depreciationRate: z.coerce
    .number()
    .min(0)
    .max(100, "Max 100%")
    .optional()
    .default(0),
  usefulLifeYears: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .optional()
    .default(0),
  description: z.string().optional(),
  branchId: z.string().min(1, "Branch is required"),
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  location: z.string().optional(),
  salvageValue: z.coerce.number().min(0).optional().default(0),
  quantity: z.coerce
    .number()
    .min(1, "Quantity must be at least 1")
    .optional()
    .default(1),
  receiptNo: z.string().min(1, "Receipt Number is required"),
  tellerUserId: z.string().optional(),
});

interface AssetCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Branch {
  id: string;
  name: string;
}

interface Classification {
  id: string;
  accountCode: string;
  accountName: string;
  level: number;
}

interface TellerOption {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  branch?: {
    id: string;
    name: string;
  } | null;
  floatStatus?: {
    exists: boolean;
    balance: number;
    isActiveForDay: boolean;
    canStartNewDay: boolean;
    pendingReconciliation: boolean;
  };
}

export function AssetCreateForm({
  isOpen,
  onClose,
  onSuccess,
}: AssetCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [tellers, setTellers] = useState<TellerOption[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [openTellerCombobox, setOpenTellerCombobox] = useState(false);
  const [isAddClassificationOpen, setIsAddClassificationOpen] = useState(false);
  const [newClassificationName, setNewClassificationName] = useState("");
  const [newClassificationParentCode, setNewClassificationParentCode] =
    useState("");
  const [classificationLoading, setClassificationLoading] = useState(false);

  const form = useForm<z.infer<typeof assetSchema>>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      assetName: "",
      assetType: "FIXED",
      classificationCode: "",
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
      depreciationRate: 20,
      usefulLifeYears: 5,
      description: "",
      branchId: "",
      salvageValue: 0,
      supplier: "",
      invoiceNumber: "",
      serialNumber: "",
      model: "",
      location: "",
      quantity: 1,
      receiptNo: "",
      tellerUserId: "",
    },
  });

  const assetType = form.watch("assetType");
  const selectedTellerUserId = form.watch("tellerUserId");
  const canChooseTellerFloat =
    currentUserRole === "ADMIN" || currentUserRole === "ACCOUNTANT";

  const getDefaultClassificationParentCode = () => {
    return assetType === "FIXED" ? "101000" : "102000";
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    form.setValue("classificationCode", "");

    if (assetType === "FIXED") {
      void loadClassifications();
      setNewClassificationParentCode(getDefaultClassificationParentCode());
      return;
    }

    void loadClassifications();
    setNewClassificationParentCode(getDefaultClassificationParentCode());
  }, [assetType, isOpen]);

  useEffect(() => {
    if (!canChooseTellerFloat || !selectedTellerUserId) return;

    const teller = tellers.find((item) => item.id === selectedTellerUserId);
    if (!teller?.branch?.id) return;

    if (form.getValues("branchId") !== teller.branch.id) {
      form.setValue("branchId", teller.branch.id, {
        shouldValidate: true,
      });
    }
  }, [canChooseTellerFloat, form, selectedTellerUserId, tellers]);

  const loadInitialData = async () => {
    try {
      const [branchesResponse, sessionResponse] = await Promise.all([
        fetch("/api/v1/branches", {
          cache: "no-store",
          credentials: "include",
        }),
        axios.get("/api/auth/session"),
      ]);

      const branchesPayload = await branchesResponse.json().catch(() => null);
      setBranches(Array.isArray(branchesPayload?.data) ? branchesPayload.data : []);
      const role = sessionResponse.data?.user?.role || "";
      setCurrentUserRole(role);

      if (role === "ADMIN" || role === "ACCOUNTANT") {
        const tellersResponse = await axios.get(
          "/api/v1/users?role=TELLER&isActive=true",
        );
        const tellerRows = Array.isArray(tellersResponse.data?.data)
          ? tellersResponse.data.data
          : [];

        const tellersWithFloat = await Promise.all(
          tellerRows.map(async (teller: TellerOption) => {
            try {
              const floatResponse = await axios.get(
                `/api/v1/floats/user/${teller.id}`,
              );
              const floatData = floatResponse.data || {};

              return {
                ...teller,
                floatStatus: {
                  exists: Boolean(floatData.exists),
                  balance: Number(floatData.balance || 0),
                  isActiveForDay: Boolean(floatData.isActiveForDay),
                  canStartNewDay: Boolean(floatData.canStartNewDay),
                  pendingReconciliation: Boolean(floatData.pendingReconciliation),
                },
              };
            } catch (error) {
              return {
                ...teller,
                floatStatus: {
                  exists: false,
                  balance: 0,
                  isActiveForDay: false,
                  canStartNewDay: false,
                  pendingReconciliation: false,
                },
              };
            }
          }),
        );

        setTellers(
          tellersWithFloat.filter(
            (teller) =>
              teller.floatStatus?.exists &&
              teller.floatStatus.isActiveForDay &&
              teller.floatStatus.balance > 0,
          ),
        );
      } else {
        setTellers([]);
        form.setValue("tellerUserId", "");
      }
    } catch (error) {
      console.error("Failed to load initial data", error);
      toast.error("Failed to load initial data");
    }
  };

  const loadClassifications = async () => {
    try {
      const response = await axios.get("/api/v1/accounts/assets", {
        params: {
          page: 1,
          limit: 500,
          isActive: true,
        },
      });

      const data = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      const filtered = data.filter((item: Classification) =>
        assetType === "FIXED"
          ? item.accountCode.startsWith("101")
          : item.accountCode.startsWith("102") && item.accountCode !== "102004",
      );

      setClassifications(filtered);
      setNewClassificationParentCode(
        (current) => current || getDefaultClassificationParentCode(),
      );
    } catch (error) {
      console.error("Failed to load classifications", error);
      toast.error("Failed to load classifications");
    }
  };

  const handleCreateClassification = async () => {
    const classificationName = newClassificationName.trim();
    if (!classificationName) {
      toast.error("Classification name is required");
      return;
    }

    try {
      setClassificationLoading(true);
      const response = await axios.post("/api/v1/accounts/classifications", {
        type: assetType,
        classificationName,
        parentClassificationCode:
          newClassificationParentCode || getDefaultClassificationParentCode(),
      });

      const createdClassification = response.data?.data;
      await loadClassifications();

      if (createdClassification?.accountCode) {
        form.setValue("classificationCode", createdClassification.accountCode, {
          shouldValidate: true,
        });
      }

      setIsAddClassificationOpen(false);
      setNewClassificationName("");
      setNewClassificationParentCode("");
      setOpenCombobox(false);
      toast.success("Asset classification created successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to create classification",
      );
    } finally {
      setClassificationLoading(false);
    }
  };

  const classificationOptions =
    classifications.length > 0
      ? classifications
      : DEFAULT_ASSET_PARENT_OPTIONS[assetType];

  const orderedClassificationOptions = sortClassificationOptions(
    classificationOptions,
  );

  // Auto-fill depreciation rate and useful life based on classification (parent category)
  const watchedCode = form.watch("classificationCode");
  useEffect(() => {
    const classification = classifications.find(
      (c) => c.accountCode === watchedCode,
    );
    if (!classification) return;

    const name = classification.accountName.toUpperCase();
    let rate = 12.5;
    let years = 8;

    if (name.includes("LAND")) {
      rate = 0;
      years = 0;
    } else if (name.includes("BUILDING")) {
      rate = 5;
      years = 20;
    } else if (name.includes("MOTOR") || name.includes("VEHICLE")) {
      rate = 25;
      years = 4;
    } else if (name.includes("FURNITURE")) {
      rate = 12.5;
      years = 8;
    }

    form.setValue("depreciationRate", rate, { shouldValidate: true });
    form.setValue("usefulLifeYears", years, { shouldValidate: true });
  }, [watchedCode, assetType, form, classifications]);

  const onSubmit = async (values: z.infer<typeof assetSchema>) => {
    try {
      setLoading(true);

      if (values.assetType === "FIXED" && !values.tellerUserId) {
        toast.error(
          "Fixed assets must be funded from a teller float. Select the teller source before creating this asset.",
        );
        return;
      }

      const selectedTeller = canChooseTellerFloat
        ? tellers.find((item) => item.id === values.tellerUserId)
        : null;
      const effectiveBranchId =
        selectedTeller?.branch?.id || values.branchId;

      if (values.assetType === "FIXED" && canChooseTellerFloat && selectedTeller?.branch?.id) {
        form.setValue("branchId", selectedTeller.branch.id, {
          shouldValidate: true,
        });
      }

      if (values.assetType === "CURRENT") {
        const selectedCategory = values.classificationCode
          ? orderedClassificationOptions.find(
              (item) => item.accountCode === values.classificationCode,
            )?.accountName
          : undefined;

        const response = await axios.post("/api/v1/current-assets", {
          assetName: values.assetName,
          category: selectedCategory || values.category || "Current Asset",
          branchId: effectiveBranchId,
          assetDate: values.purchaseDate,
          amount: values.purchasePrice,
          invoiceNumber: values.invoiceNumber || values.receiptNo || values.assetName,
          notes: values.description,
        });

        if (response.status === 200 || response.status === 201) {
          toast.success("Current asset submitted for approval");
          form.reset();
          onClose();
          if (onSuccess) onSuccess();
        }
        return;
      }

      const payload = {
        ...values,
        purchaseDate: new Date(values.purchaseDate),
        tellerUserId: values.tellerUserId || undefined,
        branchId: effectiveBranchId,
      };

      const response = await axios.post("/api/v1/assets", payload);

      if (response.status === 200 || response.status === 201) {
        toast.success("Asset created successfully");
        form.reset();
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.error || "Failed to create asset";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Add New Asset</DialogTitle>
          <DialogDescription>
            Register a new asset. This will automatically create the
            corresponding Chart of Accounts entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Asset Type Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                  Asset Classification
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Asset Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FIXED">Fixed Asset</SelectItem>
                            <SelectItem value="CURRENT">
                              Current Asset
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="classificationCode"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <div className="flex items-center justify-between gap-3">
                          <FormLabel>Category / Classification</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewClassificationParentCode(
                                field.value ||
                                  getDefaultClassificationParentCode(),
                              );
                              setNewClassificationName("");
                              setIsAddClassificationOpen(true);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Classification
                          </Button>
                        </div>
                        <Popover
                          open={openCombobox}
                          onOpenChange={setOpenCombobox}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value
                                  ? (() => {
                                      const selected = orderedClassificationOptions.find(
                                        (c) => c.accountCode === field.value,
                                      );
                                      return selected
                                        ? `${getClassificationHierarchyLabel(selected)} (${field.value})`
                                        : `Classification ${field.value}`;
                                    })()
                                  : "Select classification..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search classification..." />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="space-y-3 px-2 py-3 text-left">
                                    <p className="text-sm text-muted-foreground">
                                      No classifications found yet.
                                    </p>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="w-full justify-start"
                                      onClick={() => {
                                        setNewClassificationParentCode(
                                          getDefaultClassificationParentCode(),
                                        );
                                        setNewClassificationName("");
                                        setIsAddClassificationOpen(true);
                                        setOpenCombobox(false);
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Create classification
                                    </Button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {orderedClassificationOptions.map((item) => (
                                    <CommandItem
                                      value={`${item.accountCode} ${item.accountName}`}
                                      key={item.id}
                                      onSelect={() => {
                                        form.setValue(
                                          "classificationCode",
                                          item.accountCode,
                                        );
                                        setOpenCombobox(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.accountCode === field.value
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          item.level === 2
                                            ? "font-bold"
                                            : item.level === 3
                                              ? "font-semibold pl-2"
                                              : "pl-6 text-sm",
                                        )}
                                      >
                                        {item.accountCode} - {getClassificationHierarchyLabel(item)}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {field.value && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md border text-sm">
                            <p className="font-semibold text-muted-foreground mb-1">
                              Hierarchy Preview:
                            </p>
                            <div className="flex flex-col space-y-1 text-xs font-medium">
                              <span className="text-gray-500">
                                100000 ASSETS
                              </span>
                              <span className="text-gray-600 pl-4 border-l ml-1 border-gray-300">
                                ↳{" "}
                                {field.value.startsWith("101")
                                  ? "101000 FIXED ASSETS"
                                  : "102000 CURRENT ASSETS"}
                              </span>
                              <span className="text-gray-700 pl-4 border-l ml-5 border-gray-300">
                                ↳ {field.value}{" "}
                                {
                                  orderedClassificationOptions.find(
                                    (c) => c.accountCode === field.value,
                                  )?.accountName
                                }
                              </span>
                              {form.watch("assetName") && (
                                <span className="text-primary pl-4 border-l ml-9 border-gray-400">
                                  ↳ {field.value.slice(0, 4)}XX{" "}
                                  {form.watch("assetName").toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-[0.7rem] text-muted-foreground mt-2 italic">
                              A specific sub-account will be generated
                              automatically upon creation.
                            </p>
                          </div>
                        )}
                        {assetType === "CURRENT" && !field.value && (
                          <p className="text-[0.8rem] text-muted-foreground mt-1 italic">
                            Note: These are assets that can be converted into
                            cash within a year.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                  Basic Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assetName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              assetType === "FIXED"
                                ? "e.g. Office Laptop"
                                : "e.g. Petty Cash"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Branch" />
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
                        {canChooseTellerFloat &&
                          selectedTellerUserId &&
                          (() => {
                            const teller = tellers.find(
                              (item) => item.id === selectedTellerUserId,
                            );
                            if (!teller?.branch?.name) return null;

                            return (
                              <p className="text-[0.8rem] text-muted-foreground mt-1 italic">
                                Selected teller branch: {teller.branch.name}
                              </p>
                            );
                          })()}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Physical Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Room 304" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Purchase Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                  Purchase Information
                </h3>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Fixed assets must be posted against a teller float source. Only tellers with an active float for today appear in the selector.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {canChooseTellerFloat && (
                    <FormField
                      control={form.control}
                      name="tellerUserId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col col-span-2">
                          <FormLabel>Teller Float Source</FormLabel>
                          <Popover
                            open={openTellerCombobox}
                            onOpenChange={setOpenTellerCombobox}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value
                                    ? (() => {
                                        const teller = tellers.find(
                                          (item) => item.id === field.value,
                                        );
                                        if (!teller)
                                          return "Select teller float...";

                                        const tellerName =
                                          teller.name ||
                                          [teller.firstName, teller.lastName]
                                            .filter(Boolean)
                                            .join(" ");

                                        return teller.branch?.name
                                          ? `${tellerName} (${teller.branch.name})`
                                          : tellerName;
                                      })()
                                    : "Select teller float..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput placeholder="Search teller..." />
                                <CommandList>
                                  <CommandEmpty>No teller found.</CommandEmpty>
                                  <CommandGroup>
                                    {tellers.map((item) => {
                                      const tellerName =
                                        item.name ||
                                        [item.firstName, item.lastName]
                                          .filter(Boolean)
                                          .join(" ");

                                      return (
                                        <CommandItem
                                          value={`${tellerName} ${item.branch?.name || ""}`}
                                          key={item.id}
                                          onSelect={() => {
                                            form.setValue(
                                              "tellerUserId",
                                              item.id,
                                              {
                                                shouldValidate: true,
                                              },
                                            );
                                            if (item.branch?.id) {
                                              form.setValue(
                                                "branchId",
                                                item.branch.id,
                                                {
                                                  shouldValidate: true,
                                                },
                                              );
                                            }
                                            setOpenTellerCombobox(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              item.id === field.value
                                                ? "opacity-100"
                                                : "opacity-0",
                                            )}
                                          />
                                          <span>
                                            {tellerName}
                                            {item.branch?.name
                                              ? ` - ${item.branch.name}`
                                              : ""}
                                          </span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        <p className="text-[0.8rem] text-muted-foreground mt-1 italic">
                          Only tellers with an active float for today are shown here.
                          The selected teller&apos;s issued float will be used to fund this asset purchase.
                        </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price (UGX)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <FormControl>
                          <Input placeholder="Supplier Name" {...field} />
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
                        <FormLabel>Invoice Number</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-001" {...field} />
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
                        <FormLabel>Receipt Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="RCP-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity (Optional)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Identification & Depreciation (Fixed Assets Only) */}
              {assetType === "FIXED" && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                      Identification
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serial Number</FormLabel>
                            <FormControl>
                              <Input placeholder="S/N..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model</FormLabel>
                            <FormControl>
                              <Input placeholder="Model..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                      Depreciation Details
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="depreciationRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate (%)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="usefulLifeYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Useful Life (Yrs)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="salvageValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salvage Value</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Additional details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Footer outside of scroll if possible, or inside but at bottom */}
              <div className="pt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Asset
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <Dialog
          open={isAddClassificationOpen}
          onOpenChange={setIsAddClassificationOpen}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Create Asset Classification</DialogTitle>
              <DialogDescription>
                Create a new classification first, then use it to register the
                asset under it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Classification Name
                </label>
                <Input
                  value={newClassificationName}
                  onChange={(e) => setNewClassificationName(e.target.value)}
                  placeholder="e.g. Computers"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Parent Classification
                </label>
                <Select
                  value={
                    newClassificationParentCode ||
                    getDefaultClassificationParentCode()
                  }
                  onValueChange={setNewClassificationParentCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent classification" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedClassificationOptions.map((item) => (
                      <SelectItem
                        key={item.accountCode}
                        value={item.accountCode}
                      >
                        {item.accountCode} - {getClassificationHierarchyLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The new classification will be created under this asset
                  classification.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddClassificationOpen(false)}
                disabled={classificationLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateClassification}
                disabled={classificationLoading}
              >
                {classificationLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Classification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}




