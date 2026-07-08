// components/income/new/CategoryQuickAdd.tsx - FIXED TO USE SERVER ACTIONS
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
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Tag,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import type { Category } from "@/types/incomes";

interface CategoryQuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  kind: "INCOME" | "EXPENSE";
  onCategoryCreated: (category: Category) => void;
  parentCategories: Category[];
  allCategories: Category[];
  defaultParentId?: string;
  rootCategoryId?: string;
  rootCategoryName?: string;
}

export default function CategoryQuickAdd({
  isOpen,
  onClose,
  kind,
  onCategoryCreated,
  parentCategories = [],
  allCategories = [],
  defaultParentId,
  rootCategoryId,
  rootCategoryName = "Income",
}: CategoryQuickAddProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    parentId: defaultParentId || "none",
  });

  const computeNextChildCode = (parentId: string) => {
    const parent = parentCategories.find((c) => c.id === parentId);
    if (!parent?.code) return "";

    const siblings = allCategories.filter((c) => c.parentId === parentId);
    const numericCodes = siblings
      .map((item) => Number(String(item.code || "").trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const parentNumeric = Number(String(parent.code).trim());
    const nextNumeric = Math.max(
      Number.isFinite(parentNumeric) ? parentNumeric : 0,
      ...numericCodes,
    ) + 1;

    return String(nextNumeric).padStart(String(parent.code).length, "0");
  };

  // Update parentId when defaultParentId changes
  useEffect(() => {
    if (defaultParentId) {
      console.log("🔵 defaultParentId changed to:", defaultParentId);
      setFormData((prev) => ({ ...prev, parentId: defaultParentId }));
    }
  }, [defaultParentId]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: "",
        code: "",
        description: "",
        parentId: defaultParentId || "none",
      });
    } else {
      console.log("🟢 Modal opened or parent changed. Current parentId:", formData.parentId);
      
      const currentParentId = formData.parentId;
      if (currentParentId !== "none") {
        const nextCode = computeNextChildCode(currentParentId);

        if (nextCode) {
          // Only update if current code is empty or we just changed the parent
          setFormData((prev) => {
            if (
              prev.code &&
              prev.code !== nextCode &&
              prev.parentId === currentParentId
            ) {
              return prev;
            }
            return { ...prev, code: nextCode };
          });
        }
      }
    }
  }, [isOpen, formData.parentId, defaultParentId, parentCategories, allCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    const isCreatingMainCategory = Boolean(
      rootCategoryId && formData.parentId === rootCategoryId,
    );
    const isCreatingItem =
      formData.parentId !== "none" && !isCreatingMainCategory;
    const parentName = isCreatingMainCategory
      ? rootCategoryName
      : parentCategories.find((cat) => cat.id === formData.parentId)?.name;

    console.log("🚀 Submitting category/item via API:", {
      name: formData.name.trim(),
      code: formData.code.trim() || null,
      parentId: formData.parentId === "none" ? null : formData.parentId,
      kind,
      isCreatingItem,
      parentName,
    });

    setLoading(true);

    try {
      // ✅ Call API Route
      const endpoint = kind === "INCOME" 
        ? "/api/v1/income/categories" 
        : "/api/v1/expenditure/categories";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          parentId: formData.parentId === "none" ? null : formData.parentId,
          description: formData.description.trim() || null,
        }),
      });

      const result = await response.json();

      console.log("📥 API result:", result);

      if (!response.ok) {
        console.error("❌ API error:", result.error);
        throw new Error(result.error || "Failed to create category");
      }

      console.log("✅ Success! Created:", {
        type: isCreatingItem ? "ITEM" : "CATEGORY",
        name: result.data.name,
        id: result.data.id,
        parentId: result.data.parentId,
        parentName: parentName,
      });

      toast.success(
        isCreatingItem
        ? `Item "${formData.name}" created under ${parentName}!`
          : isCreatingMainCategory
            ? `Main category "${formData.name}" created under ${rootCategoryName}!`
            : `Category "${formData.name}" created!`
      );

      console.log("🎯 Calling onCategoryCreated with:", result.data);
      onCategoryCreated(result.data);

      console.log("🚪 Closing modal...");
      onClose();
    } catch (error) {
      console.error("💥 Error creating category:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create category"
      );
    } finally {
      setLoading(false);
    }
  };

  const isCreatingMainCategory = Boolean(
    rootCategoryId && formData.parentId === rootCategoryId,
  );
  const isCreatingItem =
    formData.parentId !== "none" && !isCreatingMainCategory;
  const selectedParent =
    parentCategories.find((cat) => cat.id === formData.parentId) ||
    (isCreatingMainCategory
      ? { id: rootCategoryId || "income-root", name: rootCategoryName }
      : undefined);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isCreatingItem
                  ? "Create New Item"
                  : isCreatingMainCategory
                    ? "Create New Main Category"
                    : "Create New Category"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isCreatingItem
                  ? `Add item under ${selectedParent?.name}`
                  : isCreatingMainCategory
                    ? `Add main category under ${rootCategoryName}`
                    : "Create parent category"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {/* Alert Box */}
            <Alert
              className={
                isCreatingItem
                  ? "border-green-200 bg-green-50"
                  : "border-purple-200 bg-purple-50"
              }
            >
              <Info
                className={`h-4 w-4 ${isCreatingItem ? "text-green-600" : "text-purple-600"}`}
              />
              <AlertDescription
                className={`text-xs ${isCreatingItem ? "text-green-800" : "text-purple-800"}`}
              >
                {isCreatingItem ? (
                  <>
                    <strong>Item:</strong> Used in transactions. Example:
                    "Vehicle Sales"
                  </>
                ) : isCreatingMainCategory ? (
                  <>
                    <strong>Main Category:</strong> Groups specific items under
                    <strong> {rootCategoryName}</strong>.
                  </>
                ) : (
                  <>
                    <strong>Category:</strong> Contains items. Example: "Sales
                    Income"
                  </>
                )}
              </AlertDescription>
            </Alert>

            {/* Parent Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="parentId" className="text-sm">
                Parent Category
              </Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => {
                  console.log("👆 Parent selected:", value);
                  setFormData((prev) => ({ ...prev, parentId: value }));
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select parent..." />
                </SelectTrigger>
                <SelectContent>
                  {rootCategoryId && (
                    <SelectItem value={rootCategoryId}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">{rootCategoryName} Root</span>
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3 w-3 text-gray-400" />
                      <span className="text-sm">None - Top Level Category</span>
                    </div>
                  </SelectItem>
                  {parentCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                        Existing Categories
                      </div>
                      {parentCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <Layers className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{category.name}</span>
                            {category.code && (
                              <span className="text-xs text-gray-500">
                                ({category.code})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {isCreatingItem && selectedParent && (
                <p className="text-xs text-green-600">
                  ✓ Creating item under: <strong>{selectedParent.name}</strong>
                </p>
              )}
              {isCreatingMainCategory && (
                <p className="text-xs text-purple-600">
                  ✓ Creating a main category under{" "}
                  <strong>{rootCategoryName}</strong>
                </p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">
                {isCreatingItem
                  ? "Item Name *"
                  : isCreatingMainCategory
                    ? "Main Category Name *"
                    : "Category Name *"}
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  console.log("✏️ Name changed to:", e.target.value);
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                }}
                className="h-10"
                placeholder={
                  isCreatingItem
                    ? "e.g., Vehicle Sales"
                    : isCreatingMainCategory
                      ? "e.g., Withdrawal Fees"
                      : "e.g., Sales Income"
                }
                required
              />
              {isCreatingItem && selectedParent && formData.name && (
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 p-2 rounded">
                  <ChevronRight className="h-3 w-3" />
                  <span>
                    {selectedParent.name} → <strong>{formData.name}</strong>
                  </span>
                </div>
              )}
              {isCreatingMainCategory && selectedParent && formData.name && (
                <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 p-2 rounded">
                  <ChevronRight className="h-3 w-3" />
                  <span>
                    {selectedParent.name} → <strong>{formData.name}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Code (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm">
                Code (Optional)
              </Label>
              <Input
                id="code"
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                className="h-10"
                placeholder="e.g., INC-001"
              />
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>

          {/* Fixed Actions at Bottom */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                console.log("❌ Cancel clicked");
                onClose();
              }}
              disabled={loading}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim()}
              size="sm"
              className="min-w-[100px]"
            >
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {isCreatingItem
                ? "Create Item"
                : isCreatingMainCategory
                  ? "Create Main Category"
                  : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
