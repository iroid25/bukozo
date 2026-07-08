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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const liabilitySchema = z.object({
  liabilityName: z.string().min(3, "Liability name must be at least 3 characters"),
  liabilityType: z.enum(["LIABILITY_CURRENT", "LIABILITY_NON_CURRENT"]),
  classificationCode: z.string().min(1, "Classification is required"),
  branchId: z.string().min(1, "Branch is required"),
  
  principalAmount: z.coerce.number().min(0, "Amount cannot be negative"),
  dateIncurred: z.string(),
  
  creditor: z.string().optional(),
  referenceNumber: z.string().optional(),
  receiptNo: z.string().min(1, "Receipt/Transaction Number is required"),
  
  interestRate: z.coerce.number().min(0).max(100).optional().default(0),
  termMonths: z.coerce.number().min(0).optional().default(0),
  maturityValue: z.coerce.number().min(0).optional().default(0),
  
  description: z.string().optional(),
  counterpartyAccountCode: z.string().min(1, "Debit Account is required"),
});

interface LiabilityCreateFormProps {
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

export function LiabilityCreateForm({ isOpen, onClose, onSuccess }: LiabilityCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [counterpartyAccounts, setCounterpartyAccounts] = useState<Classification[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [openCounterpartyCombobox, setOpenCounterpartyCombobox] = useState(false);
  const [isClassificationDialogOpen, setIsClassificationDialogOpen] = useState(false);
  const [newClassificationName, setNewClassificationName] = useState("");
  const [creatingClassification, setCreatingClassification] = useState(false);

  const form = useForm<z.infer<typeof liabilitySchema>>({
    resolver: zodResolver(liabilitySchema),
    defaultValues: {
      liabilityName: "",
      liabilityType: "LIABILITY_CURRENT",
      classificationCode: "",
      branchId: "",
      
      principalAmount: 0,
      dateIncurred: new Date().toISOString().split("T")[0],
      
      creditor: "",
      referenceNumber: "",
      receiptNo: "",
      
      interestRate: 0,
      termMonths: 0,
      maturityValue: 0,
      
      description: "",
      counterpartyAccountCode: "",
    },
  });

  const liabilityType = form.watch("liabilityType");

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadClassifications();
      form.setValue("classificationCode", "");
    }
  }, [liabilityType, isOpen]);

  const loadInitialData = async () => {
    try {
        const [branchesResponse, paymentResponse] = await Promise.all([
          axios.get('/api/v1/branches'),
          axios.get('/api/v1/accounts/payment'),
        ]);
        setBranches(branchesResponse.data?.data || []);

        setCounterpartyAccounts(paymentResponse.data);
    } catch (error) {
        console.error("Failed to load initial data", error);
        toast.error("Failed to load initial data");
    }
  };

  const loadClassifications = async () => {
      try {
          const response = await axios.get(`/api/v1/accounts/classifications?type=${liabilityType}`);
          let data = response.data;
          setClassifications(data);
      } catch (error) {
          console.error("Failed to load classifications", error);
          toast.error("Failed to load classifications");
      }
  };

  const createClassification = async () => {
    const classificationName = newClassificationName.trim();
    if (!classificationName) {
      toast.error("Classification name is required");
      return;
    }

    try {
      setCreatingClassification(true);
      const parentClassificationCode =
        liabilityType === "LIABILITY_NON_CURRENT" ? "202000" : "201000";

      const response = await axios.post("/api/v1/accounts/classifications", {
        type: liabilityType,
        classificationName,
        parentClassificationCode,
      });

      const created = response.data?.data;
      await loadClassifications();
      if (created?.accountCode) {
        form.setValue("classificationCode", created.accountCode);
      }
      setNewClassificationName("");
      setIsClassificationDialogOpen(false);
      toast.success("Classification created successfully");
    } catch (error: any) {
      console.error("Failed to create classification", error);
      toast.error(error.response?.data?.error || "Failed to create classification");
    } finally {
      setCreatingClassification(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof liabilitySchema>) => {
    try {
      setLoading(true);
      
      // We map the UI names to the backend names since the backend uses `initialBalance`
      const payload = {
        ...values,
        initialBalance: values.principalAmount,
        dateIncurred: new Date(values.dateIncurred),
      };

      const response = await axios.post('/api/v1/liabilities', payload);

      if (response.status === 200 || response.status === 201) {
        toast.success("Liability created successfully");
        form.reset();
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.error || "Failed to create liability";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Add New Liability</DialogTitle>
          <DialogDescription>
            Register a new Liability. This will automatically create the corresponding Chart of Accounts entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Liability Classification */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Liability Classification</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="liabilityType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Liability Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Liability Type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="LIABILITY_CURRENT">Current Liability</SelectItem>
                                <SelectItem value="LIABILITY_NON_CURRENT">Non-Current Liability</SelectItem>
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
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setIsClassificationDialogOpen(true)}
                              >
                                + Add Classification
                              </Button>
                            </div>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value
                                                ? classifications.find(
                                                    (c) => c.accountCode === field.value
                                                )?.accountName + ` (${field.value})`
                                                : "Select classification..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search classification..." />
                                        <CommandList>
                                            <CommandEmpty>No classification found.</CommandEmpty>
                                            <CommandGroup>
                                                {classifications.map((item) => (
                                                    <CommandItem
                                                        value={`${item.accountCode} ${item.accountName}`}
                                                        key={item.id}
                                                        onSelect={() => {
                                                            form.setValue("classificationCode", item.accountCode);
                                                            setOpenCombobox(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                item.accountCode === field.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        <span className={cn(
                                                            item.level === 2 ? "font-bold" : item.level === 3 ? "font-semibold pl-2" : "pl-6 text-sm"
                                                        )}>
                                                            {item.accountCode} - {item.accountName}
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
                                    <p className="font-semibold text-muted-foreground mb-1">Hierarchy Preview:</p>
                                    <div className="flex flex-col space-y-1 text-xs font-medium">
                                        <span className="text-gray-500">200000 LIABILITIES</span>
                                        <span className="text-gray-600 pl-4 border-l ml-1 border-gray-300">
                                            ↳ {field.value.startsWith("201") ? "201000 CURRENT LIABILITIES" : "202000 NON-CURRENT LIABILITIES"}
                                        </span>
                                        <span className="text-gray-700 pl-4 border-l ml-5 border-gray-300">↳ {field.value} {classifications.find(c => c.accountCode === field.value)?.accountName}</span>
                                        {form.watch("liabilityName") && (
                                            <span className="text-primary pl-4 border-l ml-9 border-gray-400">↳ {field.value.slice(0, 4)}XX {form.watch("liabilityName").toUpperCase()}</span>
                                        )}
                                    </div>
                                    <p className="text-[0.7rem] text-muted-foreground mt-2 italic">A specific sub-account will be generated automatically upon creation.</p>
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
              </div>
              
              {/* Accounting Information */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Accounting & Deposit</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                        control={form.control}
                        name="counterpartyAccountCode"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Debit Account (Bank / Cash / Asset received)</FormLabel>
                            <Popover open={openCounterpartyCombobox} onOpenChange={setOpenCounterpartyCombobox}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value
                                                ? counterpartyAccounts.find(
                                                    (c) => c.accountCode === field.value
                                                )?.accountName + ` (${field.value})`
                                                : "Select counterparty account..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search account..." />
                                        <CommandList>
                                            <CommandEmpty>No account found.</CommandEmpty>
                                            <CommandGroup>
                                                {counterpartyAccounts.map((item) => (
                                                    <CommandItem
                                                        value={`${item.accountCode} ${item.accountName}`}
                                                        key={item.id}
                                                        onSelect={() => {
                                                            form.setValue("counterpartyAccountCode", item.accountCode);
                                                            setOpenCounterpartyCombobox(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                item.accountCode === field.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        <span>
                                                            {item.accountCode} - {item.accountName}
                                                        </span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <p className="text-[0.8rem] text-muted-foreground mt-1 italic">
                                Select the bank or cash account where the liability funds were received or retained.
                            </p>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Basic Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="liabilityName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Liability Name</FormLabel>
                            <FormControl>
                            <Input placeholder={liabilityType === "LIABILITY_NON_CURRENT" ? "e.g. Bank Loan 2026" : "e.g. Fixed Deposit - John"} {...field} />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              </div>

              {/* Incurrence Details */}
              <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Incurrence / Financial Information</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="principalAmount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Principal / Initial Amount (UGX)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="dateIncurred"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date Incurred / Opened</FormLabel>
                            <FormControl>
                            <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                      control={form.control}
                      name="creditor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Creditor / Counterparty</FormLabel>
                          <FormControl>
                            <Input placeholder="Lender / Depositor Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="referenceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference / Contract Number</FormLabel>
                          <FormControl>
                            <Input placeholder="REF-001" {...field} />
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
                          <FormLabel>Transaction / Receipt ID *</FormLabel>
                          <FormControl>
                            <Input placeholder="TXN-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </div>

               {/* Interest & Maturity */}
               <div className="space-y-4">
                   <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Interest & Term Details</h3>
                   <div className="grid grid-cols-3 gap-4">
                     <FormField
                         control={form.control}
                         name="interestRate"
                         render={({ field }) => (
                         <FormItem>
                             <FormLabel>Interest Rate (%)</FormLabel>
                             <FormControl>
                             <Input type="number" step="0.1" {...field} />
                             </FormControl>
                             <FormMessage />
                         </FormItem>
                         )}
                     />
                     <FormField
                         control={form.control}
                         name="termMonths"
                         render={({ field }) => (
                         <FormItem>
                             <FormLabel>Term (Months)</FormLabel>
                             <FormControl>
                             <Input type="number" {...field} />
                             </FormControl>
                             <FormMessage />
                         </FormItem>
                         )}
                     />
                      <FormField
                         control={form.control}
                         name="maturityValue"
                         render={({ field }) => (
                         <FormItem>
                             <FormLabel>Maturity Value</FormLabel>
                             <FormControl>
                             <Input type="number" {...field} />
                             </FormControl>
                             <FormMessage />
                         </FormItem>
                         )}
                     />
                 </div>
               </div>
            
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

                <div className="pt-4 flex justify-end gap-2">
                     <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Liability
                    </Button>
                </div>

            </form>
          </Form>
         </div>
      </DialogContent>

      <Dialog open={isClassificationDialogOpen} onOpenChange={setIsClassificationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Liability Classification</DialogTitle>
            <DialogDescription>
              Add a new classification under {liabilityType === "LIABILITY_NON_CURRENT" ? "Non-current liabilities" : "Current liabilities"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Classification Name</label>
              <Input
                value={newClassificationName}
                onChange={(event) => setNewClassificationName(event.target.value)}
                placeholder={
                  liabilityType === "LIABILITY_NON_CURRENT"
                    ? "e.g. Bank Loan"
                    : "e.g. Fixed Deposit"
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClassificationDialogOpen(false)}
                disabled={creatingClassification}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={createClassification}
                disabled={creatingClassification}
              >
                {creatingClassification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Classification"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
