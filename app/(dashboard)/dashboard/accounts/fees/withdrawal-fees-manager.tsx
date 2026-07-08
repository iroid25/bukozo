// app/dashboard/settings/fees/withdrawal-fees-manager.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { parseWithdrawalFeeTiers, WithdrawalFeeTier } from "@/lib/fees";

type AccountTypeRow = {
  id: string;
  name: string;
  monthlyCharge: number | null;
  flatWithdrawalFee: number | null;
  tiers: WithdrawalFeeTier[];
};

export default function WithdrawalFeesManager({
  initialAccountTypes,
}: {
  initialAccountTypes: Array<{
    id: string;
    name: string;
    monthlyCharge: number | null;
    flatWithdrawalFee: number | null;
    withdrawalFeeTiers: string | null;
  }>;
}) {
  const [rows, setRows] = useState<AccountTypeRow[]>(
    initialAccountTypes.map((a) => ({
      id: a.id,
      name: a.name,
      monthlyCharge: a.monthlyCharge,
      flatWithdrawalFee: a.flatWithdrawalFee,
      tiers: parseWithdrawalFeeTiers(a.withdrawalFeeTiers),
    }))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateRow = (
    id: string,
    updater: (r: AccountTypeRow) => AccountTypeRow
  ) => {
    setRows((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  };

  const addTier = (id: string) => {
    updateRow(id, (r) => ({
      ...r,
      tiers: [...r.tiers, { max: null, fee: 0 }],
    }));
  };

  const removeTier = (id: string, index: number) => {
    updateRow(id, (r) => ({
      ...r,
      tiers: r.tiers.filter((_, i) => i !== index),
    }));
  };

  const setTierField = (
    id: string,
    index: number,
    field: keyof WithdrawalFeeTier,
    value: number | null
  ) => {
    updateRow(id, (r) => {
      const tiers = [...r.tiers];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...r, tiers };
    });
  };

  const saveOne = async (row: AccountTypeRow) => {
    try {
      setSavingId(row.id);

      // normalize: sort by max asc; keep one open-ended tier (max=null) last
      const compact = row.tiers
        .filter((t) => (t.max === null || t.max >= 0) && t.fee >= 0)
        .sort((a, b) => {
          if (a.max === null) return 1;
          if (b.max === null) return -1;
          return (a.max as number) - (b.max as number);
        });

      const withNull = compact.filter((t) => t.max === null);
      const withoutNull = compact.filter((t) => t.max !== null);
      const finalTiers: WithdrawalFeeTier[] = [
        ...withoutNull,
        ...(withNull.length
          ? [{ max: null, fee: withNull[withNull.length - 1].fee }]
          : []),
      ];

      const res = await fetch(`/api/v1/account-types/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyCharge: row.monthlyCharge ?? null,
          flatWithdrawalFee: row.flatWithdrawalFee ?? null,
          withdrawalFeeTiers: JSON.stringify(finalTiers),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error("Failed to save", { description: json.error });
      } else {
        toast.success("Saved successfully");
      }
    } catch (e: any) {
      toast.error("Failed to save", {
        description: e?.message || "Unknown error",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {rows.map((row) => (
        <Card key={row.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">{row.name}</CardTitle>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => saveOne(row)}
              disabled={savingId === row.id}
            >
              <Save className="h-4 w-4" />
              {savingId === row.id ? "Saving..." : "Save"}
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Monthly Charge (UGX)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={row.monthlyCharge ?? ""}
                  onChange={(e) =>
                    updateRow(row.id, (r) => ({
                      ...r,
                      monthlyCharge:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Flat Withdrawal Fee (UGX)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={row.flatWithdrawalFee ?? ""}
                  onChange={(e) =>
                    updateRow(row.id, (r) => ({
                      ...r,
                      flatWithdrawalFee:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="Leave empty to use tiers"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Withdrawal Fee Tiers</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => addTier(row.id)}
                >
                  <Plus className="h-4 w-4" />
                  Add Tier
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Define fees by amount thresholds (UGX). The last tier can use{" "}
                <strong>Max = blank</strong> to mean “and above”.
              </div>

              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b bg-muted/50 text-sm">
                  <div className="col-span-5">Max Amount (UGX)</div>
                  <div className="col-span-5">Fee (UGX)</div>
                  <div className="col-span-2" />
                </div>

                {row.tiers.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No tiers defined. Add at least one, or set a flat fee above.
                  </div>
                ) : (
                  row.tiers.map((t, idx) => (
                    <div
                      key={`${row.id}-tier-${idx}`}
                      className="grid grid-cols-12 gap-2 px-3 py-2 border-t items-center"
                    >
                      <div className="col-span-5">
                        <Input
                          type="number"
                          min={0}
                          value={t.max ?? ""}
                          onChange={(e) =>
                            setTierField(
                              row.id,
                              idx,
                              "max",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          placeholder="blank = no upper limit"
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          type="number"
                          min={0}
                          value={t.fee}
                          onChange={(e) =>
                            setTierField(
                              row.id,
                              idx,
                              "fee",
                              Number(e.target.value)
                            )
                          }
                          placeholder="e.g. 300"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTier(row.id, idx)}
                          title="Remove tier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
