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
import { Check, ChevronsUpDown, Loader2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

const equitySchema = z.object({
  equityName: z.string().min(3, "Equity name must be at least 3 characters"),
  classificationCode: z.string().min(1, "Classification is required"),
  branchId: z.string().min(1, "Branch is required"),
  
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
  date: z.string(),
  
  receiptNo: z.string().min(1, "Receipt/Transaction Number is required"),
  description: z.string().optional(),
  counterpartyAccountCode: z.string().min(1, "Debit Account is required"),
});

interface EquityCreateFormProps {
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
  description?: string | null;
}

export function EquityCreateForm({ isOpen, onClose, onSuccess }: EquityCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [counterpartyAccounts, setCounterpartyAccounts] = useState<Classification[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [openCounterpartyCombobox, setOpenCounterpartyCombobox] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentCode, setNewCategoryParentCode] = useState("300000");

  const form = useForm<z.infer<typeof equitySchema>>({
    resolver: zodResolver(equitySchema),
    defaultValues: {
      equityName: "",
      classificationCode: "",
      branchId: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      receiptNo: "",
      description: "",
      counterpartyAccountCode: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      loadClassifications();
      setNewCategoryParentCode("300000");
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
        const brRes = await fetch("/api/v1/branches");
        const brJson = await brRes.json();
        setBranches(brJson.data || []);

        const response = await axios.get('/api/v1/accounts/payment');
        setCounterpartyAccounts(response.data);
    } catch (error) {
        console.error("Failed to load initial data", error);
        toast.error("Failed to load initial data");
    }
  };

  const loadClassifications = async () => {
      try {
          // Equity type classifications
          const response = await axios.get(`/api/v1/accounts/classifications?type=EQUITY`);
          const data = Array.isArray(response.data) ? response.data : [];
          setClassifications(
            data.filter((item: Classification) => {
              const description = (item.description || "").toLowerCase();
              if (item.accountCode === "300000") return false;
              if (description.startsWith("equity entry under [")) return false;
              return item.level <= 2;
            }),
          );
      } catch (error) {
          console.error("Failed to load classifications", error);
          toast.error("Failed to load classifications");
      }
  };

  const onSubmit = async (values: z.infer<typeof equitySchema>) => {
    try {
      setLoading(true);
      
      const payload = {
        ...values,
        initialBalance: values.amount,
        recordDate: new Date(values.date),
      };

      const response = await axios.post('/api/v1/equity', payload);

      if (response.status === 200 || response.status === 201) {
        toast.success("Equity entry created successfully");
        form.reset();
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.error || "Failed to create equity entry";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    const categoryName = newCategoryName.trim();
    if (!categoryName) {
      toast.error("Category name is required");
      return;
    }

    try {
      setCategoryLoading(true);
      const response = await axios.post("/api/v1/equity", {
        createCategory: true,
        categoryName,
        parentClassificationCode: newCategoryParentCode || "300000",
      });

      const createdCategory = response.data?.data;
      await loadClassifications();

      if (createdCategory?.accountCode) {
        form.setValue("classificationCode", createdCategory.accountCode);
      }

      setIsAddCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryParentCode("300000");
      toast.success("Equity category created successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.details || error.response?.data?.error || "Failed to create category");
    } finally {
      setCategoryLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Landmark className="h-5 w-5" />
            Add New Equity Entry
          </DialogTitle>
          <DialogDescription>
            Register a new Equity item (Capital, Reserve, etc.). This will create a specific ledger account in the COA.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Classification */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Classification</h3>
                  <FormField
                      control={form.control}
                      name="classificationCode"
                      render={({ field }) => (
                      <FormItem className="flex flex-col">
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel>Equity Category</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewCategoryParentCode(field.value || "300000");
                                setIsAddCategoryOpen(true);
                              }}
                            >
                              + Add Category
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
                                              : "Select equity category..."}
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
                                                          item.level === 2 ? "font-bold" : "pl-4 text-sm"
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
                          <p className="text-[0.8rem] text-muted-foreground mt-1 italic">
                            Choose the parent category where this equity item should be created.
                            If it is missing, create the category first.
                          </p>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              </div>
              
              {/* Basic Info */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Basic Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="equityName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Equity Item Name</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g. Share Capital - Institutional" {...field} />
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

              {/* Financial Info */}
              <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Financial Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Investment / Initial Amount (UGX)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Entry</FormLabel>
                            <FormControl>
                            <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="receiptNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt / Transaction ID *</FormLabel>
                          <FormControl>
                            <Input placeholder="TXN-EQU-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                        control={form.control}
                        name="counterpartyAccountCode"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Debit Account (Source of funds)</FormLabel>
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
                                                : "Select account..."}
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
                    <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Equity Entry
                    </Button>
                </div>

            </form>
          </Form>
         </div>
      </DialogContent>

      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Equity Category</DialogTitle>
            <DialogDescription>
              Create a new equity parent category, then use it to add detail items underneath.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Category Name</FormLabel>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Special Purpose Funds"
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Parent Category</FormLabel>
              <Select value={newCategoryParentCode} onValueChange={setNewCategoryParentCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300000">300000 - Equity</SelectItem>
                  {classifications.map((item) => (
                    <SelectItem key={item.id} value={item.accountCode}>
                      {item.accountCode} - {item.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCategoryOpen(false)}
                disabled={categoryLoading}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateCategory} disabled={categoryLoading}>
                {categoryLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
