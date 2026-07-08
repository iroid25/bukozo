//@ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Calculator,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2,
  User,
  Building,
} from "lucide-react";

const reconciliationSchema = z.object({
  floatId: z.string().min(1, "Please select a float"),
  actualCash: z.coerce.number().min(0, "Actual cash must be 0 or greater"),
  systemBalance: z.coerce.number(),
  difference: z.coerce.number(),
  notes: z.string().optional(),
});

type ReconciliationFormValues = z.infer<typeof reconciliationSchema>;

interface UserFloat {
  id: string;
  balance: number;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    branch?: {
      name: string;
      location: string;
    };
  };
  lastReconciliation?: string;
}

interface FloatReconciliationCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  preSelectedFloatId?: string;
}

export default function FloatReconciliationCreateForm({
  isOpen,
  onClose,
  currentUserId,
  preSelectedFloatId,
}: FloatReconciliationCreateFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [availableFloats, setAvailableFloats] = useState<UserFloat[]>([]);
  const [selectedFloat, setSelectedFloat] = useState<UserFloat | null>(null);
  const [isLoadingFloats, setIsLoadingFloats] = useState(true);

  const form = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      floatId: preSelectedFloatId || "",
      actualCash: 0,
      systemBalance: 0,
      difference: 0,
      notes: "",
    },
  });

  // Load available floats
  useEffect(() => {
    const loadFloats = async () => {
      try {
        setIsLoadingFloats(true);

        if (preSelectedFloatId) {
          const response = await fetch("/api/v1/floats/me", {
            cache: "no-store",
          });
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to load float");
          }

          const userFloat = result.data?.userFloat;
          if (userFloat) {
            setAvailableFloats([userFloat]);
            setSelectedFloat(userFloat);
            form.setValue("floatId", userFloat.id);
            form.setValue("systemBalance", userFloat.balance);
            calculateDifference(0, userFloat.balance);
          }
        } else {
          const response = await fetch("/api/v1/floats/reset", {
            cache: "no-store",
          });
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to load floats");
          }

          setAvailableFloats(result.data?.userFloats || []);
        }
      } catch (error) {
        console.error("Error loading floats:", error);
        toast.error("Failed to load floats");
      } finally {
        setIsLoadingFloats(false);
      }
    };

    if (isOpen) {
      loadFloats();
    }
  }, [isOpen, preSelectedFloatId, currentUserId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        floatId: preSelectedFloatId || "",
        actualCash: 0,
        systemBalance: selectedFloat?.balance || 0,
        difference: 0,
        notes: "",
      });
    }
  }, [isOpen, preSelectedFloatId, selectedFloat, form]);

  // Calculate difference when actual cash or system balance changes
  const calculateDifference = (actualCash: number, systemBalance: number) => {
    const diff = actualCash - systemBalance;
    form.setValue("difference", diff);
    return diff;
  };

  // Handle float selection
  const handleFloatSelection = (floatId: string) => {
    const float = availableFloats.find((f) => f.id === floatId);
    if (float) {
      setSelectedFloat(float);
      form.setValue("systemBalance", float.balance);
      calculateDifference(form.getValues("actualCash"), float.balance);
    }
  };

  // Handle actual cash input change
  const handleActualCashChange = (value: number) => {
    const systemBalance = form.getValues("systemBalance");
    calculateDifference(value, systemBalance);
  };

  // Submit form
  const onSubmit = async (values: ReconciliationFormValues) => {
    if (!selectedFloat) {
      toast.error("Please select a float to reconcile");
      return;
    }

    try {
      setIsLoading(true);

      const reconciliationData = {
        floatId: values.floatId,
        actualCashOnHand: values.actualCash,
        actualFloatAmount: values.systemBalance,
        actualCash: values.actualCash,
        actualFloat: values.systemBalance,
        notes: values.notes || "",
      };

      const response = await fetch("/api/v1/floats/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reconciliationData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create reconciliation");
      }

      toast.success("Reconciliation completed successfully", {
        description:
          values.difference === 0
            ? "Float is balanced!"
            : `Difference of ${Math.abs(values.difference)} detected`,
      });

      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error creating reconciliation:", error);
      toast.error("Failed to create reconciliation", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get reconciliation status
  const getReconciliationStatus = (difference: number) => {
    if (difference === 0) {
      return {
        label: "Balanced",
        color: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle className="h-4 w-4" />,
      };
    } else {
      return {
        label: difference > 0 ? "Overage" : "Shortage",
        color:
          difference > 0
            ? "bg-yellow-100 text-yellow-700 border-yellow-200"
            : "bg-red-100 text-red-700 border-red-200",
        icon: <AlertTriangle className="h-4 w-4" />,
      };
    }
  };

  const currentDifference = form.watch("difference");
  const status = getReconciliationStatus(currentDifference);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Float Reconciliation
          </DialogTitle>
          <DialogDescription>
            Compare actual cash count with system balance to reconcile the
            float.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Float Selection */}
            {!preSelectedFloatId && (
              <FormField
                control={form.control}
                name="floatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Float to Reconcile</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleFloatSelection(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a float to reconcile" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingFloats ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading floats...
                          </div>
                        ) : (
                          availableFloats.map((float) => (
                            <SelectItem key={float.id} value={float.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">
                                    {float.user.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {float.user.role} •{" "}
                                    {formatCurrency(float.balance)}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Selected Float Info */}
            {selectedFloat && (
              <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Reconciling Float For:
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {selectedFloat.user.name}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <span>{selectedFloat.user.email}</span>
                        <Badge variant="outline">
                          {selectedFloat.user.role}
                        </Badge>
                        {selectedFloat.user.branch && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span>{selectedFloat.user.branch.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Reconciliation Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* System Balance */}
              <FormField
                control={form.control}
                name="systemBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      System Balance
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        readOnly
                        className="bg-gray-50"
                      />
                    </FormControl>
                    <div className="text-sm text-gray-500">
                      Current balance: {formatCurrency(field.value)}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actual Cash */}
              <FormField
                control={form.control}
                name="actualCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Actual Cash Count
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="Enter actual cash amount"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          field.onChange(value);
                          handleActualCashChange(value);
                        }}
                      />
                    </FormControl>
                    <div className="text-sm text-gray-500">
                      Physically counted: {formatCurrency(field.value)}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Difference Display */}
            <Card className={`border-2 ${status.color}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status.icon}
                    <div>
                      <div className="font-medium">{status.label}</div>
                      <div className="text-sm">
                        Difference: {currentDifference >= 0 ? "+" : ""}
                        {formatCurrency(currentDifference)}
                      </div>
                    </div>
                  </div>
                  <Badge className={status.color}>
                    {currentDifference === 0
                      ? "Perfect Match"
                      : currentDifference > 0
                      ? `+${formatCurrency(currentDifference)}`
                      : formatCurrency(currentDifference)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any notes about this reconciliation..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !selectedFloat}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Reconciliation
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
