// @ts-nocheck
// components/income/new/IncomeRecordForm.tsx - COMPLETE & FIXED
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { toast } from "sonner";
import {
  Loader2,
  User,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  Receipt,
  Hash,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Plus,
  Phone,
  UserCheck,
  AlertCircle,
  Banknote,
  ShoppingCart,
  Layers,
  ChevronRight,
  Info,
  Search,
} from "lucide-react";

// ✅ Import the CORRECT types from your types file
import type {
  SimpleAccount,
  SimpleBudgetCategory,
  SimpleBranch,
  SimpleMember,
  SimpleInstitution,
} from "@/types/incomes";

import CategoryQuickAdd from "./CategoryQuickAdd";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

// ✅ COMPLETE & CORRECT Interface
interface IncomeFormEditData {
  id: string;
  categoryId: string;
  amount: number;
  recordDate: string;
  description: string;
  branchId?: string;
  memberId?: string;
  accountId?: string;
  receiptNo: string;
  externalRef?: string;
  paymentMethod?: string; // ✅ THIS WAS MISSING
  depositorName?: string;
  depositorContact?: string;
  notes?: string; // ✅ THIS WAS MISSING
}

interface IncomeRecordFormProps {
  isOpen: boolean;
  onClose: () => void;
  categories: SimpleBudgetCategory[];
  branches: SimpleBranch[];
  members: SimpleMember[];
  institutions: SimpleInstitution[];
  accounts: SimpleAccount[];
  userId: string;
  userRole: string;
  editData?: IncomeFormEditData | null;
  isEditMode?: boolean;
}

