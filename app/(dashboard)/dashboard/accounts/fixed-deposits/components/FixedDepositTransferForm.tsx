"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronsUpDown,
  Wallet,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
      canWithdraw: boolean;
      isShareAccount: boolean;
      hasFixedPeriod: boolean;
    };
  }>;
}

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionType: string;
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
      canWithdraw: boolean;
      isShareAccount: boolean;
      hasFixedPeriod: boolean;
    };
  }>;
}

interface FixedDepositTransferFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FixedDepositTransferForm({
  isOpen,
  onClose,
}: FixedDepositTransferFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<"MEMBER" | "INSTITUTION">("MEMBER");
  
  const [members, setMembers] = useState<Member[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [description, setDescription] = useState("");
  const [interestRate, setInterestRate] = useState<number>(0);
  const [entitySelectOpen, setEntitySelectOpen] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const [accountsRes, interestConfigRes] = await Promise.all([
        fetch("/api/v1/accounts/list"),
        fetch("/api/v1/system/interest-config/client"),
      ]);

      if (accountsRes.ok) {
        const json = await accountsRes.json();
        const allAccounts: any[] = Array.isArray(json?.data) ? json.data : [];

        // Only voluntary savings: active, canWithdraw, not a share, not fixed-period
        const eligible = allAccounts.filter(
          (acc) =>
            acc.status === "ACTIVE" &&
            acc.accountType?.canWithdraw &&
            !acc.accountType?.isShareAccount &&
            !acc.accountType?.hasFixedPeriod,
        );

        // Group into members
        const memberMap = new Map<string, Member>();
        eligible
          .filter((acc) => acc.member)
          .forEach((acc) => {
            const mid = acc.member.id;
            if (!memberMap.has(mid)) {
              memberMap.set(mid, {
                id: acc.member.id,
                memberNumber: acc.member.memberNumber,
                user: {
                  name: acc.member.user.name,
                  email: acc.member.user.email ?? null,
                  phone: acc.member.user.phone ?? null,
                },
                accounts: [],
              });
            }
            memberMap.get(mid)!.accounts.push({
              id: acc.id,
              accountNumber: acc.accountNumber,
              balance: acc.balance,
              accountType: {
                name: acc.accountType.name,
                canWithdraw: acc.accountType.canWithdraw,
                isShareAccount: acc.accountType.isShareAccount,
                hasFixedPeriod: acc.accountType.hasFixedPeriod,
              },
            });
          });
        setMembers(Array.from(memberMap.values()));

        // Group into institutions
        const instMap = new Map<string, Institution>();
        eligible
          .filter((acc) => acc.institution)
          .forEach((acc) => {
            const iid = acc.institution.id;
            if (!instMap.has(iid)) {
              instMap.set(iid, {
                id: acc.institution.id,
                institutionNumber: acc.institution.institutionNumber,
                institutionName: acc.institution.institutionName,
                institutionType: acc.institution.institutionType ?? "",
                accounts: [],
              });
            }
            instMap.get(iid)!.accounts.push({
              id: acc.id,
              accountNumber: acc.accountNumber,
              balance: acc.balance,
              accountType: {
                name: acc.accountType.name,
                canWithdraw: acc.accountType.canWithdraw,
                isShareAccount: acc.accountType.isShareAccount,
                hasFixedPeriod: acc.accountType.hasFixedPeriod,
              },
            });
          });
        setInstitutions(Array.from(instMap.values()));
      } else {
        toast.error("Failed to load accounts");
        setMembers([]);
        setInstitutions([]);
      }

      if (interestConfigRes.ok) {
        const config = await interestConfigRes.json();
        if (typeof config?.fixedDepositInterestRate === "number") {
          setInterestRate(config.fixedDepositInterestRate);
        }
      }
    } catch (error) {
      console.error("[FixedDepositForm] Error loading data:", error);
      toast.error("Failed to load account data");
    }
  };

  // Interest rate comes from system config only — the server ignores submitted rate.
  // Do not override it from account type to avoid mismatch with actual server calculation.

  // All accounts on the selected entity are already filtered to eligible voluntary savings (done at load time)
  const voluntaryAccounts = (entityType === "MEMBER" ? selectedMember : selectedInstitution)?.accounts ?? [];

  const selectedAccount = voluntaryAccounts.find(
    (acc) => acc.id === selectedSourceAccount
  );

  const amountExceedsBalance =
    !!selectedAccount && !!amount && Number(amount) > selectedAccount.balance;

  // Calculate interest and maturity
  const calculateMaturity = () => {
    if (!amount || !termMonths || !interestRate) return null;

    const principal = Number(amount);
    const term = Number(termMonths);
    const rate = interestRate / 100;

    const interest = principal * rate * (term / 12);
    const maturityAmount = principal + interest;

    const startDate = new Date();
    const maturityDate = new Date(startDate);
    maturityDate.setMonth(maturityDate.getMonth() + term);

    return {
      principal,
      interest,
      maturityAmount,
      maturityDate,
    };
  };

  const maturityCalc = calculateMaturity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(entityType === "MEMBER" ? selectedMember : selectedInstitution) || !selectedSourceAccount || !amount || !termMonths) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (Number(amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    if (amountExceedsBalance) {
      toast.error("Amount exceeds the available balance in the selected account");
      return;
    }


    setLoading(true);

    try {
      const response = await fetch("/api/v1/fixed-deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: entityType === "MEMBER" ? selectedMember?.id : undefined,
          institutionId: entityType === "INSTITUTION" ? selectedInstitution?.id : undefined,
          principalAmount: Number(amount),
          termMonths: Number(termMonths),
          sourceAccountId: selectedSourceAccount,
          description: description || `Fixed deposit transfer from ${selectedAccount?.accountNumber}`,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Fixed deposit transfer completed successfully!");
        handleClose();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create fixed deposit");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEntityType("MEMBER");
    setSelectedMember(null);
    setSelectedInstitution(null);
    setSelectedSourceAccount("");
    setAmount("");
    setTermMonths("");
    setDescription("");
    setEntitySelectOpen(false);
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            Create Fixed Deposit Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer funds from voluntary savings to a fixed deposit account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Entity */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium">Step 1: Select Member or Institution</h3>
              </div>

              <Tabs value={entityType} onValueChange={(val: any) => {
                setEntityType(val);
                setSelectedMember(null);
                setSelectedInstitution(null);
                setSelectedSourceAccount("");
                setEntitySelectOpen(false);
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="MEMBER">SACCO Member</TabsTrigger>
                  <TabsTrigger value="INSTITUTION">Institution</TabsTrigger>
                </TabsList>

                <div className="mt-4 space-y-4">
                  <Label>{entityType === "MEMBER" ? "Member" : "Institution"} *</Label>
                  <Popover open={entitySelectOpen} onOpenChange={setEntitySelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={entitySelectOpen}
                        className="w-full justify-between font-normal"
                      >
                        {entityType === "MEMBER"
                          ? selectedMember
                            ? `${selectedMember.user.name} — #${selectedMember.memberNumber}`
                            : "Select member..."
                          : selectedInstitution
                            ? `${selectedInstitution.institutionName} — #${selectedInstitution.institutionNumber}`
                            : "Select institution..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={`Search ${entityType === "MEMBER" ? "by name or member number" : "by name or institution number"}...`}
                        />
                        <CommandList>
                          <CommandEmpty>
                            No {entityType === "MEMBER" ? "member" : "institution"} found.
                          </CommandEmpty>
                          <CommandGroup>
                            {entityType === "MEMBER"
                              ? members.map((member) => (
                                  <CommandItem
                                    key={member.id}
                                    value={`${member.user.name} ${member.memberNumber}`}
                                    onSelect={() => {
                                      setSelectedMember(member);
                                      setSelectedSourceAccount("");
                                      setEntitySelectOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{member.user.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        #{member.memberNumber} &bull; {member.accounts.length} account{member.accounts.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))
                              : institutions.map((inst) => (
                                  <CommandItem
                                    key={inst.id}
                                    value={`${inst.institutionName} ${inst.institutionNumber}`}
                                    onSelect={() => {
                                      setSelectedInstitution(inst);
                                      setSelectedSourceAccount("");
                                      setEntitySelectOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{inst.institutionName}</span>
                                      <span className="text-xs text-muted-foreground">
                                        #{inst.institutionNumber} &bull; {inst.accounts.length} account{inst.accounts.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {(selectedMember || selectedInstitution) && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">
                            {entityType === "MEMBER" ? selectedMember?.user.name : selectedInstitution?.institutionName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            #{entityType === "MEMBER" ? selectedMember?.memberNumber : selectedInstitution?.institutionNumber}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Step 2: Select Source Account */}
          {(selectedMember || selectedInstitution) && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium">Step 2: Select Source Account</h3>
                </div>

                {voluntaryAccounts.length === 0 ? (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        This member has no voluntary savings accounts
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Voluntary Savings Account *</Label>
                    <Select value={selectedSourceAccount} onValueChange={setSelectedSourceAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {voluntaryAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountNumber} - {formatCurrency(account.balance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedAccount && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Account:</span>
                            <p className="font-medium">{selectedAccount.accountNumber}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Available Balance:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(selectedAccount.balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Transfer Details */}
          {selectedSourceAccount && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <DollarSign className="h-4 w-4 text-purple-600" />
                  <h3 className="text-lg font-medium">Step 3: Transfer Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Transfer Amount *</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        const max = selectedAccount?.balance;
                        if (max !== undefined && Number(val) > max) {
                          setAmount(String(max));
                        } else {
                          setAmount(val);
                        }
                      }}
                      min="0"
                      max={selectedAccount?.balance ?? undefined}
                      step="1000"
                      className={amountExceedsBalance ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {amountExceedsBalance && (
                      <p className="text-xs text-red-600">
                        Amount exceeds available balance of {formatCurrency(selectedAccount!.balance)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Term (Months) *</Label>
                    <Select value={termMonths} onValueChange={setTermMonths}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="9">9 Months</SelectItem>
                        <SelectItem value="12">12 Months</SelectItem>
                        <SelectItem value="24">24 Months</SelectItem>
                        <SelectItem value="36">36 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    placeholder="Add notes about this fixed deposit..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Interest Calculation Display */}
                {maturityCalc && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <h4 className="font-medium">Maturity Calculation</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Principal:</span>
                        <p className="font-medium">{formatCurrency(maturityCalc.principal)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interest Rate:</span>
                        <p className="font-medium">{interestRate}% p.a.</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interest Earned:</span>
                        <p className="font-medium text-green-600">
                          {formatCurrency(maturityCalc.interest)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Maturity Amount:</span>
                        <p className="font-medium text-blue-600">
                          {formatCurrency(maturityCalc.maturityAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-muted-foreground text-sm">Maturity Date:</span>
                      <p className="font-medium">
                        {maturityCalc.maturityDate.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !maturityCalc || amountExceedsBalance}>
              {loading ? "Processing..." : "Create Fixed Deposit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
