"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Search,
  User,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import {
  StatementCreateDTO,
  getStatementPeriods,
} from "@/types/statements";
import {
  createStatement as createStatementRequest,
  getInstitutionsForStatements,
  getMembersForStatements,
  getStatementAccounts,
} from "@/lib/api/statements";

type Option = {
  label: string;
  value: string;
};

interface Member {
  id: string;
  memberNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null;
    image: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    accountType: {
      name: string;
    };
  }>;
  _count: {
    transactions: number;
  };
}

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionType: string;
  institutionEmail: string | null;
  institutionPhone: string | null;
  accounts: Array<{
    id: string;
    accountNumber: string;
    accountType: {
      name: string;
    };
  }>;
  _count?: {
    transactions: number;
  };
}

interface StatementAccount {
  id: string;
  accountNumber: string;
  balance: number;
  status?: string;
  accountType: {
    id?: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
    location?: string;
  };
  _count?: {
    accountHolds: number;
  };
}

export default function StatementCreateForm({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}) {
  const { handleSubmit, reset, setValue } = useForm<StatementCreateDTO>();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [accounts, setAccounts] = useState<StatementAccount[]>([]);

  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [institutionSearchOpen, setInstitutionSearchOpen] = useState(false);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Option | null>(null);
  const [selectedSubjectType, setSelectedSubjectType] = useState<Option>({
    label: "Institution",
    value: "INSTITUTION",
  });
  const [selectedScope, setSelectedScope] = useState<Option>({
    label: "All Accounts",
    value: "ALL_ACCOUNTS",
  });
  const [selectedAccount, setSelectedAccount] = useState<Option | null>(null);
  const [customDates, setCustomDates] = useState({
    startDate: "",
    endDate: "",
  });
  const [statementFee, setStatementFee] = useState<string>("");
  const [chargeAccountId, setChargeAccountId] = useState<string>("");

  const predefinedPeriods = useMemo(() => getStatementPeriods(), []);

  const subjectTypeOptions: Option[] = [
    { label: "Institution", value: "INSTITUTION" },
    { label: "Member", value: "MEMBER" },
  ];

  const scopeOptions: Option[] = [
    { label: "All Accounts", value: "ALL_ACCOUNTS" },
    { label: "Specific Account", value: "SINGLE_ACCOUNT" },
  ];

  const periodOptions: Option[] = predefinedPeriods.map((period) => ({
    label: period.label,
    value: period.value,
  }));

  function getAccountTypeDisplayName(name: string) {
    const displayNames: Record<string, string> = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  }

  const accountOptions: Option[] = useMemo(
    () =>
      accounts.map((account) => ({
        label: `${account.accountNumber} • ${getAccountTypeDisplayName(account.accountType.name)}${account._count?.accountHolds ? " • On Hold" : ""}`,
        value: account.id,
      })),
    [accounts],
  );

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      try {
        const [membersResponse, institutionsResponse] = await Promise.all([
          getMembersForStatements(),
          getInstitutionsForStatements(),
        ]);
        setMembers(membersResponse.data || []);
        setInstitutions(institutionsResponse.data || []);
      } catch (error) {
        console.error("Error loading statement form data:", error);
        toast.error("Failed to load statement form data");
      }
    };

    void load();
  }, [isOpen]);

  useEffect(() => {
    setSelectedMember(null);
    setSelectedInstitution(null);
    setSelectedAccount(null);
    setAccounts([]);
  }, [selectedSubjectType]);

  useEffect(() => {
    const subjectId =
      selectedSubjectType.value === "MEMBER"
        ? selectedMember?.id
        : selectedInstitution?.id;

    if (!subjectId) {
      setAccounts([]);
      return;
    }

    const loadAccounts = async () => {
      try {
        const response = await getStatementAccounts(
          selectedSubjectType.value as "MEMBER" | "INSTITUTION",
          subjectId,
        );
        setAccounts(response.data || []);
      } catch (error) {
        console.error("Error loading accounts:", error);
        toast.error("Failed to load accounts");
      }
    };

    void loadAccounts();
  }, [selectedSubjectType, selectedMember, selectedInstitution]);

  useEffect(() => {
    if (!selectedPeriod || selectedPeriod.value === "custom") return;

    const period = predefinedPeriods.find(
      (item) => item.value === selectedPeriod.value,
    );

    if (!period) return;

    setCustomDates({
      startDate: format(period.startDate, "yyyy-MM-dd"),
      endDate: format(period.endDate, "yyyy-MM-dd"),
    });
    setValue("startDate", period.startDate);
    setValue("endDate", period.endDate);
  }, [predefinedPeriods, selectedPeriod, setValue]);

  const handleCustomDateChange = (
    field: "startDate" | "endDate",
    value: string,
  ) => {
    setCustomDates((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (value) {
      setValue(field, new Date(value));
    }
  };

  const handleReset = () => {
    reset();
    setSelectedMember(null);
    setSelectedInstitution(null);
    setSelectedAccount(null);
    setSelectedPeriod(null);
    setSelectedScope({ label: "All Accounts", value: "ALL_ACCOUNTS" });
    setSelectedSubjectType({ label: "Institution", value: "INSTITUTION" });
    setAccounts([]);
    setCustomDates({ startDate: "", endDate: "" });
    setStatementFee("");
    setChargeAccountId("");
    onClose();
  };

  const onSubmit = async () => {
    try {
      setLoading(true);

      const subjectId =
        selectedSubjectType.value === "MEMBER"
          ? selectedMember?.id
          : selectedInstitution?.id;

      if (!subjectId || !selectedPeriod) {
        toast.error("Please select all required fields");
        return;
      }

      if (selectedScope.value === "SINGLE_ACCOUNT" && !selectedAccount?.value) {
        toast.error("Please select the account to generate a statement for");
        return;
      }

      if (!customDates.startDate || !customDates.endDate) {
        toast.error("Please select start and end dates");
        return;
      }

      const startDate = new Date(customDates.startDate);
      const endDate = new Date(customDates.endDate);

      if (startDate >= endDate) {
        toast.error("Start date must be before end date");
        return;
      }

      const feeAmount = statementFee ? parseFloat(statementFee) : 0;

      const result = await createStatementRequest({
        memberId: selectedSubjectType.value === "MEMBER" ? subjectId : undefined,
        institutionId:
          selectedSubjectType.value === "INSTITUTION" ? subjectId : undefined,
        subjectType: selectedSubjectType.value as "MEMBER" | "INSTITUTION",
        scope: selectedScope.value as "ALL_ACCOUNTS" | "SINGLE_ACCOUNT",
        accountId: selectedAccount?.value,
        startDate,
        endDate,
        statementFee: feeAmount > 0 ? feeAmount : undefined,
        chargeAccountId: feeAmount > 0 && chargeAccountId ? chargeAccountId : undefined,
      });

      if (!result.success || result.error) {
        toast.error("Failed to Generate Statement", {
          description: result.error,
        });
        return;
      }

      toast.success("Statement Generated Successfully!", {
        description: `Statement for ${selectedSubjectName} has been created`,
      });

      const statementId = result.data?.id;
      handleReset();

      if (statementId) {
        setTimeout(() => {
          router.push(`/dashboard/statements/${statementId}`);
        }, 800);
      }
    } catch (error) {
      toast.error("Failed to Generate Statement", {
        description:
          error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedSubjectName =
    selectedSubjectType.value === "MEMBER"
      ? selectedMember?.user.name
      : selectedInstitution?.institutionName;

  const selectedSubjectNumber =
    selectedSubjectType.value === "MEMBER"
      ? selectedMember?.memberNumber
      : selectedInstitution?.institutionNumber;

  const transactionCount =
    selectedSubjectType.value === "MEMBER"
      ? selectedMember?._count.transactions || 0
      : selectedInstitution?._count?.transactions || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Account Statement
          </DialogTitle>
          <DialogDescription>
            Generate a statement for a member or institution, either for all
            accounts or one selected account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Statement Subject
                </h3>
              </div>

              <FormSelectInput
                label="Statement For *"
                options={subjectTypeOptions}
                option={selectedSubjectType}
                setOption={setSelectedSubjectType}
              />

              {selectedSubjectType.value === "MEMBER" ? (
                <>
                  <Label>SACCO Member *</Label>
                  <Popover
                    open={memberSearchOpen}
                    onOpenChange={setMemberSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={memberSearchOpen}
                        className="h-16 w-full justify-between px-4 text-left"
                      >
                        {selectedMember ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {selectedMember.user.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              #{selectedMember.memberNumber} •{" "}
                              {selectedMember.accounts.length} accounts
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Search className="h-4 w-4" />
                            <span>Search and select a member...</span>
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[800px] p-0">
                      <Command className="w-full">
                        <CommandInput
                          placeholder="Search members by name, member number, phone, or email..."
                          className="h-12 text-base"
                        />
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup className="max-h-80 overflow-y-auto">
                          {members.map((member) => (
                            <CommandItem
                              key={member.id}
                              onSelect={() => {
                                setSelectedMember(member);
                                setMemberSearchOpen(false);
                              }}
                              className="cursor-pointer p-4 hover:bg-gray-50"
                            >
                              <div className="flex w-full flex-col">
                                <span className="font-medium">
                                  {member.user.name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  #{member.memberNumber} • {member.accounts.length} accounts
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <>
                  <Label>Institution *</Label>
                  <Popover
                    open={institutionSearchOpen}
                    onOpenChange={setInstitutionSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={institutionSearchOpen}
                        className="h-16 w-full justify-between px-4 text-left"
                      >
                        {selectedInstitution ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {selectedInstitution.institutionName}
                            </span>
                            <span className="text-sm text-gray-500">
                              #{selectedInstitution.institutionNumber} •{" "}
                              {selectedInstitution.accounts.length} accounts
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Search className="h-4 w-4" />
                            <span>Search and select an institution...</span>
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[720px] p-0">
                      <Command className="w-full">
                        <CommandInput
                          placeholder="Search institutions by name or number..."
                          className="h-12 text-base"
                        />
                        <CommandEmpty>No institutions found.</CommandEmpty>
                        <CommandGroup className="max-h-80 overflow-y-auto">
                          {institutions.map((institution) => (
                            <CommandItem
                              key={institution.id}
                              onSelect={() => {
                                setSelectedInstitution(institution);
                                setInstitutionSearchOpen(false);
                              }}
                              className="cursor-pointer p-4 hover:bg-gray-50"
                            >
                              <div className="flex w-full flex-col">
                                <span className="font-medium">
                                  {institution.institutionName}
                                </span>
                                <span className="text-sm text-gray-500">
                                  #{institution.institutionNumber} •{" "}
                                  {institution.accounts.length} accounts
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              )}

              {selectedSubjectName && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900">
                        Selected {selectedSubjectType.value === "MEMBER" ? "Member" : "Institution"}
                      </h4>
                      <p className="text-sm text-blue-700">
                        {selectedSubjectName} (#{selectedSubjectNumber}) •{" "}
                        {accounts.length} accounts • {transactionCount} transactions
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedSubjectName && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Statement Setup
                  </h3>
                </div>

                <div className="grid gap-4">
                  <FormSelectInput
                    label="Statement Scope *"
                    options={scopeOptions}
                    option={selectedScope}
                    setOption={setSelectedScope}
                  />

                  {selectedScope.value === "SINGLE_ACCOUNT" && (
                    <FormSelectInput
                      label="Specific Account *"
                      options={accountOptions}
                      option={selectedAccount}
                      setOption={setSelectedAccount}
                    />
                  )}

                  <FormSelectInput
                    label="Statement Period *"
                    options={periodOptions}
                    option={selectedPeriod as Option}
                    setOption={setSelectedPeriod}
                  />

                  {selectedPeriod && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Period Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={customDates.startDate}
                          onChange={(e) =>
                            handleCustomDateChange("startDate", e.target.value)
                          }
                          disabled={selectedPeriod.value !== "custom"}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">Period End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={customDates.endDate}
                          onChange={(e) =>
                            handleCustomDateChange("endDate", e.target.value)
                          }
                          disabled={selectedPeriod.value !== "custom"}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPeriod &&
                    customDates.startDate &&
                    customDates.endDate && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-green-900">
                              Statement Period
                            </h4>
                            <p className="text-sm text-green-700">
                              {format(new Date(customDates.startDate), "PPP")} to{" "}
                              {format(new Date(customDates.endDate), "PPP")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            {selectedSubjectName && accounts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Statement Fee (Optional)
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="statementFee">Fee Amount (UGX)</Label>
                    <Input
                      id="statementFee"
                      type="number"
                      min="0"
                      placeholder="e.g. 2000"
                      value={statementFee}
                      onChange={(e) => setStatementFee(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Leave blank to generate statement without a fee charge.
                    </p>
                  </div>
                  {statementFee && parseFloat(statementFee) > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="chargeAccount">Charge Account *</Label>
                      <select
                        id="chargeAccount"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        value={chargeAccountId}
                        onChange={(e) => setChargeAccountId(e.target.value)}
                      >
                        <option value="">Select account to debit...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountNumber} — {acc.accountType.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">
                        Fee will be deducted from this account before generating the statement.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedSubjectName &&
              selectedPeriod &&
              customDates.startDate &&
              customDates.endDate && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Statement Summary
                    </h3>
                  </div>

                  <div className="rounded-lg border bg-gradient-to-r from-gray-50 to-purple-50 p-6">
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subject:</span>
                          <span className="font-medium">{selectedSubjectName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reference:</span>
                          <span className="font-medium">#{selectedSubjectNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Scope:</span>
                          <span className="font-medium">{selectedScope.label}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Period:</span>
                          <span className="font-medium">{selectedPeriod.label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accounts Covered:</span>
                          <span className="font-medium">
                            {selectedScope.value === "SINGLE_ACCOUNT" ? "1 selected" : accounts.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Transactions:</span>
                          <span className="font-medium">{transactionCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Download className="h-4 w-4" />
                        <span>
                          Held accounts are allowed to generate statements. Institution statements open in preview mode.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
              >
                Cancel
              </Button>
              <SubmitButton title="Generate Statement" loading={loading} />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