export default function IncomeRecordForm({
  isOpen,
  onClose,
  categories: initialCategories,
  branches,
  members,
  institutions,
  accounts,
  userId,
  userRole,
  editData,
  isEditMode = false,
}: IncomeRecordFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [incomeSource, setIncomeSource] = useState<
    "member" | "institution" | "other"
  >("other");
  const [selectedEntity, setSelectedEntity] = useState<
    SimpleMember | SimpleInstitution | null
  >(null);
  const [categories, setCategories] =
    useState<SimpleBudgetCategory[]>(initialCategories);

  const [showCategoryAdd, setShowCategoryAdd] = useState(false);
  const [categoryAddParentId, setCategoryAddParentId] = useState<string>("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [institutionSearchOpen, setInstitutionSearchOpen] = useState(false);
  const [parentSearchOpen, setParentSearchOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);

  const [formData, setFormData] = useState({
    categoryId: editData?.categoryId || "",
    amount: editData?.amount || 0,
    recordDate: editData?.recordDate || new Date().toISOString().slice(0, 10),
    description: editData?.description || "",
    branchId: editData?.branchId || "",
    memberId: editData?.memberId || "",
    institutionId: "",
    accountId: editData?.accountId || "",
    receiptNo: editData?.receiptNo || "",
    externalRef: editData?.externalRef || "",
    depositorName: editData?.depositorName || "",
    depositorContact: editData?.depositorContact || "",
  });

  // Filtered and de-duplicated categories from the income tree only
  const filteredCategories = useMemo(() => {
    const allowed = initialCategories.filter((cat) => cat.kind === "INCOME");

    const uniqueMap = new Map<string, SimpleBudgetCategory>();
    
    allowed.forEach(cat => {
      const key = `${cat.name.trim().toLowerCase()}-${cat.parentId || 'root'}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cat);
      } else {
        const existing = uniqueMap.get(key)!;
        if (!existing.code && cat.code) {
            uniqueMap.set(key, cat);
        }
      }
    });

    return Array.from(uniqueMap.values());
  }, [initialCategories]);

  useEffect(() => {
    console.log("🔄 IncomeRecordForm: categories prop updated", initialCategories.length);
    setCategories(filteredCategories);
  }, [filteredCategories]);

  useEffect(() => {
    if (!formData.categoryId || categories.length === 0) return;

    const currentCategory = categories.find((cat) => cat.id === formData.categoryId);
    if (!currentCategory) return;

    if (currentCategory.parentId) {
      setSelectedParentId(currentCategory.parentId);
      setSelectedItemId(currentCategory.id);
    } else {
      setSelectedParentId(currentCategory.id);
      setSelectedItemId("");
    }
  }, [categories, formData.categoryId]);

  const incomeRootCategory = useMemo(
    () =>
      categories.find(
        (cat) =>
          cat.code === "400000" || cat.name.trim().toLowerCase() === "income",
      ) || null,
    [categories],
  );

  const parentCategories = useMemo(() => {
    if (!incomeRootCategory) return [];
    return categories.filter((cat) => cat.parentId === incomeRootCategory.id);
  }, [categories, incomeRootCategory]);

  const selectedParent = parentCategories.find((c) => c.id === selectedParentId);
  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const selectedCategoryIsMainCategory =
    !!selectedCategory && selectedCategory.parentId === incomeRootCategory?.id;

  const getItems = (parentId: string) => {
    const items = categories.filter((cat) => cat.parentId === parentId);
    console.log(`🔍 getItems for parent ${parentId}: found ${items.length} items`, items);
    return items;
  };

  const availableItems = selectedParentId ? getItems(selectedParentId) : [];

  // ... (existing useEffects)

  const handleCategoryCreated = (newCategory: SimpleBudgetCategory) => {
    console.log("🆕 Category created handler in Form:", newCategory);
    
    setCategories((prev) => {
      const exists = prev.some(c => c.id === newCategory.id);
      if (exists || newCategory.kind !== "INCOME") return prev;
      return [...prev, newCategory];
    });

    // If it's a child under a main category, select it as the item
    if (newCategory.parentId && newCategory.parentId !== incomeRootCategory?.id) {
      console.log("👉 Auto-selecting new item:", newCategory.id);
      setSelectedItemId(newCategory.id);
      setSelectedParentId(newCategory.parentId);
      setFormData((prev) => ({ ...prev, categoryId: "" }));
      toast.success(`Item "${newCategory.name}" added!`);
    }
    // If it's a main category under Income root, select it as the main category
    else {
      console.log("👉 Auto-selecting new parent category:", newCategory.id);
      setSelectedParentId(newCategory.id);
      setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
      setSelectedItemId("");
      toast.success(`Category "${newCategory.name}" created!`);
    }
  };

  const openCategoryCreator = (parentId: string) => {
    setCategoryAddParentId(parentId);
    setShowCategoryAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🚀 Form submission started");
    console.log("📋 Form data:", {
      categoryId: formData.categoryId,
      amount: formData.amount,
      recordDate: formData.recordDate,
      memberId: formData.memberId,
      depositorName: formData.depositorName,
    });

    if (!selectedParentId || !formData.amount || !formData.recordDate) {
      toast.error("Please fill in all required fields");
      console.error("❌ Missing required fields");
      return;
    }

    if (!selectedItemId) {
      toast.error("Please create or select a Specific Item under the selected Main Category");
      return;
    }

    setLoading(true);

    try {
      const method = isEditMode ? "PATCH" : "POST";
      console.log(`📞 Calling /api/v1/income API with ${method}...`);

      const response = await fetch("/api/v1/income", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: isEditMode ? editData?.id : undefined,
          categoryId: selectedItemId,
          amount: Number(formData.amount),
          recordDate: formData.recordDate,
          description: formData.description || undefined,
          branchId: formData.branchId || undefined,
          memberId: formData.memberId || undefined,
          accountId: formData.accountId || undefined,
          receiptNo: formData.receiptNo || undefined,
          externalRef: formData.externalRef || undefined,
          depositorName: formData.depositorName || undefined,
          depositorContact: formData.depositorContact || undefined,
          receivedByUserId: userId,
        }),
      });

      const result = await response.json();

      console.log("📥 API response:", result);

      if (!response.ok || result.error) {
        console.error("❌ API returned error:", result.error);
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} income record`);
      }

      console.log(`✅ Income record ${isEditMode ? 'updated' : 'created'} successfully!`, result.data);

      toast.success(`Income record ${isEditMode ? 'updated' : 'created'} successfully`);
      onClose();

      router.refresh();
    } catch (error) {
      console.error("💥 Error creating income record:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create income record"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySelect = (value: string) => {
    if (incomeSource === "member") {
      const member = members.find((m) => m.id === value);
      if (member) {
        setSelectedEntity(member);
        setFormData((prev) => ({ 
            ...prev, 
            memberId: member.id,
            depositorName: member.user.name,
            depositorContact: member.user.phone || undefined
        }));
      }
    } else if (incomeSource === "institution") {
      const institution = institutions.find((i) => i.id === value);
      if (institution) {
        setSelectedEntity(institution);
        setFormData((prev) => ({ 
            ...prev, 
            institutionId: institution.id,
            depositorName: institution.institutionName,
            depositorContact: institution.primaryContactPhone
        }));
      }
    }
  };

  const handleCategorySelect = (value: string) => {
    console.log("📂 Main Category selected:", value);
    setSelectedParentId(value);
    setSelectedItemId("");
    setFormData((prev) => ({
      ...prev,
      categoryId: "",
    }));
  };

  const handleItemSelect = (value: string) => {
    console.log("🔖 Item selected:", value);
    if (value === "create-new") {
      openCategoryCreator(selectedParentId || incomeRootCategory?.id || "");
      return;
    }
    setSelectedItemId(value);
    setFormData(prev => ({ ...prev, categoryId: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };



  // Type guards
  const isMember = (entity: any): entity is SimpleMember => {
    return entity && 'memberNumber' in entity;
  };

  const isInstitution = (entity: any): entity is SimpleInstitution => {
    return entity && 'institutionNumber' in entity;
  };

  const filteredAccounts = useMemo(() => {
    if (incomeSource === "member" && formData.memberId) {
      return accounts.filter((acc) => acc.member?.id === formData.memberId);
    } else if (incomeSource === "institution" && formData.institutionId) {
      return accounts.filter((acc) => acc.institution?.id === formData.institutionId);
    }
    return [];
  }, [incomeSource, formData.memberId, formData.institutionId, accounts]);

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === formData.accountId);
  }, [formData.accountId, accounts]);

  const getEntityDisplayName = () => {
    if (incomeSource === "member" && isMember(selectedEntity)) {
      return selectedEntity.user.name;
    } else if (
      incomeSource === "institution" &&
      isInstitution(selectedEntity)
    ) {
      return selectedEntity.institutionName;
    } else if (incomeSource === "other") {
      return formData.depositorName || "Other Income Source";
    }
    return "Not specified";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl">
                  {isEditMode ? "Edit Income Record" : "Record New Income"}
                </DialogTitle>
                <DialogDescription>
                  Record income with smart categorization - items are created
                  automatically
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Step 1: Income Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-blue-600" />
                  Step 1: Income Source (Optional)
                </CardTitle>
                <CardDescription>
                  Select the source of this income, or skip to record general
                  income
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={incomeSource}
                  onValueChange={(value) => {
                    const newSource = value as
                      | "member"
                      | "institution"
                      | "other";
                    setIncomeSource(newSource);
                    setSelectedEntity(null);
                    setFormData((prev) => ({
                      ...prev,
                      memberId: "",
                      institutionId: "",
                      accountId: "",
                      depositorName: "",
                      depositorContact: "",
                    }));
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="member" disabled={isEditMode}>
                      <User className="h-4 w-4 mr-2" />
                      Member
                    </TabsTrigger>
                    <TabsTrigger value="institution" disabled={isEditMode}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Institution
                    </TabsTrigger>
                    <TabsTrigger value="other" disabled={isEditMode}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Other Source
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="member" className="space-y-4 mt-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Select a member if this income is from membership fees,
                        deposits, or member-related transactions
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                       <Label htmlFor="memberId">Select Member</Label>
                       <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                         <PopoverTrigger asChild>
                           <Button
                             variant="outline"
                             role="combobox"
                             aria-expanded={memberSearchOpen}
                             className="w-full justify-between h-12 px-4 text-left font-normal"
                           >
                             {selectedEntity && isMember(selectedEntity) ? (
                               <div className="flex items-center gap-2">
                                 <User className="h-4 w-4 text-gray-400" />
                                 <span className="font-medium">{selectedEntity.user.name}</span>
                                 <Badge variant="outline" className="text-xs">{selectedEntity.memberNumber}</Badge>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 text-gray-500">
                                 <Search className="h-4 w-4" />
                                 <span>Search and select a member...</span>
                               </div>
                             )}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-[400px] lg:w-[500px] p-0" align="start">
                           <Command className="w-full">
                             <CommandInput placeholder="Search members by name, number, phone..." className="h-10 text-sm" />
                             <CommandEmpty>No members found.</CommandEmpty>
                             <CommandGroup className="max-h-60 overflow-y-auto">
                               {members.map((member) => (
                                 <CommandItem
                                   key={member.id}
                                   value={`${member.user.name} ${member.memberNumber} ${member.user.phone || ''} ${member.user.email || ''}`}
                                   onSelect={() => {
                                     handleEntitySelect(member.id);
                                     setMemberSearchOpen(false);
                                   }}
                                   className="p-3 cursor-pointer"
                                 >
                                   <div className="flex items-center gap-3 w-full">
                                     <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                                       <User className="h-4 w-4" />
                                     </div>
                                     <div className="flex flex-col flex-1 min-w-0">
                                       <div className="flex items-center justify-between w-full">
                                         <span className="font-medium truncate">{member.user.name}</span>
                                       </div>
                                       <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                         <span className="font-mono">#{member.memberNumber}</span>
                                       </div>
                                     </div>
                                   </div>
                                 </CommandItem>
                               ))}
                             </CommandGroup>
                           </Command>
                         </PopoverContent>
                       </Popover>
                     </div>

                    {isMember(selectedEntity) && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-semibold text-green-900">
                                {selectedEntity.user.name}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-green-700">
                                <span>{selectedEntity.memberNumber}</span>
                                {selectedEntity.user.email && (
                                  <span>{selectedEntity.user.email}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="institution" className="space-y-4 mt-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Select an institution if this income is from
                        institutional fees, grants, or partnerships
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                       <Label htmlFor="institutionId">Select Institution</Label>
                       <Popover open={institutionSearchOpen} onOpenChange={setInstitutionSearchOpen}>
                         <PopoverTrigger asChild>
                           <Button
                             variant="outline"
                             role="combobox"
                             aria-expanded={institutionSearchOpen}
                             className="w-full justify-between h-12 px-4 text-left font-normal"
                           >
                             {selectedEntity && isInstitution(selectedEntity) ? (
                               <div className="flex items-center gap-2">
                                 <Building2 className="h-4 w-4 text-gray-400" />
                                 <span className="font-medium">{selectedEntity.institutionName}</span>
                                 <Badge variant="outline" className="text-xs">{selectedEntity.institutionNumber}</Badge>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 text-gray-500">
                                 <Search className="h-4 w-4" />
                                 <span>Search and select an institution...</span>
                               </div>
                             )}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-[400px] lg:w-[500px] p-0" align="start">
                           <Command className="w-full">
                             <CommandInput placeholder="Search institutions by name or number..." className="h-10 text-sm" />
                             <CommandEmpty>No institutions found.</CommandEmpty>
                             <CommandGroup className="max-h-60 overflow-y-auto">
                               {institutions.map((institution) => (
                                 <CommandItem
                                   key={institution.id}
                                   value={`${institution.institutionName} ${institution.institutionNumber} ${institution.primaryContactPhone || ''}`}
                                   onSelect={() => {
                                     handleEntitySelect(institution.id);
                                     setInstitutionSearchOpen(false);
                                   }}
                                   className="p-3 cursor-pointer"
                                 >
                                   <div className="flex items-center gap-3 w-full">
                                     <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                                       <Building2 className="h-4 w-4" />
                                     </div>
                                     <div className="flex flex-col flex-1 min-w-0">
                                       <div className="flex items-center justify-between w-full">
                                         <span className="font-medium truncate">{institution.institutionName}</span>
                                       </div>
                                       <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                         <span className="font-mono">#{institution.institutionNumber}</span>
                                       </div>
                                     </div>
                                   </div>
                                 </CommandItem>
                               ))}
                             </CommandGroup>
                           </Command>
                         </PopoverContent>
                       </Popover>
                     </div>

                    {isInstitution(selectedEntity) && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-semibold text-green-900">
                                {selectedEntity.institutionName}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {selectedEntity.institutionType}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="other" className="space-y-4 mt-4">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Record income from asset sales, investments, donations,
                        service fees, and more
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>

                {(formData.memberId || formData.institutionId) &&
                  filteredAccounts.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Label htmlFor="accountId">
                          Link to Account (Optional)
                        </Label>
                        <Select
                          value={formData.accountId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              accountId: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select an account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex items-center gap-2">
                                  <Wallet className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium">
                                    {account.accountNumber}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {account.accountType?.name}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {formatCurrency(account.balance)}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Step 2: Category & Amount */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Step 2: Category & Transaction Details
                </CardTitle>
                <CardDescription>
                  Select category, then item will appear automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Main Category *
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCategoryAdd(true)}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        New
                      </Button>
                    </Label>
                    <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={parentSearchOpen}
                          className="w-full justify-between h-12 px-4 text-left font-normal"
                        >
                          {selectedParent ? (
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{selectedParent.name}</span>
                              {selectedParent.code && (
                                <Badge variant="outline" className="text-xs">
                                  {selectedParent.code}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Search className="h-4 w-4" />
                              <span>Select category...</span>
                            </div>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search main categories..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No categories found.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-y-auto">
                              {parentCategories.map((cat) => (
                                <CommandItem
                                  key={cat.id}
                                  value={`${cat.name} ${cat.code || ""}`.toLowerCase()}
                                  onSelect={() => {
                                    handleCategorySelect(cat.id);
                                    setParentSearchOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-gray-400" />
                                    <span className="font-medium">{cat.name}</span>
                                    {cat.code && (
                                      <Badge variant="outline" className="text-xs">
                                        {cat.code}
                                      </Badge>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="create-new-main"
                                onSelect={() => {
                                  openCategoryCreator(incomeRootCategory?.id || "");
                                  setParentSearchOpen(false);
                                }}
                                className="cursor-pointer text-green-600 font-medium"
                              >
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  <span>Create New Main Category</span>
                                </div>
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedParentId && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4" />
                        Specific Item{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={itemSearchOpen}
                            className="w-full justify-between h-12 px-4 text-left font-normal"
                          >
                            {selectedCategory && selectedCategory.id !== selectedParentId ? (
                              <div className="flex flex-col items-start w-full py-1">
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold tracking-tight mb-1">
                                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                                  <span>{selectedParent?.name}</span>
                                </div>
                                <div className="flex items-start gap-0 h-8">
                                  <div className="flex flex-col items-center w-6 h-full">
                                    <div className="w-[2px] h-3 bg-slate-200" />
                                    <div className="w-4 h-[2px] bg-slate-200 ml-4" />
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-black text-[11px] px-2 py-0.5 rounded-md shadow-sm">
                                      {selectedCategory?.name || "Unknown Item"}
                                    </Badge>
                                    {selectedCategory?.code && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        [{selectedCategory.code}]
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500">
                                <Search className="h-4 w-4" />
                                <span>{availableItems.length > 0 ? "Select item..." : "No items - Create one"}</span>
                              </div>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search items..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>No items found.</CommandEmpty>
                              <CommandGroup className="max-h-60 overflow-y-auto">
                                {availableItems.map((cat) => (
                                  <CommandItem
                                    key={cat.id}
                                    value={`${cat.name} ${cat.code || ""}`.toLowerCase()}
                                    onSelect={() => {
                                      handleItemSelect(cat.id);
                                      setItemSearchOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ChevronRight className="h-3 w-3 text-gray-400" />
                                      <span>{cat.name}</span>
                                      {cat.code && (
                                        <Badge variant="secondary" className="text-xs">
                                          {cat.code}
                                        </Badge>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                                <CommandItem
                                  value="create-new"
                                  onSelect={() => {
                                    handleItemSelect("create-new");
                                    setItemSearchOpen(false);
                                  }}
                                  className="cursor-pointer text-green-600 font-medium"
                                >
                                  <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Create New Item under {selectedParent?.name}</span>
                                  </div>
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <p className="text-xs text-muted-foreground">
                        {availableItems.length > 0
                          ? `${availableItems.length} item(s) under ${selectedParent?.name}`
                          : `No items yet under ${selectedParent?.name} - click above to create`}
                      </p>
                    </div>
                  )}

                  {formData.categoryId && selectedCategory && (
                    <div className="md:col-span-2 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          ✓ Selected:
                          {selectedCategoryIsMainCategory ? (
                            <>
                              <strong className="ml-1">
                                {selectedCategory.name}
                              </strong>
                            </>
                          ) : (
                            <>
                              {" "}
                              {selectedParent?.name}
                              {selectedCategory.parentId && (
                                <>
                                  <ChevronRight className="inline h-3 w-3 mx-1" />
                                  <strong>{selectedCategory.name}</strong>
                                </>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (UGX) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.amount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="pl-9 h-12"
                        placeholder="Enter amount"
                        required
                      />
                    </div>
                    {formData.amount > 0 && (
                      <p className="text-sm font-medium text-green-600">
                        {formatCurrency(formData.amount)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recordDate">Transaction Date *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="recordDate"
                        type="date"
                        value={formData.recordDate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            recordDate: e.target.value,
                          }))
                        }
                        className="pl-9 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositorName">Payer Name</Label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="depositorName"
                        type="text"
                        value={formData.depositorName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            depositorName: e.target.value,
                          }))
                        }
                        className="pl-9 h-12"
                        placeholder="Name of person paying"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositorContact">Payer Contact</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="depositorContact"
                        type="text"
                        value={formData.depositorContact}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            depositorContact: e.target.value,
                          }))
                        }
                        className="pl-9 h-12"
                        placeholder="Phone or email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receiptNo">Receipt Number</Label>
                    <div className="relative">
                      <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="receiptNo"
                        type="text"
                        value={formData.receiptNo}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            receiptNo: e.target.value,
                          }))
                        }
                        className="pl-9 h-12"
                        placeholder="Receipt #"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="externalRef">Reference Number</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="externalRef"
                        type="text"
                        value={formData.externalRef}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            externalRef: e.target.value,
                          }))
                        }
                        className="pl-9 h-12"
                        placeholder="Bank ref, transaction ID, etc."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branchId">Branch</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, branchId: value }))
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select branch..." />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>{branch.name}</span>
                              <span className="text-sm text-gray-500">
                                {branch.location}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="description">Description / Notes</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Additional details about this income..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            {formData.categoryId && formData.amount > 0 && (
              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Transaction Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Category</p>
                        <p className="font-semibold text-gray-900">
                          {selectedParent?.name}
                          {selectedCategory?.parentId && (
                            <>
                              {" → "}
                              <span className="text-green-600">
                                {selectedCategory.name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(formData.amount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(formData.recordDate).toLocaleDateString(
                            "en-UG",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Income Source</p>
                        <p className="font-medium text-gray-900">
                          {incomeSource === "member" && "Member Payment"}
                          {incomeSource === "institution" &&
                            "Institution Payment"}
                          {incomeSource === "other" && "Other Income"}
                        </p>
                      </div>

                      {(formData.memberId || formData.institutionId) && (
                        <div>
                          <p className="text-sm text-gray-600">From</p>
                          <p className="font-medium text-gray-900">
                            {getEntityDisplayName()}
                          </p>
                        </div>
                      )}

                      {formData.accountId && selectedAccount && (
                        <div>
                          <p className="text-sm text-gray-600">
                            Linked Account
                          </p>
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {selectedAccount.accountNumber}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {selectedAccount.accountType?.name}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {formData.receiptNo && (
                        <div>
                          <p className="text-sm text-gray-600">Receipt #</p>
                          <p className="font-mono text-sm font-medium text-gray-900">
                            {formData.receiptNo}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="min-w-[120px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  !formData.categoryId ||
                  !formData.amount ||
                  !formData.recordDate
                }
                className="min-w-[120px] bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isEditMode ? "Update Income" : "Record Income"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Quick Add Dialog */}
      {showCategoryAdd && (
        <CategoryQuickAdd
          isOpen={showCategoryAdd}
          onClose={() => {
            setShowCategoryAdd(false);
            setCategoryAddParentId("");
          }}
          onCategoryCreated={handleCategoryCreated}
          parentCategories={parentCategories}
          allCategories={categories}
          defaultParentId={categoryAddParentId || selectedParentId || incomeRootCategory?.id || undefined}
          rootCategoryId={incomeRootCategory?.id || undefined}
          rootCategoryName={incomeRootCategory?.name || "Income"}
          kind="INCOME"
        />
      )}
    </>
  );
}
