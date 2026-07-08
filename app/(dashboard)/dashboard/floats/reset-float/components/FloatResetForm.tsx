// @ts-nocheck
// app/dashboard/accountant/components/FloatResetForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  User,
  DollarSign,
  RefreshCw,
  Shield,
  CheckCircle,
  XCircle,
} from "lucide-react";
interface UserFloat {
  id: string;
  userId: string;
  balance: number;
  lastReconciliation: Date | null;
  currentDayStarted: Date | null;
  isActiveForDay: boolean;
  canStartNewDay: boolean;
  pendingReconciliation: boolean;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    branch?: {
      name: string;
      location: string;
    } | null;
  };
}

const floatResetSchema = z.object({
  resetType: z.enum(["FULL_RESET", "BALANCE_ONLY", "STATUS_ONLY"]),
  newBalance: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      "Balance must be zero or positive"
    ),
  reason: z
    .string()
    .min(10, "Please provide a detailed reason (min 10 characters)"),
  confirmReset: z.boolean().refine((val) => val === true, {
    message: "You must confirm the reset action",
  }),
});

type FloatResetFormValues = z.infer<typeof floatResetSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userFloat: UserFloat;
  currentUserId: string;
}

export default function FloatResetForm({
  isOpen,
  onClose,
  userFloat,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FloatResetFormValues>({
    resolver: zodResolver(floatResetSchema),
    defaultValues: {
      resetType: "FULL_RESET",
      newBalance: "0",
      reason: "",
      confirmReset: false,
    },
  });

  const resetType = form.watch("resetType");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const onSubmit = async (data: FloatResetFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/floats/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userFloatId: userFloat.id,
          resetType: data.resetType,
          newBalance: data.newBalance ? parseFloat(data.newBalance) : undefined,
          reason: data.reason,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Reset failed", {
          description: result.error || "Failed to reset float",
        });
        return;
      }

      toast.success("Float reset successful", {
        description: `${userFloat.user.name}'s float has been reset`,
      });

      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("An unexpected error occurred", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onClose();
    }
  };

  const getResetTypeDescription = (type: string) => {
    switch (type) {
      case "FULL_RESET":
        return "Resets balance to zero, clears active day status, allows new day start, and removes pending reconciliation flag. This is a complete reset.";
      case "BALANCE_ONLY":
        return "Only resets the balance amount. All status flags remain unchanged. Use this to adjust incorrect balance values.";
      case "STATUS_ONLY":
        return "Resets status flags (active day, can start new day, pending reconciliation) but keeps the current balance. Use this to unblock users.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-600" />
            Reset Float Balance
          </DialogTitle>
          <DialogDescription>
            Reset float balance and status for {userFloat.user.name}. This
            action will be logged for audit purposes.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Banner */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  ⚠️ Caution: Sensitive Operation
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Resetting float balances affects financial records and user
                  operations. Ensure you have proper authorization and document
                  the reason thoroughly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Status Card */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Current Float Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">User</p>
                <p className="font-medium">{userFloat.user.name}</p>
                <p className="text-xs text-gray-500">{userFloat.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(userFloat.balance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Active Day</p>
                <Badge
                  variant="outline"
                  className={
                    userFloat.isActiveForDay
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100"
                  }
                >
                  {userFloat.isActiveForDay ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Yes
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      No
                    </>
                  )}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Can Start New Day</p>
                <Badge
                  variant="outline"
                  className={
                    userFloat.canStartNewDay
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {userFloat.canStartNewDay ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Yes
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      No
                    </>
                  )}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  Pending Reconciliation
                </p>
                <Badge
                  variant="outline"
                  className={
                    userFloat.pendingReconciliation
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100"
                  }
                >
                  {userFloat.pendingReconciliation ? "Yes" : "No"}
                </Badge>
              </div>
              {userFloat.user.branch && (
                <div>
                  <p className="text-sm text-gray-500">Branch</p>
                  <p className="font-medium">{userFloat.user.branch.name}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Reset Type Selection */}
            <FormField
              control={form.control}
              name="resetType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reset type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FULL_RESET">
                        <div className="flex flex-col py-1">
                          <span className="font-medium">Full Reset</span>
                          <span className="text-xs text-gray-500">
                            Reset balance and all status flags
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="BALANCE_ONLY">
                        <div className="flex flex-col py-1">
                          <span className="font-medium">Balance Only</span>
                          <span className="text-xs text-gray-500">
                            Only adjust the balance amount
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="STATUS_ONLY">
                        <div className="flex flex-col py-1">
                          <span className="font-medium">Status Only</span>
                          <span className="text-xs text-gray-500">
                            Reset status flags, keep balance
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    {getResetTypeDescription(field.value)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Balance (if BALANCE_ONLY or FULL_RESET) */}
            {(resetType === "BALANCE_ONLY" || resetType === "FULL_RESET") && (
              <FormField
                control={form.control}
                name="newBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      New Balance (UGX) *
                      {resetType === "FULL_RESET" && " - Will be set to 0"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter new balance"
                        {...field}
                        disabled={resetType === "FULL_RESET"}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      {resetType === "FULL_RESET"
                        ? "Balance will be automatically set to 0 for full reset"
                        : "Enter the new balance amount in Ugandan Shillings"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Reset *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed explanation for this reset action (minimum 10 characters)"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This reason will be logged and visible in audit trails. Be
                    specific and detailed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirmation Checkbox */}
            <FormField
              control={form.control}
              name="confirmReset"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-amber-200 bg-amber-50 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-medium text-amber-900">
                      I understand and confirm this reset action *
                    </FormLabel>
                    <FormDescription className="text-amber-700">
                      I acknowledge that this action will modify financial
                      records and will be logged for audit purposes. I have
                      proper authorization to perform this operation.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* Impact Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Reset Impact Summary
                </h4>
                <div className="space-y-2 text-sm text-blue-800">
                  {resetType === "FULL_RESET" && (
                    <>
                      <p>✓ Balance will be reset to UGX 0</p>
                      <p>✓ Active day status will be cleared</p>
                      <p>✓ User will be able to start a new day</p>
                      <p>✓ Pending reconciliation flag will be removed</p>
                      <p>✓ Current day started date will be cleared</p>
                    </>
                  )}
                  {resetType === "BALANCE_ONLY" && (
                    <>
                      <p>
                        ✓ Balance will be set to{" "}
                        {form.watch("newBalance")
                          ? formatCurrency(
                              parseFloat(form.watch("newBalance") || "0")
                            )
                          : "specified amount"}
                      </p>
                      <p>• All status flags remain unchanged</p>
                      <p>
                        • Active day status:{" "}
                        {userFloat.isActiveForDay ? "Active" : "Inactive"}
                      </p>
                      <p>
                        • Can start new day:{" "}
                        {userFloat.canStartNewDay ? "Yes" : "No"}
                      </p>
                    </>
                  )}
                  {resetType === "STATUS_ONLY" && (
                    <>
                      <p>
                        • Balance remains at {formatCurrency(userFloat.balance)}
                      </p>
                      <p>✓ Active day status will be cleared</p>
                      <p>✓ User will be able to start a new day</p>
                      <p>✓ Pending reconciliation flag will be removed</p>
                      <p>✓ Current day started date will be cleared</p>
                    </>
                  )}
                  <p className="text-xs text-blue-600 mt-3 pt-2 border-t border-blue-200">
                    This action will be logged with timestamp, user ID, and
                    reason
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !form.watch("confirmReset")}
                className="min-w-[150px] bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Confirm Reset
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
