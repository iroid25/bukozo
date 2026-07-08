"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertTriangle,
  Wallet,
  Users,
  Briefcase,
  UserCheck,
} from "lucide-react";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type AdvanceType = "STAFF" | "OFFICIAL" | "MEMBER";

const ADVANCE_TYPES: {
  value: AdvanceType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: "STAFF",
    label: "Staff Advance",
    description: "For SACCO employees (tellers, accountants, etc.)",
    icon: Briefcase,
    color: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "OFFICIAL",
    label: "Official Advance",
    description: "For executive / management members",
    icon: UserCheck,
    color: "border-purple-200 bg-purple-50 text-purple-700",
  },
  {
    value: "MEMBER",
    label: "Member Advance",
    description: "For registered SACCO members",
    icon: Users,
    color: "border-green-200 bg-green-50 text-green-700",
  },
];

type RecipientOption = {
  id: string;
  name: string;
  role?: string;
  memberNumber?: string;
  branchId?: string | null;
};

type FloatInfo = { balance: number; isActiveForDay: boolean };

// ─── Form schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  recipientId: z.string().min(1, "Recipient is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  reason: z.string().min(1, "Reason is required"),
  installments: z.coerce.number().int().min(1, "At least 1 installment"),
  repaymentStartMonth: z.string().min(1, "Repayment start month is required"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const currentYearMonth = () => new Date().toISOString().slice(0, 7);

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(n);

// ─── Component ───────────────────────────────────────────────────────────────

interface AdvanceRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  branchId?: string;
}

