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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import { Loader2, Search, Layers, ChevronRight } from "lucide-react";

const equitySchema = z.object({
  accountName: z.string().min(3, "Account name must be at least 3 characters"),
  description: z.string().optional(),
  parentId: z.string().min(1, "Category is required"),
});

interface EquityAccountCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParentAccount {
  id: string;
  accountCode: string;
  accountName: string;
}

export function EquityAccountCreateForm({ isOpen, onClose, onSuccess }: EquityAccountCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const [parentAccounts, setParentAccounts] = useState<ParentAccount[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  const [parentSearchOpen, setParentSearchOpen] = useState(false);

  const form = useForm<z.infer<typeof equitySchema>>({
    resolver: zodResolver(equitySchema),
    defaultValues: {
      accountName: "",
      description: "",
      parentId: "",
    },
  });

  const selectedParent = parentAccounts.find((acc) => acc.id === form.watch("parentId"));

  useEffect(() => {
    if (isOpen) {
      loadParentAccounts();
    }
  }, [isOpen]);

  const loadParentAccounts = async () => {
    try {
      setLoadingParents(true);
      // Fetch level 1 accounts for Equity (usually starts with 3)
      const response = await axios.get('/api/v1/accounts/equity?level=1');
      if (response.data && response.data.data) {
        setParentAccounts(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load categories", error);
      toast.error("Failed to load equity categories");
    } finally {
      setLoadingParents(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof equitySchema>) => {
    try {
      setLoading(true);
      
      const response = await axios.post('/api/v1/accounts/equity/create', values);

      if (response.status === 200 || response.status === 201) {
        toast.success("Equity account created successfully");
        form.reset();
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.error || "Failed to create equity account";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Equity Account</DialogTitle>
          <DialogDescription>
            Create a new equity category or sub-account in the Chart of Accounts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Parent Category</FormLabel>
                  <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={parentSearchOpen}
                          className="w-full justify-between h-10 px-3 text-left font-normal"
                        >
                          {selectedParent ? (
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-sm">
                                {selectedParent.accountCode} - {selectedParent.accountName}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Search className="h-4 w-4" />
                              <span>{loadingParents ? "Loading..." : "Select parent category..."}</span>
                            </div>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search parent categories..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No categories found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-y-auto">
                            {parentAccounts.map((account) => (
                              <CommandItem
                                key={account.id}
                                value={`${account.accountCode} ${account.accountName}`.toLowerCase()}
                                onSelect={() => {
                                  form.setValue("parentId", account.id);
                                  setParentSearchOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium">{account.accountCode} - {account.accountName}</span>
                                </div>
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

            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Share Capital - New Class" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Extra details about this account" {...field} />
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
                Create Account
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
