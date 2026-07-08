"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

interface ActiveAdvance {
  id: string;
  requestCode: string;
  staffName: string;
  amount: number;
  outstandingBalance: number;
  monthlyDeduction: number;
  repaymentStartMonth: string;
  installments: number;
  reason: string;
}

interface AdvanceRepaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  medical: "Medical",
  school_fees: "School Fees",
  rent: "Rent",
  personal: "Personal",
  other: "Other",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export function AdvanceRepaymentDialog({
  isOpen,
  onClose,
  onSuccess,
}: AdvanceRepaymentDialogProps) {
  const [advances, setAdvances] = useState<ActiveAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");

  const selectedAdvance = useMemo(
    () => advances.find((a) => a.id === selectedAdvanceId) || null,
    [advances, selectedAdvanceId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAdvanceId("");
    setAmount("");
    setNotes("");
    void loadActiveAdvances();
  }, [isOpen]);

  // Pre-fill amount with monthly deduction when advance is selected
  useEffect(() => {
    if (selectedAdvance) {
      setAmount(String(selectedAdvance.monthlyDeduction));
    }
  }, [selectedAdvance]);

  const loadActiveAdvances = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/v1/staff-advances", {
        params: { status: "ACTIVE" },
      });
      const rows: ActiveAdvance[] = Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setAdvances(rows.filter((a) => Number(a.outstandingBalance) > 0));
    } catch {
      toast.error("Failed to load active advances");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAdvance) {
      toast.error("Select the staff member whose advance is being repaid");
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid repayment amount");
      return;
    }
    if (numAmount > Number(selectedAdvance.outstandingBalance)) {
      toast.error(
        `Amount exceeds outstanding balance of ${fmt(selectedAdvance.outstandingBalance)}`,
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(
        `/api/v1/staff-advances/${selectedAdvance.id}/repayment`,
        { amount: numAmount, notes },
      );
      const msg = res.data?.data?.message || "Repayment recorded successfully";
      toast.success(msg);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to record repayment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const outstanding = selectedAdvance
    ? Number(selectedAdvance.outstandingBalance)
    : 0;
  const numAmount = Number(amount) || 0;
  const remainingAfter =
    selectedAdvance ? Math.max(0, outstanding - numAmount) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Record Advance Repayment
          </DialogTitle>
          <DialogDescription>
            Select the staff member paying back their advance. A GL entry
            (Dr 102001-Cash at Hand / Cr 102005-Advances) will be posted
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Advance picker */}
          <div className="space-y-2">
            <Label>Staff Member / Advance</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="h-11 w-full justify-between"
                  disabled={loading}
                >
                  <span className="truncate text-left">
                    {loading
                      ? "Loading active advances..."
                      : selectedAdvance
                        ? `${selectedAdvance.staffName} — ${selectedAdvance.requestCode}`
                        : advances.length === 0
                          ? "No active advances found"
                          : "Select staff member..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(90vw,460px)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or advance code..." />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>No active advances found.</CommandEmpty>
                    <CommandGroup>
                      {advances.map((adv) => (
                        <CommandItem
                          key={adv.id}
                          value={`${adv.staffName} ${adv.requestCode}`}
                          onSelect={() => {
                            setSelectedAdvanceId(adv.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedAdvanceId === adv.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium truncate">
                              {adv.staffName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {adv.requestCode} ·{" "}
                              {REASON_LABELS[adv.reason] ?? adv.reason} ·
                              Outstanding: {fmt(adv.outstandingBalance)}
                            </span>
                          </div>
                          <span className="ml-3 shrink-0 text-xs font-semibold text-blue-700">
                            {fmt(adv.monthlyDeduction)}/mo
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected advance summary */}
          {selectedAdvance && (
            <div className="rounded-lg border bg-blue-50 border-blue-200 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total advance</span>
                <span className="font-medium">{fmt(selectedAdvance.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding balance</span>
                <span className="font-semibold text-red-600">
                  {fmt(selectedAdvance.outstandingBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly deduction</span>
                <span className="font-medium">{fmt(selectedAdvance.monthlyDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repayment starts</span>
                <span className="font-medium">{selectedAdvance.repaymentStartMonth}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <Label>Repayment Amount (UGX)</Label>
            <Input
              type="number"
              min="1"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount received"
            />
            {selectedAdvance && numAmount > 0 && remainingAfter !== null && (
              <p className="text-xs text-muted-foreground">
                Balance after payment:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    remainingAfter === 0 ? "text-green-600" : "text-slate-700",
                  )}
                >
                  {fmt(remainingAfter)}
                  {remainingAfter === 0 && " — Fully repaid!"}
                </span>
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="e.g. Cash received at teller window"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={submitting || !selectedAdvance || !amount}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Repayment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
