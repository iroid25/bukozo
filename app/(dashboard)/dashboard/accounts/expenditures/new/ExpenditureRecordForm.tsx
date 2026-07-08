// app/dashboard/expenditure/new/ExpenditureRecordForm.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ChevronRight,
  Layers,
  Loader2,
  DollarSign,
  Building,
  Calendar,
  FileText,
  Receipt,
  Tag,
  CheckCircle,
  Plus,
  User,
  AlertCircle,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  generateNextExpenseCategoryCode,
  getExpenseRootCategory,
} from "@/lib/expenditure/category-code";
// import {
//   updateExpenditureRecord,
// } from "@/actions/incomeandexp/expenditure";
import { PaymentMethod, UserRole } from "@prisma/client";

interface Category {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  children?: Category[];
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface ExpenditureRecord {
  id?: string;
  categoryId: string;
  amount: number;
  recordDate: string;
  description?: string;
  payee?: string;
  paymentMethod?: PaymentMethod;
  branchId?: string;
  voucherNo?: string;
  externalRef?: string;
}

interface ExpenditureRecordFormProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  branches: Branch[];
  userId: string;
  userRole: UserRole;
  userBranchId?: string;
  editData?: ExpenditureRecord | null;
  isEditMode?: boolean;
}

interface NewCategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (category: Category, subItem?: Category | null) => void;
  userRole: UserRole;
  rootCategoryId: string;
  suggestedCode?: string | null;
  suggestedItemCode?: string | null;
}

