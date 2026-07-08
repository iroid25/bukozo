"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface Account {
  id: string;
  accountNumber: string;
  memberName: string;
  memberPhone: string;
  accountType: string;
  balance: number;
}

interface AccountSearchComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function AccountSearchCombobox({
  value,
  onValueChange,
  placeholder = "Search account...",
}: AccountSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Debounced search function
  const searchAccounts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/accounts/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      if (data.data) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error("Failed to search accounts:", error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchAccounts]);

  // Find selected account when value changes
  useEffect(() => {
    if (value && accounts.length > 0) {
      const account = accounts.find((acc) => acc.id === value);
      if (account) {
        setSelectedAccount(account);
      }
    }
  }, [value, accounts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedAccount ? (
            <span className="truncate">
              {selectedAccount.accountNumber} - {selectedAccount.memberName}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search by account, name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>
          <CommandList>
            <CommandEmpty>
              {searchQuery.length < 2
                ? "Type at least 2 characters to search..."
                : "No accounts found."}
            </CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={() => {
                    onValueChange(account.id);
                    setSelectedAccount(account);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{account.accountNumber}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{account.memberName}</span>
                      {account.memberPhone && (
                        <>
                          <span>•</span>
                          <span>{account.memberPhone}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{account.accountType}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
