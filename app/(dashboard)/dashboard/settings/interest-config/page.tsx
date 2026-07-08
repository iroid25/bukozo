"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import InterestCalculator from "./components/InterestCalculator";
import { Calculator, Save, History, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InterestConfig {
  defaultInterestType: "FLAT_RATE" | "REDUCING_BALANCE";
  defaultLoanInterestRate: number;
  maxInterestRate: number;
  minInterestRate: number;
  allowInterestTypeOverride: boolean;
  savingsInterestRate: number;
  fixedDepositInterestRate: number;
}

interface ConfigHistory {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
  updatedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function InterestConfigPage() {
  const [config, setConfig] = useState<InterestConfig | null>(null);
  const [formData, setFormData] = useState<InterestConfig | null>(null);
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch current configuration
  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/v1/system/interest-config");
      if (!response.ok) throw new Error("Failed to fetch configuration");
      
      const data = await response.json();
      setConfig(data);
      setFormData(data);
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Failed to load interest configuration");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/v1/system/interest-config/history?limit=20");
      if (!response.ok) throw new Error("Failed to fetch history");
      
      const data = await response.json();
      setHistory(data.data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    // Validation
    if (formData.maxInterestRate <= formData.minInterestRate) {
      toast.error("Maximum interest rate must be greater than minimum interest rate");
      return;
    }

    if (formData.defaultLoanInterestRate < formData.minInterestRate || 
        formData.defaultLoanInterestRate > formData.maxInterestRate) {
      toast.error("Default loan interest rate must be between min and max rates");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/system/interest-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update configuration");
      }

      toast.success("Interest configuration updated successfully");
      await fetchConfig();
      await fetchHistory();
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(formData);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Calculator className="mx-auto h-12 w-12 animate-pulse text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="flex h-full flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interest Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system-wide interest rate settings and calculation methods
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="mr-2 h-4 w-4" />
          {showHistory ? "Hide" : "Show"} History
        </Button>
      </div>

      {/* Warning Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Changes to these settings will affect new loan products and applications. Existing loans will retain their current settings.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loan Interest Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Interest Settings</CardTitle>
            <CardDescription>
              Configure default interest rates and calculation methods for loans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Interest Type */}
            <div className="space-y-2">
              <Label htmlFor="interestType">Default Interest Type</Label>
              <Select
                value={formData.defaultInterestType}
                onValueChange={(value: "FLAT_RATE" | "REDUCING_BALANCE") =>
                  setFormData({ ...formData, defaultInterestType: value })
                }
              >
                <SelectTrigger id="interestType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                  <SelectItem value="REDUCING_BALANCE">Reducing Balance</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.defaultInterestType === "FLAT_RATE"
                  ? "Interest calculated on the original principal amount"
                  : "Interest calculated on the remaining balance"}
              </p>
            </div>

            {/* Default Loan Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="defaultRate">Default Loan Interest Rate (%)</Label>
              <Input
                id="defaultRate"
                type="number"
                step="0.1"
                min={formData.minInterestRate}
                max={formData.maxInterestRate}
                value={formData.defaultLoanInterestRate}
                onChange={(e) =>
                  setFormData({ ...formData, defaultLoanInterestRate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Min Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="minRate">Minimum Interest Rate (%)</Label>
              <Input
                id="minRate"
                type="number"
                step="0.1"
                min="0"
                max="300"
                value={formData.minInterestRate}
                onChange={(e) =>
                  setFormData({ ...formData, minInterestRate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Max Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="maxRate">Maximum Interest Rate (%)</Label>
              <Input
                id="maxRate"
                type="number"
                step="0.1"
                min="0"
                max="300"
                value={formData.maxInterestRate}
                onChange={(e) =>
                  setFormData({ ...formData, maxInterestRate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Allow Override */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="allowOverride">Allow Interest Type Override</Label>
                <p className="text-xs text-muted-foreground">
                  Permit loan applications to use a different interest type than the product default
                </p>
              </div>
              <Switch
                id="allowOverride"
                checked={formData.allowInterestTypeOverride}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allowInterestTypeOverride: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Savings Interest Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Interest Settings</CardTitle>
            <CardDescription>
              Configure interest rates for savings and fixed deposit accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Savings Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="savingsRate">Savings Account Interest Rate (%)</Label>
              <Input
                id="savingsRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.savingsInterestRate}
                onChange={(e) =>
                  setFormData({ ...formData, savingsInterestRate: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Annual interest rate for regular savings accounts
              </p>
            </div>

            {/* Fixed Deposit Interest Rate */}
            <div className="space-y-2">
              <Label htmlFor="fixedDepositRate">Fixed Deposit Interest Rate (%)</Label>
              <Input
                id="fixedDepositRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.fixedDepositInterestRate}
                onChange={(e) =>
                  setFormData({ ...formData, fixedDepositInterestRate: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Annual interest rate for fixed deposit accounts
              </p>
            </div>

            {/* Preview Calculation */}
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-semibold text-sm mb-3">Example Calculation Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Amount:</span>
                  <span className="font-medium">UGX 1,000,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Rate:</span>
                  <span className="font-medium">{formData.defaultLoanInterestRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium">12 months</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total Interest:</span>
                  <span>
                    UGX {(1000000 * formData.defaultLoanInterestRate / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interest Calculator */}
      <div className="mt-8">
        <InterestCalculator />
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => setFormData(config)}
          disabled={!hasChanges || saving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Change History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
            <CardDescription>
              Recent modifications to interest configuration settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Setting</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No change history available
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {new Date(item.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.description || item.key}
                      </TableCell>
                      <TableCell>{item.value}</TableCell>
                      <TableCell className="text-sm">
                        {item.updatedByUser?.name || "System"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
