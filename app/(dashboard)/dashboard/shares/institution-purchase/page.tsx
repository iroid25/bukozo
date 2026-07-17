"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Loader2, ArrowRight, Building2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(n);

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionType: string;
  accounts: {
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      id: string;
      name: string;
      isShareAccount: boolean;
      sharePrice: number | null;
      canWithdraw: boolean;
      hasFixedPeriod: boolean;
    };
  }[];
}

export default function InstitutionSharePurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedShareAccount, setSelectedShareAccount] = useState<Institution["accounts"][0] | null>(null);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<Institution["accounts"][0] | null>(null);
  const [numberOfShares, setNumberOfShares] = useState<number>(1);
  const [notes, setNotes] = useState("");

  const shareAccounts = selectedInstitution?.accounts.filter((a) => a.accountType.isShareAccount) || [];
  const savingsAccounts = selectedInstitution?.accounts.filter(
    (a) => !a.accountType.isShareAccount && !a.accountType.hasFixedPeriod && a.accountType.canWithdraw,
  ) || [];

  const shareValue = selectedShareAccount?.accountType?.sharePrice || 0;
  const totalAmount = numberOfShares * shareValue;

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/deposits/institutions");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load institutions");
      setInstitutions(data);
    } catch (err) {
      console.error("Error loading institutions:", err);
      toast.error("Failed to load institutions");
    } finally {
      setLoading(false);
    }
  };

  const filteredInstitutions = institutions.filter(
    (i) =>
      i.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.institutionNumber.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInstitution(inst);
    setSelectedShareAccount(null);
    setSelectedSourceAccount(null);
    setNumberOfShares(1);
    setNotes("");
    const shares = inst.accounts.filter((a) => a.accountType.isShareAccount);
    if (shares.length === 1) setSelectedShareAccount(shares[0]);
  };

  const canSubmit =
    selectedInstitution &&
    selectedShareAccount &&
    numberOfShares > 0 &&
    shareValue > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/shares/institution-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: selectedInstitution.id,
          accountId: selectedShareAccount.id,
          numberOfShares,
          sourceAccountId: selectedSourceAccount?.id || undefined,
          notes: notes || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to process share purchase");

      toast.success(
        `Successfully purchased ${numberOfShares} share(s) for ${selectedInstitution.institutionName}. Total: ${fmt(totalAmount)}`,
      );

      setSelectedShareAccount(null);
      setSelectedSourceAccount(null);
      setNumberOfShares(1);
      setNotes("");
      loadInstitutions();
    } catch (err: any) {
      toast.error(err.message || "Failed to process share purchase");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowRight className="h-4 w-4 rotate-180" /> Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Institution Share Purchase
          </CardTitle>
          <CardDescription>
            Purchase shares for an institution. Shares will be credited to the institution&apos;s share account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select Institution */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Institution</Label>
            {selectedInstitution ? (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-100 text-[10px] font-black text-green-800">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{selectedInstitution.institutionName}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      #{selectedInstitution.institutionNumber} · {selectedInstitution.institutionType}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedInstitution(null); setSelectedShareAccount(null); setSelectedSourceAccount(null); }}
                  className="ml-3 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or institution number..."
                    className="pl-9"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white max-h-60 overflow-y-auto">
                  {filteredInstitutions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">No institutions found</p>
                  ) : (
                    filteredInstitutions.map((inst) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => handleSelectInstitution(inst)}
                        className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{inst.institutionName}</p>
                          <p className="text-[11px] text-gray-500">#{inst.institutionNumber} · {inst.accounts.length} account(s)</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Step 2: Select Share Account */}
          {selectedInstitution && shareAccounts.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Share Account</Label>
              <Select
                value={selectedShareAccount?.id || ""}
                onValueChange={(val) => {
                  const acct = shareAccounts.find((a) => a.id === val);
                  setSelectedShareAccount(acct || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select share account" />
                </SelectTrigger>
                <SelectContent>
                  {shareAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountNumber} - {a.accountType.name} ({fmt(a.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedShareAccount && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 text-xs text-blue-700">
                  Share Price: <span className="font-semibold">{fmt(shareValue)}</span> per share
                </div>
              )}
            </div>
          )}

          {selectedInstitution && shareAccounts.length === 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              This institution does not have any active share accounts. Create a share account first.
            </div>
          )}

          {/* Step 3: Number of Shares */}
          {selectedShareAccount && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Number of Shares</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numberOfShares}
                    onChange={(e) => setNumberOfShares(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Total Amount</Label>
                  <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900">
                    {fmt(totalAmount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Source Account (optional) */}
          {selectedShareAccount && savingsAccounts.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Fund From (Optional)</Label>
              <Select
                value={selectedSourceAccount?.id || "CASH"}
                onValueChange={(val) => {
                  if (val === "CASH") {
                    setSelectedSourceAccount(null);
                  } else {
                    const acct = savingsAccounts.find((a) => a.id === val);
                    setSelectedSourceAccount(acct || null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cash payment (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash Payment</SelectItem>
                  {savingsAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountNumber} - {a.accountType.name} (Bal: {fmt(a.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSourceAccount && Number(selectedSourceAccount.balance) < totalAmount && (
                <p className="text-xs text-red-500">
                  Insufficient balance. Required: {fmt(totalAmount)}, Available: {fmt(selectedSourceAccount.balance)}
                </p>
              )}
            </div>
          )}

          {/* Step 5: Notes */}
          {selectedShareAccount && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for share purchase..."
                className="resize-none"
              />
            </div>
          )}

          {/* Summary & Submit */}
          {selectedShareAccount && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Institution</span>
                <span className="font-medium">{selectedInstitution?.institutionName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Share Account</span>
                <span className="font-medium">{selectedShareAccount.accountNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shares</span>
                <span className="font-medium">{numberOfShares}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Share Price</span>
                <span className="font-medium">{fmt(shareValue)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-blue-700">{fmt(totalAmount)}</span>
              </div>
              {selectedSourceAccount && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Funded From</span>
                  <span className="font-medium">{selectedSourceAccount.accountNumber}</span>
                </div>
              )}
              {!selectedSourceAccount && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment</span>
                  <span className="font-medium">Cash</span>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Purchase...
              </>
            ) : (
              <>
                Purchase Shares
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
