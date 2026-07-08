"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Banknote,
  Building2,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// --- Schema ---

const tierSchema = z.object({
  min: z.coerce.number().min(0, "Min amount must be 0 or more"),
  // Handle empty string as null for "Unlimited"
  max: z.union([z.string(), z.number(), z.null()]).transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
});

const configSchema = z.object({
  memberRates: z.array(tierSchema),
  institutionRates: z.array(tierSchema),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function WithdrawalConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      memberRates: [],
      institutionRates: [],
    },
  });

  const { control, handleSubmit, reset } = form;

  const {
    fields: memberFields,
    append: appendMember,
    remove: removeMember,
  } = useFieldArray({
    control,
    name: "memberRates",
  });

  const {
    fields: institutionFields,
    append: appendInstitution,
    remove: removeInstitution,
  } = useFieldArray({
    control,
    name: "institutionRates",
  });

  // --- Data Fetching ---

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/v1/system/withdrawal-config");
        if (!res.ok) throw new Error("Failed to load configuration");
        const data = await res.json();
        
        // Ensure max is handled correctly (null vs undefined)
        const formatTiers = (tiers: any[]) => 
          tiers.map(t => ({
            ...t,
            max: t.max === null ? null : Number(t.max)
          }));

        reset({
          memberRates: formatTiers(data.memberRates || []),
          institutionRates: formatTiers(data.institutionRates || []),
        });
      } catch (error) {
        toast.error("Failed to load configuration settings");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [reset]);

  // --- Submission ---

  const onSubmit = async (data: ConfigFormValues) => {
    setSaving(true);
    try {
      // Pre-process data: ensure exact nulls for "and above" logic if needed
      // Zod coerce might make empty string 0 or similar, but nullable() helps.
      
      const payload = {
        memberRates: data.memberRates.map(r => ({
          ...r,
          max: (!r.max && r.max !== 0) ? null : r.max 
        })),
        institutionRates: data.institutionRates.map(r => ({
            ...r,
            max: (!r.max && r.max !== 0) ? null : r.max 
        })),
      };

      const res = await fetch("/api/v1/system/withdrawal-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save changes");
      }

      toast.success("Withdrawal configuration saved successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTierList = (
    fields: any[],
    remove: (index: number) => void,
    append: (val: any) => void,
    namePrefix: "memberRates" | "institutionRates"
  ) => (
    <div className="space-y-4">
      <div className="grid grid-cols-10 gap-4 mb-2 font-medium text-sm text-muted-foreground px-1">
        <div className="col-span-3">Min Amount (UGX)</div>
        <div className="col-span-3">Max Amount (UGX)</div>
        <div className="col-span-3">Fee (UGX)</div>
        <div className="col-span-1"></div>
      </div>

      {fields.map((field, index) => {
        const isLast = index === fields.length - 1;
        // Watch max value to nicely display "And Above" if null? 
        // For inputs, we just leave it blank or use placeholder.

        return (
          <div key={field.id} className="grid grid-cols-10 gap-4 items-center">
            <div className="col-span-3">
                <Input
                  {...form.register(`${namePrefix}.${index}.min` as const)}
                  type="number"
                  placeholder="0"
                />
            </div>
            <div className="col-span-3 relative">
                <Input
                  {...form.register(`${namePrefix}.${index}.max` as const)}
                  type="number"
                  placeholder="Unlimited"
                />
                <div className="absolute right-3 top-2 pointer-events-none text-xs text-muted-foreground">
                    {/* Optional hint */}
                </div>
            </div>
            <div className="col-span-3">
                <Input
                  {...form.register(`${namePrefix}.${index}.fee` as const)}
                  type="number"
                  placeholder="0"
                />
            </div>
            <div className="col-span-1 flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => {
            // Smart append: suggest min = prevMax + 1
            const prev = form.getValues(namePrefix);
            const last = prev[prev.length - 1];
            const start = last && last.max ? Number(last.max) + 1 : 0;
            append({ min: start, max: null, fee: 0 });
        }}
        className="mt-2 text-blue-600 border-blue-200 hover:bg-blue-50"
      >
        <Plus className="h-4 w-4 mr-2" /> Add Tier
      </Button>

      {fields.length === 0 && (
        <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          No rates configured. Click "Add Tier" to start.
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Withdrawal Configuration</h2>
          <p className="text-muted-foreground">
            Configure tiered withdrawal fees for members and institutions.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6">
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Member Rates
            </TabsTrigger>
            <TabsTrigger value="institutions">
                <Building2 className="h-4 w-4 mr-2" />
                Institution Rates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    Member Withdrawal Rates
                </CardTitle>
                <CardDescription>
                  Define charge rates for individual member withdrawals. Leave "Max Amount" empty for the highest tier (unlimited).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderTierList(memberFields, removeMember, appendMember, "memberRates")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="institutions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Institution Withdrawal Rates
                </CardTitle>
                <CardDescription>
                  Define charge rates for institution withdrawals. Leave "Max Amount" empty for the highest tier.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderTierList(institutionFields, removeInstitution, appendInstitution, "institutionRates")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
