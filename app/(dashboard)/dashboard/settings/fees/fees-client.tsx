
"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

import { 
  MOBILE_MONEY_TRANSFER_FEES, 
  AGENT_WITHDRAWAL_FEES, 
  AGENT_DEPOSIT_FEES, 
  SCHOOL_FEES_COMMISSION,
  PenaltyTier,
  DEFAULT_PENALTY_TIERS,
  SAVINGS_POLICIES
} from "@/config/fees";

// Type definitions to match config/fees.ts
type FeeTier = { min: number; max: number; fee: number };
type AgentTier = { min: number; max: number; charge: number; saccoShare: number; agentShare: number };
type SchoolFees = { total: number; saccoShare: number; agentShare: number };

export type FeeConfigKey = 
  | "MOBILE_MONEY_FEES" 
  | "AGENT_WITHDRAWAL_FEES" 
  | "AGENT_DEPOSIT_FEES" 
  | "SCHOOL_FEES_COMMISSION"
  | "PENALTY_CONFIG"
  | "SAVINGS_CONFIG";

const updateConfigViaApi = async (key: string, value: any) => {
  try {
    const response = await fetch("/api/v1/settings/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const result = await response.json();
    return { success: response.ok, ...result };
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, error: "Network error" };
  }
};

export default function FeesSettingsPage({
  initialData
}: {
  initialData: {
    mobileMoney: FeeTier[];
    agentWithdrawal: AgentTier[];
    agentDeposit: AgentTier[];
    schoolFees: SchoolFees;
    penalty: PenaltyTier[];
    savings: typeof SAVINGS_POLICIES;
    userId: string;
  }
}) {
  const [activeTab, setActiveTab] = useState("mobile-money");
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fee Configuration</h1>
        <p className="text-muted-foreground">Manage transaction fees and commissions across the system.</p>
      </div>

      <Tabs defaultValue="mobile-money" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 lg:w-[900px]">
          <TabsTrigger value="mobile-money">Mobile Money</TabsTrigger>
          <TabsTrigger value="agent-withdrawor">Agent Withdraw</TabsTrigger>
          <TabsTrigger value="agent-deposit">Agent Deposit</TabsTrigger>
          <TabsTrigger value="school-fees">School Fees</TabsTrigger>
          <TabsTrigger value="loan-penalties">Loan Penalties</TabsTrigger>
          <TabsTrigger value="savings-interest">Savings Interest</TabsTrigger>
        </TabsList>

        <TabsContent value="mobile-money" className="mt-6">
          <FeeTierManager 
            title="Mobile Money Transfer Fees"
            description="Fees charged when transferring from Sacco Account to Mobile Money."
            initialTiers={initialData.mobileMoney}
            configKey="MOBILE_MONEY_FEES"
            userId={initialData.userId}
            type="simple"
          />
        </TabsContent>

        <TabsContent value="agent-withdrawor" className="mt-6">
          <FeeTierManager 
            title="Agent Withdrawal Commissions"
            description="Charges and commission splits when withdrawing cash at an Agent."
            initialTiers={initialData.agentWithdrawal}
            configKey="AGENT_WITHDRAWAL_FEES"
            userId={initialData.userId}
            type="agent"
          />
        </TabsContent>

        <TabsContent value="agent-deposit" className="mt-6">
          <FeeTierManager 
            title="Agent Deposit Commissions"
            description="Charges and commission splits when depositing cash at an Agent."
            initialTiers={initialData.agentDeposit}
            configKey="AGENT_DEPOSIT_FEES"
            userId={initialData.userId}
            type="agent"
          />
        </TabsContent>

        <TabsContent value="school-fees" className="mt-6">
          <SchoolFeesManager 
            initialFees={initialData.schoolFees}
            userId={initialData.userId}
          />
        </TabsContent>

        <TabsContent value="loan-penalties" className="mt-6">
          <PenaltyConfigManager 
            initialTiers={initialData.penalty}
          />
        </TabsContent>

        <TabsContent value="savings-interest" className="mt-6">
          <SavingsInterestManager 
            initialConfig={initialData.savings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Sub-components for managing specific fee types ---

function FeeTierManager({ 
  title, 
  description, 
  initialTiers, 
  configKey, 
  userId,
  type 
}: { 
  title: string; 
  description: string; 
  initialTiers: any[]; 
  configKey: FeeConfigKey; 
  userId: string;
  type: "simple" | "agent";
}) {
  const [tiers, setTiers] = useState<any[]>(initialTiers);
  const [isPending, startTransition] = useTransition();

  const addTier = () => {
    const newTier = type === "simple" 
      ? { min: 0, max: 0, fee: 0 }
      : { min: 0, max: 0, charge: 0, saccoShare: 0, agentShare: 0 };
    setTiers([...tiers, newTier]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: string, value: number) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateConfigViaApi(configKey, tiers);
      if (result.success) {
        toast.success("Fee configuration saved successfully.");
      } else {
        toast.error("Failed to save changes.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4">
            {tiers.map((tier, index) => (
              <div key={index} className="flex items-end gap-3 p-4 border rounded-lg bg-slate-50 relative group">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Min Amount</Label>
                    <Input 
                      type="number" 
                      value={tier.min} 
                      onChange={(e) => updateTier(index, 'min', Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Max Amount</Label>
                    <Input 
                      type="number" 
                      value={tier.max} 
                      onChange={(e) => updateTier(index, 'max', Number(e.target.value))} 
                    />
                  </div>
                  
                  {type === "simple" ? (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-blue-600">Fee</Label>
                      <Input 
                        type="number" 
                        value={tier.fee} 
                        onChange={(e) => updateTier(index, 'fee', Number(e.target.value))} 
                        className="border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-blue-600">Total Charge</Label>
                        <Input 
                          type="number" 
                          value={tier.charge} 
                          onChange={(e) => updateTier(index, 'charge', Number(e.target.value))}
                          className="border-blue-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-green-600">Sacco Share</Label>
                        <Input 
                          type="number" 
                          value={tier.saccoShare} 
                          onChange={(e) => updateTier(index, 'saccoShare', Number(e.target.value))} 
                          className="border-green-200"
                        />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-xs text-amber-600">Agent Share</Label>
                         <Input 
                          type="number" 
                          value={tier.agentShare} 
                          onChange={(e) => updateTier(index, 'agentShare', Number(e.target.value))}
                          className="border-amber-200"
                        />
                      </div>
                    </>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 absolute top-2 right-2"
                  onClick={() => removeTier(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addTier} className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" /> Add Configuration Tier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SchoolFeesManager({ initialFees, userId }: { initialFees: SchoolFees; userId: string }) {
  const [fees, setFees] = useState<SchoolFees>(initialFees);
  const [isPending, startTransition] = useTransition();

  const updateField = (field: keyof SchoolFees, value: number) => {
    setFees({ ...fees, [field]: value });
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateConfigViaApi("SCHOOL_FEES_COMMISSION", fees);
      if (result.success) {
        toast.success("School fees configuration saved.");
      } else {
        toast.error("Failed to save.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Fees Commission</CardTitle>
        <CardDescription>Configure the fixed commission usage for school fee payments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Total Charge (UGX)</Label>
            <Input 
              type="number" 
              value={fees.total} 
              onChange={(e) => updateField('total', Number(e.target.value))} 
              className="text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-green-600">Sacco Share (UGX)</Label>
            <Input 
              type="number" 
              value={fees.saccoShare} 
              onChange={(e) => updateField('saccoShare', Number(e.target.value))} 
              className="border-green-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-600">Agent Share (UGX)</Label>
            <Input 
              type="number" 
              value={fees.agentShare} 
              onChange={(e) => updateField('agentShare', Number(e.target.value))} 
              className="border-amber-200"
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
           <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PenaltyConfigManager({ initialTiers }: { initialTiers: PenaltyTier[] }) {
  const [tiers, setTiers] = useState<PenaltyTier[]>(initialTiers);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateConfigViaApi("PENALTY_CONFIG", tiers);
      if (result.success) toast.success("Penalty configuration saved.");
      else toast.error("Failed to save penalties.");
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-red-600 flex items-center gap-2">
              🔴 Penalty Charge Policy
            </CardTitle>
            <CardDescription>
              Escalating and compounding monthly penalties on loan arrears.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 border rounded-lg bg-red-50/30">
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Min Days Overdue</Label>
                  <Input type="number" value={tier.minDays} onChange={(e) => {
                    const newTiers = [...tiers];
                    newTiers[idx].minDays = Number(e.target.value);
                    setTiers(newTiers);
                  }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Days Overdue</Label>
                  <Input type="number" value={tier.maxDays} onChange={(e) => {
                    const newTiers = [...tiers];
                    newTiers[idx].maxDays = Number(e.target.value);
                    setTiers(newTiers);
                  }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-700 font-bold">Penalty Percentage (%)</Label>
                  <Input type="number" step="0.1" value={tier.penaltyRate * 100} onChange={(e) => {
                    const newTiers = [...tiers];
                    newTiers[idx].penaltyRate = Number(e.target.value) / 100;
                    setTiers(newTiers);
                  }} className="border-red-200" />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="border-dashed" onClick={() => setTiers([...tiers, { minDays: 0, maxDays: 0, penaltyRate: 0.06 }])}>
            <Plus className="mr-2 h-4 w-4" /> Add Penalty Tier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SavingsInterestManager({ initialConfig }: { initialConfig: typeof SAVINGS_POLICIES }) {
  const [config, setConfig] = useState(initialConfig);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateConfigViaApi("SAVINGS_CONFIG", config);
      if (result.success) toast.success("Savings policy saved.");
      else toast.error("Failed to save savings policy.");
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              💰 Fixed Savings Policy
            </CardTitle>
            <CardDescription>
              Configure global interest rates for fixed and regular savings.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Interest Rates</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Annual Interest Rate (%)</Label>
                <div className="flex gap-4 items-center">
                   <Input type="number" step="0.1" value={config.annualInterestRate} onChange={(e) => {
                     const ann = Number(e.target.value);
                     setConfig({ ...config, annualInterestRate: ann, monthlyInterestRate: Number((ann / 12).toFixed(3)) });
                   }} className="text-lg font-bold" />
                   <span className="text-muted-foreground whitespace-nowrap">/ year</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-600">Calculated Monthly Rate (%)</Label>
                <Input type="number" value={config.monthlyInterestRate} readOnly className="bg-slate-50 font-mono" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Example Calculation</h3>
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg space-y-2 font-mono text-sm">
              <p>Fixed Amount: UGX 500,000</p>
              <p>Fixed Period: 9 months</p>
              <p className="text-blue-400 mt-4 border-t border-slate-700 pt-2">
                Interest Earned = {config.monthlyInterestRate}% × 500k × 9 
              </p>
              <p className="text-green-400 font-bold">
                = UGX {(500000 * (config.monthlyInterestRate / 100) * 9).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