function NewCategoryForm({
  isOpen,
  onClose,
  onSuccess,
  userRole,
  rootCategoryId,
  suggestedCode,
  suggestedItemCode,
}: NewCategoryFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [loading, setLoading] = useState(false);

  const canCreateCategory = Boolean(userRole);

  useEffect(() => {
    if (isOpen) {
      setCode(suggestedCode || "");
      setItemCode(suggestedItemCode || "");
    }
  }, [isOpen, suggestedCode, suggestedItemCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setLoading(true);
    try {
      // API call for Parent Category
      const response = await fetch("/api/v1/expenditure/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind: "EXPENSE",
          isActive: true,
          parentId: rootCategoryId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create category");
      }

      let subItem = null;
      if (itemName.trim()) {
        // API call for optional first Item
        const subResponse = await fetch("/api/v1/expenditure/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            kind: "EXPENSE",
            isActive: true,
            parentId: result.data.id,
          }),
        });
        const subResult = await subResponse.json();
        if (subResponse.ok && subResult.success) {
          subItem = subResult.data;
        }
      }

      toast.success("Expense category created successfully!");
      onSuccess(result.data, subItem);
      setName("");
      setCode("");
      setItemName("");
      setItemCode("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setCode("");
    setItemName("");
    setItemCode("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Expense Category
          </DialogTitle>
          <DialogDescription>
            Create a new parent expense category
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoryName">
              Category Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="categoryName"
              placeholder="e.g., Utilities, Salaries, Office Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canCreateCategory}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryCode">
              Category Code
            </Label>
            <Input
              id="categoryCode"
              placeholder="Auto-generated"
              value={code}
              readOnly
              disabled={!canCreateCategory}
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated from the expense hierarchy
            </p>
          </div>

          <div className="pt-4 border-t space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add First Item (Optional)
            </h4>
            <div className="space-y-2">
              <Label htmlFor="firstItemName">Item Name</Label>
              <Input
                id="firstItemName"
                placeholder="e.g., Water Bill, Internet Bill"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                disabled={!canCreateCategory}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstItemCode">Item Code</Label>
              <Input
                id="firstItemCode"
                placeholder="Auto-generated after parent save"
                value={itemCode}
                readOnly
                disabled={!canCreateCategory}
              />
              <p className="text-xs text-muted-foreground">
                This follows the new parent category code automatically.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canCreateCategory}>
              {loading ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface NewSubCategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  parentCategory: Category | null;
  onSuccess: (category: Category) => void;
  userRole: UserRole;
  suggestedCode?: string | null;
}

function NewSubCategoryForm({
  isOpen,
  onClose,
  parentCategory,
  onSuccess,
  userRole,
  suggestedCode,
}: NewSubCategoryFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const canCreateSubCategory = Boolean(userRole);

  useEffect(() => {
    if (isOpen) {
      setCode(suggestedCode || "");
    }
  }, [isOpen, suggestedCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentCategory) {
      toast.error("Please select a category first");
      return;
    }

    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/expenditure/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: parentCategory.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create item");
      }

      toast.success("Expense item created successfully!");
      onSuccess(result.data);
      setName("");
      setCode("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create item");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setCode("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Expense Item
          </DialogTitle>
          <DialogDescription>
            {parentCategory
              ? `Add a new item to "${parentCategory.name}"`
              : "Add a new expense item"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemName">
              Item Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="itemName"
              placeholder="e.g., Water Bill, Internet Bill"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canCreateSubCategory}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemCode">
              Item Code{" "}
              <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="itemCode"
              placeholder="Auto-generated"
              value={code}
              readOnly
              disabled={!canCreateSubCategory}
            />
            <p className="text-xs text-muted-foreground">
              Generated from the selected parent category
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canCreateSubCategory}>
              {loading ? "Creating..." : "Create Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpenditureRecordForm({
  isOpen,
  onClose,
  categories: initialCategories,
  branches: initialBranches,
  userId,
  userRole,
  userBranchId,
  editData,
  isEditMode = false,
}: ExpenditureRecordFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenditureRecord>();

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<Category | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>(PaymentMethod.CASH);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [showNewSubCategoryDialog, setShowNewSubCategoryDialog] =
    useState(false);

  const router = useRouter();
  const watchedValues = watch();

  const canCreateParentCategory = Boolean(userRole);

  const expenseRootCategory = useMemo(
    () => getExpenseRootCategory(categories),
    [categories],
  );

  const suggestedParentCategoryCode = useMemo(() => {
    if (!expenseRootCategory) return null;
    return generateNextExpenseCategoryCode(
      categories,
      expenseRootCategory.id,
      expenseRootCategory.id,
    );
  }, [categories, expenseRootCategory]);

  const suggestedFirstItemCode = useMemo(() => {
    if (!suggestedParentCategoryCode) return null;
    const parsed = Number(suggestedParentCategoryCode);
    if (!Number.isFinite(parsed)) return null;
    return String(parsed + 1);
  }, [suggestedParentCategoryCode]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    // Fetch branches if not provided OR if provided as empty array
    if (!initialBranches || (Array.isArray(initialBranches) && initialBranches.length === 0)) {
      loadBranches();
    } else {
      setBranches(initialBranches);
    }
  }, [initialBranches]);

  const loadBranches = async () => {
    try {
      const response = await fetch("/api/v1/expenditure/branches");
      const result = await response.json();
      if (result.data) {
        setBranches(Array.isArray(result.data) ? result.data : [result.data]);
      }
    } catch (error) {
      console.error("Failed to fetch branches in form:", error);
    }
  };

  // Handle auto-branch selection for non-admins
  useEffect(() => {
    if (!isEditMode && branches.length > 0) {
      // Preference 1: Match by userBranchId
      const targetBranchId = userBranchId;
      if (userRole !== UserRole.ADMIN && targetBranchId) {
        const foundBranch = branches.find((b) => b.id === targetBranchId);
        if (foundBranch) {
          setSelectedBranch(foundBranch);
          setValue("branchId", targetBranchId);
          return;
        }
      }

      // Preference 2: If only one branch exists and user is not admin, select it
      if (userRole !== UserRole.ADMIN && branches.length === 1) {
        setSelectedBranch(branches[0]);
        setValue("branchId", branches[0].id);
        return;
      }
    }
  }, [userRole, userBranchId, branches, isEditMode, setValue]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getChildCategories = (parentId: string): Category[] => {
    return categories.filter((cat) => cat.parentId === parentId);
  };

  const getParentCategories = (): Category[] => {
    if (!expenseRootCategory) return [];
    return categories.filter((cat) => cat.parentId === expenseRootCategory.id);
  };

  const suggestedItemCode = useMemo(() => {
    if (!selectedCategory || !expenseRootCategory) return null;
    return generateNextExpenseCategoryCode(
      categories,
      selectedCategory.id,
      expenseRootCategory.id,
    );
  }, [categories, expenseRootCategory, selectedCategory]);

  const handleNewCategorySuccess = (
    newCategory: Category,
    subItem?: Category | null
  ) => {
    if (subItem) {
      setCategories((prev) => [...prev, newCategory, subItem]);
      setSelectedCategory(newCategory);
      setSelectedSubCategory(subItem);
      setValue("categoryId", subItem.id);
      toast.success("Category and initial item added and selected!");
    } else {
      setCategories((prev) => [...prev, newCategory]);
      setSelectedCategory(newCategory);
      setSelectedSubCategory(null);
      setValue("categoryId", newCategory.id);
      toast.success("Category added and selected!");
    }
  };

  const handleNewSubCategorySuccess = (newCategory: Category) => {
    setCategories((prev) => [...prev, newCategory]);
    setSelectedSubCategory(newCategory);
    setValue("categoryId", newCategory.id);
    toast.success("Item added and selected!");
  };

  useEffect(() => {
    if (isOpen && isEditMode && editData) {
      setValue("categoryId", editData.categoryId);
      setValue("amount", editData.amount);
      setValue("recordDate", editData.recordDate);
      setValue("description", editData.description || "");
      setValue("payee", editData.payee || "");
      setValue("branchId", editData.branchId || "");
      setValue("voucherNo", editData.voucherNo || "");
      setValue("externalRef", editData.externalRef || "");

      const category = categories.find((c) => c.id === editData.categoryId);
      if (category) {
        if (category.parentId) {
          const parent = categories.find((c) => c.id === category.parentId);
          setSelectedCategory(parent || null);
          setSelectedSubCategory(category);
        } else {
          setSelectedCategory(category);
          setSelectedSubCategory(null);
        }
      }

      if (editData.branchId) {
        const branch = branches.find((b) => b.id === editData.branchId);
        if (branch) setSelectedBranch(branch);
      }

      if (editData.paymentMethod) {
        setSelectedPaymentMethod(editData.paymentMethod);
      }
    } else if (isOpen && !isEditMode) {
      setValue("recordDate", new Date().toISOString().split("T")[0]);
    }
  }, [isOpen, isEditMode, editData, categories, branches, setValue]);

  const saveExpenditureRecord = async (data: ExpenditureRecord) => {
    try {
      setLoading(true);

      const finalCategoryId = selectedSubCategory?.id || selectedCategory?.id;

      if (!finalCategoryId) {
        toast.error("Please select an expense category and item");
        setLoading(false);
        return;
      }

      const formData = {
        ...(isEditMode && editData?.id ? { id: editData.id } : {}),
        categoryId: finalCategoryId,
        amount: Number(data.amount),
        recordDate: new Date(data.recordDate),
        description: data.description?.trim() || undefined,
        payee: data.payee?.trim() || undefined,
        paymentMethod: selectedPaymentMethod,
        branchId: data.branchId || selectedBranch?.id || undefined,
        voucherNo: data.voucherNo?.trim() || undefined,
        externalRef: data.externalRef?.trim() || undefined,
        submittedByUserId: userId,
      };

      const response = isEditMode
        ? await fetch("/api/v1/expenditure", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/v1/expenditure", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error(
          `Failed to ${isEditMode ? "Update" : "Create"} Expenditure Record`,
          {
            description: result.error || "An unexpected error occurred",
          }
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      const categoryName = selectedSubCategory?.name || selectedCategory?.name;
      toast.success(
        `Expenditure Record ${isEditMode ? "Updated" : "Created"} Successfully!`,
        {
          description: `Amount: ${formatCurrency(Number(data.amount))} for ${categoryName}${!isEditMode ? " - Pending approval" : ""}`,
        }
      );

      handleReset();
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
      setLoading(false);
      console.error(error);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setSelectedBranch(null);
    setSelectedPaymentMethod(PaymentMethod.CASH);
    onClose();
  };

  // Combo-box state
  const [parentSearchOpen, setParentSearchOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);

  // Derived categories
  const parentCategories = useMemo(
    () => getParentCategories(),
    [categories, expenseRootCategory]
  );
  
  const availableItems = useMemo(
    () => (selectedCategory ? categories.filter((c) => c.parentId === selectedCategory.id) : []),
    [categories, selectedCategory]
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {isEditMode
                ? "Edit Expenditure Record"
                : "Record New Expenditure"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the expenditure record details below"
                : "Enter the details of the expenditure transaction"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(saveExpenditureRecord)}>
            <div className="space-y-8">
              {/* Category & Amount */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Tag className="h-4 w-4 text-red-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Expenditure Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Selection with Searchable Combobox */}
                  <div className="space-y-3">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Parent Category *
                      </span>
                      {canCreateParentCategory && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-blue-600 px-1"
                          onClick={() => setShowNewCategoryDialog(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          New
                        </Button>
                      )}
                    </Label>
                    <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={parentSearchOpen}
                          className="w-full justify-between h-12 px-4 text-left font-normal"
                        >
                          {selectedCategory ? (
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{selectedCategory.name}</span>
                              {selectedCategory.code && (
                                <Badge variant="outline" className="text-xs">
                                  {selectedCategory.code}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Search className="h-4 w-4" />
                              <span>Select category...</span>
                            </div>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search parent categories..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No categories found.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-y-auto">
                              {parentCategories.map((cat) => (
                                <CommandItem
                                  key={cat.id}
                                  value={`${cat.name} ${cat.code || ""}`.toLowerCase()}
                                  onSelect={() => {
                                    setSelectedCategory(cat);
                                    setSelectedSubCategory(null);
                                    setValue("categoryId", "");
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
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Item Selection with Searchable Combobox */}
                  {selectedCategory && (
                    <div className="space-y-3">
                      <Label className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4" />
                          Expenditure Item *
                        </span>
                        {Boolean(userRole) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-green-600 px-1"
                            onClick={() => setShowNewSubCategoryDialog(true)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            New
                          </Button>
                        )}
                      </Label>
                      <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={itemSearchOpen}
                            className="w-full justify-between h-12 px-4 text-left font-normal"
                          >
                            {selectedSubCategory ? (
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3 text-gray-400" />
                                <span className="text-gray-900 font-medium">{selectedSubCategory.name}</span>
                                {selectedSubCategory.code && (
                                  <Badge variant="outline" className="text-xs">
                                    {selectedSubCategory.code}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
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
                                      setSelectedSubCategory(cat);
                                      setValue("categoryId", cat.id);
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
                                {Boolean(userRole) && (
                                  <CommandItem
                                    value="create-new"
                                    onSelect={() => {
                                      setShowNewSubCategoryDialog(true);
                                      setItemSearchOpen(false);
                                    }}
                                    className="cursor-pointer text-green-600 font-medium"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4" />
                                      <span>Create New Item under {selectedCategory.name}</span>
                                    </div>
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      <p className="text-xs text-muted-foreground">
                        {availableItems.length > 0
                          ? `${availableItems.length} item(s) under ${selectedCategory.name}`
                          : `No specific items yet under ${selectedCategory.name}`}
                      </p>
                    </div>
                  )}
                  {!selectedCategory && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-gray-400">
                        <ChevronRight className="h-4 w-4" />
                        Expenditure Item *
                      </Label>
                      <div className="h-12 flex items-center px-4 border border-dashed rounded-md bg-gray-50 text-xs text-gray-400 italic">
                        Select a category first
                      </div>
                    </div>
                  )}
                </div>

                <TextInput
                  register={register}
                  errors={errors}
                  label="Amount (UGX) *"
                  name="amount"
                  type="number"
                  icon={DollarSign}
                  placeholder="0"
                  // @ts-ignore
                  min="0"
                  step="0.01"
                />

                <TextInput
                  register={register}
                  errors={errors}
                  label="Transaction Date *"
                  name="recordDate"
                  type="date"
                  icon={Calendar}
                />
              </div>

              {/* Payee & Payment Method */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <User className="h-4 w-4 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Payment Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Payee"
                    name="payee"
                    type="text"
                    icon={User}
                    placeholder="Name of recipient/vendor"
                  />

                  <div className="space-y-3">
                    <Label>Payment Method</Label>
                    <Select
                      value={selectedPaymentMethod}
                      onValueChange={(value) =>
                        setSelectedPaymentMethod(value as PaymentMethod)
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK">Bank Transfer</SelectItem>
                        <SelectItem value="MOBILE_MONEY">
                          Mobile Money
                        </SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Branch & References */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Building className="h-4 w-4 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Additional Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRole === UserRole.ADMIN ? (
                    <div className="space-y-3">
                      <Label>Branch Location</Label>
                      <Select
                        value={selectedBranch?.id || ""}
                        onValueChange={(value) => {
                          const branch = branches.find((b) => b.id === value);
                          setSelectedBranch(branch || null);
                          setValue("branchId", value);
                        }}
                      >
                        <SelectTrigger className="h-12 flex-1">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{branch.name}</span>
                                <span className="text-sm text-gray-500">{branch.location}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label>Branch Location</Label>
                      <Input
                        value={selectedBranch?.name || (branches.length > 0 ? branches[0].name : "Branch Auto-Assigned")}
                        readOnly
                        className="h-12 bg-gray-50 text-gray-500 font-medium"
                      />
                       <input type="hidden" {...register("branchId")} />
                    </div>
                  )}

                  <TextInput
                    register={register}
                    errors={errors}
                    label="Voucher Number"
                    name="voucherNo"
                    type="text"
                    icon={Receipt}
                    placeholder="VCH-12345"
                  />
                </div>

                <TextInput
                  register={register}
                  errors={errors}
                  label="External Reference"
                  name="externalRef"
                  type="text"
                  icon={FileText}
                  placeholder="External reference ID (optional)"
                />

                <div className="space-y-3">
                  <Label>Description</Label>
                  <textarea
                    {...register("description")}
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter additional details about this expenditure..."
                  />
                </div>
              </div>

              {/* Summary */}
              {(selectedSubCategory || selectedCategory) &&
                watchedValues.amount && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <h3 className="text-lg font-medium text-gray-900">
                        Transaction Summary
                      </h3>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-red-50 p-6 rounded-lg border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 text-xs uppercase tracking-wider">Main Category:</span>
                            <span className="font-bold text-gray-900">
                              {selectedCategory?.name}
                            </span>
                          </div>
                          {selectedSubCategory && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 text-xs uppercase tracking-wider">Expenditure Item:</span>
                              <span className="font-medium text-blue-700">
                                {selectedSubCategory.name}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-medium text-red-600">
                              {formatCurrency(
                                Number(watchedValues.amount) || 0
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Date:</span>
                            <span className="font-medium">
                              {watchedValues.recordDate
                                ? new Date(
                                    watchedValues.recordDate
                                  ).toLocaleDateString()
                                : "-"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {watchedValues.payee && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Payee:</span>
                              <span className="font-medium">
                                {watchedValues.payee}
                              </span>
                            </div>
                          )}
                          {selectedPaymentMethod && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Payment Method:
                              </span>
                              <span className="font-medium">
                                {selectedPaymentMethod === "CASH"
                                  ? "Cash"
                                  : selectedPaymentMethod === "BANK"
                                    ? "Bank Transfer"
                                    : selectedPaymentMethod === "MOBILE_MONEY"
                                      ? "Mobile Money"
                                      : "Other"}
                              </span>
                            </div>
                          )}
                          {selectedBranch && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Branch:</span>
                              <span className="font-medium">
                                {selectedBranch.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? isEditMode
                    ? "Updating..."
                    : "Submitting..."
                  : isEditMode
                    ? "Update Record"
                    : "Submit Expenditure"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <NewCategoryForm
        isOpen={showNewCategoryDialog}
        onClose={() => setShowNewCategoryDialog(false)}
        onSuccess={handleNewCategorySuccess}
        userRole={userRole}
        rootCategoryId={expenseRootCategory?.id || ""}
        suggestedCode={suggestedParentCategoryCode}
        suggestedItemCode={suggestedFirstItemCode}
      />

      {/* New Sub-Category/Item Dialog */}
      <NewSubCategoryForm
        isOpen={showNewSubCategoryDialog}
        onClose={() => setShowNewSubCategoryDialog(false)}
        parentCategory={selectedCategory}
        onSuccess={handleNewSubCategorySuccess}
        userRole={userRole}
        suggestedCode={suggestedItemCode}
      />
    </>
  );
}