export function AdvanceRequestDialog({
  isOpen,
  onClose,
  onSuccess,
  branchId,
}: AdvanceRequestDialogProps) {
  const [advanceType, setAdvanceType] = useState<AdvanceType>("STAFF");
  const [loading, setLoading] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [floatInfo, setFloatInfo] = useState<FloatInfo | null>(null);
  const [sessionBranchId, setSessionBranchId] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipientId: "",
      amount: 0,
      reason: "",
      installments: 1,
      repaymentStartMonth: currentYearMonth(),
      notes: "",
    },
  });

  const watchedAmount = form.watch("amount");
  const watchedInstallments = form.watch("installments");
  const watchedRecipientId = form.watch("recipientId");

  const monthlyDeduction = useMemo(() => {
    const amt = Number(watchedAmount) || 0;
    const inst = Number(watchedInstallments) || 1;
    if (amt <= 0 || inst < 1) return 0;
    return Number((amt / inst).toFixed(2));
  }, [watchedAmount, watchedInstallments]);

  const selectedRecipient = useMemo(
    () => recipients.find((r) => r.id === watchedRecipientId) || null,
    [recipients, watchedRecipientId],
  );

  const insufficientFloat =
    floatInfo !== null &&
    Number(watchedAmount) > 0 &&
    Number(watchedAmount) > floatInfo.balance;

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setAdvanceType("STAFF");
    form.reset({
      recipientId: "",
      amount: 0,
      reason: "",
      installments: 1,
      repaymentStartMonth: currentYearMonth(),
      notes: "",
    });
    void loadSession();
  }, [isOpen]);

  // Reload recipients whenever type changes
  useEffect(() => {
    if (!isOpen) return;
    form.setValue("recipientId", "");
    void loadRecipients(advanceType);
  }, [advanceType, isOpen]);

  const loadSession = async () => {
    try {
      const [sessionRes, floatRes] = await Promise.all([
        axios.get("/api/auth/session"),
        axios.get("/api/v1/floats/me").catch(() => null),
      ]);
      const sessionUser = sessionRes.data?.user;
      setSessionBranchId(branchId || sessionUser?.branchId || null);
      setSessionRole(sessionUser?.role || "");

      const userFloat = floatRes?.data?.data?.userFloat;
      if (userFloat) {
        setFloatInfo({
          balance: Number(userFloat.balance || 0),
          isActiveForDay: Boolean(userFloat.isActiveForDay),
        });
      }
    } catch {
      // silent
    }
  };

  const loadRecipients = async (type: AdvanceType) => {
    try {
      setRecipientsLoading(true);
      // sessionRole is ADMIN | BRANCHMANAGER | ACCOUNTANT | TELLER etc.
      // The server already scopes non-admin user queries to their own branch.
      // For admin, pass branchId explicitly only if the dialog was opened with one.
      const isAdmin = sessionRole === "ADMIN";

      if (type === "MEMBER") {
        // Members API auto-scopes to the caller's branch for non-admin.
        // For admin, pass branchId prop if provided.
        const res = await axios.get("/api/v1/members", {
          params: {
            isActive: true,
            ...(isAdmin && sessionBranchId ? { branchId: sessionBranchId } : {}),
          },
        });
        const members = Array.isArray(res.data?.data) ? res.data.data : [];
        setRecipients(
          members.map((m: any) => ({
            id: m.userId || m.id,
            name: m.user?.name || m.name || "Unknown",
            memberNumber: m.memberNumber,
            branchId: m.branchId || m.user?.branchId || null,
            role: "MEMBER",
          })),
        );
      } else {
        // Users API auto-scopes to the caller's branch for non-admin.
        // For admin, pass branchId prop if provided.
        const res = await axios.get("/api/v1/users", {
          params: {
            isActive: true,
            ...(isAdmin && sessionBranchId ? { branchId: sessionBranchId } : {}),
          },
        });
        const allUsers: any[] = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        const officialRoles = ["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "LOANOFFICER", "AUDITOR"];

        // Filter by role category. Branch scoping is already done server-side.
        const filtered = allUsers.filter((u: any) => {
          if (u.role === "MEMBER") return false;
          if (type === "OFFICIAL") return officialRoles.includes(u.role);
          // STAFF: all non-member, non-official roles
          return !officialRoles.includes(u.role);
        });

        setRecipients(
          filtered.map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            branchId: u.branchId || null,
          })),
        );
      }
    } catch {
      toast.error("Failed to load recipients");
    } finally {
      setRecipientsLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (sessionRole === "TELLER" && insufficientFloat) {
      toast.error("Insufficient float balance for this advance amount.");
      return;
    }
    try {
      setLoading(true);
      await axios.post("/api/v1/staff-advances", {
        advanceType,
        staffId: values.recipientId,
        amount: values.amount,
        reason: values.reason,
        installments: values.installments,
        monthlyDeduction,
        repaymentStartMonth: values.repaymentStartMonth,
        notes: values.notes,
        branchId: sessionBranchId || undefined,
      });
      toast.success(
        `${ADVANCE_TYPES.find((t) => t.value === advanceType)?.label} request submitted for approval`,
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to submit advance request",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedTypeDef = ADVANCE_TYPES.find((t) => t.value === advanceType)!;

  const recipientLabel =
    advanceType === "MEMBER"
      ? "SACCO Member"
      : advanceType === "OFFICIAL"
        ? "Executive / Official"
        : "Staff Member";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Initiate Advance Request</DialogTitle>
          <DialogDescription>
            Select the advance type, choose the recipient, and fill in the
            details. The request goes to a manager for approval before cash is
            disbursed.
          </DialogDescription>
        </DialogHeader>

        {/* ── Advance type selector ── */}
        <div className="grid grid-cols-3 gap-2">
          {ADVANCE_TYPES.map((t) => {
            const Icon = t.icon;
            const active = advanceType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setAdvanceType(t.value)}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all",
                  active
                    ? cn("border-current", t.color)
                    : "border-muted bg-muted/20 hover:bg-muted/40",
                )}
              >
                <Icon className={cn("h-5 w-5 mb-1", active ? "" : "text-muted-foreground")} />
                <p className={cn("text-xs font-semibold", !active && "text-muted-foreground")}>
                  {t.label}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Float balance (tellers only) ── */}
        {floatInfo !== null && sessionRole === "TELLER" && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 flex items-center gap-3 text-sm",
              !floatInfo.isActiveForDay
                ? "border-red-200 bg-red-50 text-red-800"
                : insufficientFloat
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-green-200 bg-green-50 text-green-800",
            )}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            {!floatInfo.isActiveForDay ? (
              <span>
                Your float session is <strong>not active</strong> for today.
              </span>
            ) : (
              <span>
                Float balance: <strong>{fmt(floatInfo.balance)}</strong>
                {insufficientFloat && (
                  <span className="ml-2 font-medium">— insufficient for this amount</span>
                )}
              </span>
            )}
          </div>
        )}

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {/* ── Recipient picker ── */}
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{recipientLabel}</FormLabel>
                  <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="h-11 w-full justify-between"
                      >
                        <span className="truncate text-left">
                          {selectedRecipient
                            ? advanceType === "MEMBER" && selectedRecipient.memberNumber
                              ? `${selectedRecipient.name} (#${selectedRecipient.memberNumber})`
                              : `${selectedRecipient.name}${selectedRecipient.role ? ` — ${selectedRecipient.role}` : ""}`
                            : recipientsLoading
                              ? "Loading..."
                              : recipients.length === 0
                                ? `No ${recipientLabel.toLowerCase()}s found`
                                : `Search ${recipientLabel.toLowerCase()}...`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(90vw,460px)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={`Search ${recipientLabel.toLowerCase()}...`} />
                        <CommandList className="max-h-64 overflow-y-auto">
                          <CommandEmpty>
                            {recipientsLoading ? "Loading..." : `No ${recipientLabel.toLowerCase()}s found.`}
                          </CommandEmpty>
                          <CommandGroup>
                            {recipients.map((r) => (
                              <CommandItem
                                key={r.id}
                                value={`${r.name} ${r.memberNumber || ""} ${r.role || ""}`}
                                onSelect={() => {
                                  field.onChange(r.id);
                                  setRecipientOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    field.value === r.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate">{r.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {advanceType === "MEMBER" && r.memberNumber
                                      ? `#${r.memberNumber}`
                                      : r.role}
                                  </span>
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

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Requested (UGX)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="100" {...field} />
                    </FormControl>
                    {insufficientFloat && sessionRole === "TELLER" && (
                      <p className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Exceeds float balance ({fmt(floatInfo!.balance)})
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason / Purpose</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Medical, School fees, Rent..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Installments</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Monthly Deduction (Auto-calculated)</FormLabel>
                <Input
                  readOnly
                  value={monthlyDeduction > 0 ? fmt(monthlyDeduction) : "—"}
                  className="bg-muted/50 font-semibold"
                />
              </FormItem>

              <FormField
                control={form.control}
                name="repaymentStartMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Start Month</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
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
                  <FormLabel>Notes / Narration</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief context or additional information..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {monthlyDeduction > 0 && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">
                  {fmt(monthlyDeduction)} / month × {watchedInstallments} months ={" "}
                  {fmt(Number(watchedAmount))} total
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  (sessionRole === "TELLER" &&
                    (insufficientFloat || floatInfo?.isActiveForDay === false))
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
