"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  loanProductId: z.string().min(1, "Loan Product is required"),
  amountGranted: z.coerce.number().min(1, "Principal amount must be positive"),
  dateDisbursed: z.date(),
  outstandingBalance: z.coerce.number().min(0, "Balance cannot be negative"),
  repaymentPeriodMonths: z.coerce.number().min(1, "Period must be at least 1 month"),
  interestRate: z.coerce.number().min(0, "Interest rate cannot be negative"),
  notes: z.string().optional(),
  // Guarantor fields
  guarantors: z.array(z.object({
    name: z.string().min(1, "Guarantor name is required"),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  })).optional(),
  // Collateral fields
  collateralType: z.string().optional(),
  collateralValue: z.coerce.number().optional(),
  collateralLocation: z.string().optional(),
  collateralDetails: z.string().optional(),
  forcedSaleValue: z.coerce.number().optional(),
});

interface MigrateLoanFormProps {
  members: { id: string; name: string; memberNumber: string }[];
  products: { id: string; name: string; interestRate: number; maxAmount: number }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MigrateLoanForm({ members, products, onSuccess, onCancel }: MigrateLoanFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guarantors, setGuarantors] = useState<Array<{ name: string; phone?: string; relationship?: string }>>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountGranted: 0,
      outstandingBalance: 0,
      repaymentPeriodMonths: 12,
      interestRate: 0,
      guarantors: [],
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/loans/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json();
      if (res.ok && (result.success !== false)) {
        toast.success("Loan Migrated", {
          description: "The legacy loan has been successfully imported.",
        });
        form.reset();
        onSuccess?.();
      } else {
        toast.error("Migration Failed", {
          description: result.error || "Migration failed",
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
          <FormField
            control={form.control}
            name="memberId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Member</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Member" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.memberNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="loanProductId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loan Product</FormLabel>
                <Select 
                    onValueChange={(val) => {
                        field.onChange(val);
                        const prod = products.find(p => p.id === val);
                        if (prod) {
                            form.setValue("interestRate", prod.interestRate);
                        }
                    }} 
                    defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.interestRate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amountGranted"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Principal</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="outstandingBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Outstanding Balance</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dateDisbursed"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Original Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  The date the loan was originally given.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
             <FormField
                control={form.control}
                name="repaymentPeriodMonths"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Period (Months)</FormLabel>
                    <FormControl>
                    <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
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
          </div>
        </div>

        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                <Input {...field} placeholder="Migration details..." />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />

        {/* Guarantor Section */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Guarantors (Optional)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newGuarantors = [...guarantors, { name: "", phone: "", relationship: "" }];
                setGuarantors(newGuarantors);
                form.setValue("guarantors", newGuarantors);
              }}
            >
              Add Guarantor
            </Button>
          </div>
          
          {guarantors.map((guarantor, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={guarantor.name}
                  onChange={(e) => {
                    const updated = [...guarantors];
                    updated[index].name = e.target.value;
                    setGuarantors(updated);
                    form.setValue("guarantors", updated);
                  }}
                  placeholder="Guarantor name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={guarantor.phone}
                  onChange={(e) => {
                    const updated = [...guarantors];
                    updated[index].phone = e.target.value;
                    setGuarantors(updated);
                    form.setValue("guarantors", updated);
                  }}
                  placeholder="Phone number"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Relationship</label>
                  <Input
                    value={guarantor.relationship}
                    onChange={(e) => {
                      const updated = [...guarantors];
                      updated[index].relationship = e.target.value;
                      setGuarantors(updated);
                      form.setValue("guarantors", updated);
                    }}
                    placeholder="e.g., Spouse, Friend"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    const updated = guarantors.filter((_, i) => i !== index);
                    setGuarantors(updated);
                    form.setValue("guarantors", updated);
                  }}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Collateral Section */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Collateral Information (Optional)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="collateralType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collateral Type</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Land, Vehicle, Building" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="collateralValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collateral Value</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="Estimated value" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="collateralLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Where is the collateral located?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forcedSaleValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forced Sale Value</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="Quick sale value" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="collateralDetails"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Additional Details</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Any other relevant information" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>


        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Migrate Loan
          </Button>
        </div>
      </form>
    </Form>
  );
}
