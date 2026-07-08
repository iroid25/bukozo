// actions/incomeandexp/budget-categories.ts (Updated)
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { CategoryKind, UserRole } from "@prisma/client";
import {
  generateNextExpenseCategoryCode,
  getExpenseRootCategory,
} from "@/lib/expenditure/category-code";

type CreateBudgetCategoryInput = {
  name: string;
  code?: string | null;
  kind: CategoryKind;
  isActive?: boolean;
  parentId?: string | null;
  description?: string | null;
};

type UpdateBudgetCategoryInput = {
  id: string;
  name?: string;
  code?: string | null;
  isActive?: boolean;
  parentId?: string | null;
  description?: string | null; // ✅ Added this
};

type GetBudgetCategoriesFilter = {
  kind?: CategoryKind;
  isActive?: boolean;
  includeChildren?: boolean;
  parentId?: string | null;
};

type ServerActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Create a new budget category with hierarchy support
 */
export async function createBudgetCategory(
  data: CreateBudgetCategoryInput
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Check if user has permission (ADMIN or ACCOUNTANT)
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      return {
        success: false,
        error:
          "You don't have permission to create budget categories. Please contact your Branch Manager or Accountant.",
      };
    }

    // Validate input
    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: "Category name is required." };
    }

    if (!data.kind) {
      return {
        success: false,
        error: "Category kind (INCOME/EXPENSE) is required.",
      };
    }

    const trimmedName = data.name.trim();
    const trimmedCode = data.code?.trim() || null;

    const rootCategory =
      data.kind === CategoryKind.EXPENSE
        ? getExpenseRootCategory(
            await db.budgetCategory.findMany({
              where: { kind: CategoryKind.EXPENSE },
              select: {
                id: true,
                name: true,
                code: true,
                parentId: true,
              },
            }),
          )
        : null;

    if (data.kind === CategoryKind.EXPENSE && !rootCategory) {
      return {
        success: false,
        error: "Expense root category not found.",
      };
    }

    const resolvedParentId =
      data.kind === CategoryKind.EXPENSE && rootCategory
        ? data.parentId || rootCategory.id
        : data.parentId || null;

    // Check for duplicate name at the same level (same parent)
    const existingByName = await db.budgetCategory.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
        kind: data.kind,
        parentId: resolvedParentId,
      },
    });

    if (existingByName) {
      return {
        success: false,
        error: `A category with this name already exists in this group.`,
      };
    }

    // Check for duplicate code if provided (globally unique)
    if (trimmedCode) {
      const existingByCode = await db.budgetCategory.findUnique({
        where: { code: trimmedCode },
      });

      if (existingByCode) {
        return {
          success: false,
          error: "A category with this code already exists.",
        };
      }
    }

    // Validate parent if provided
    if (resolvedParentId) {
      const parent = await db.budgetCategory.findUnique({
        where: { id: resolvedParentId },
      });

      if (!parent) {
        return { success: false, error: "Parent category not found." };
      }

      if (parent.kind !== data.kind) {
        return {
          success: false,
          error: "Parent category must be of the same kind (INCOME/EXPENSE).",
        };
      }

      if (
        data.kind === CategoryKind.EXPENSE &&
        rootCategory &&
        parent.id !== rootCategory.id &&
        parent.parentId !== rootCategory.id
      ) {
        return {
          success: false,
          error:
            "Expense items must be created under a direct child of the Expenses root category.",
        };
      }

      // Prevent creating sub-categories of sub-categories (2 levels max)
      if (parent.parentId && parent.parentId !== rootCategory?.id) {
        return {
          success: false,
          error:
            "Cannot create sub-categories of sub-categories. Maximum 2 levels allowed.",
        };
      }
    }

    // Create the category and sync to Chart of Accounts
    const result = await db.$transaction(async (tx) => {
      // 1. Create the Budget Category
      const allCategories = await tx.budgetCategory.findMany({
        where: { kind: data.kind },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
        },
      });

      const finalCode =
        trimmedCode ||
        (data.kind === CategoryKind.EXPENSE && rootCategory
          ? generateNextExpenseCategoryCode(
              allCategories,
              resolvedParentId,
              rootCategory.id,
            )
          : null);

      const category = await tx.budgetCategory.create({
        data: {
          name: trimmedName,
          code: finalCode,
          kind: data.kind,
          isActive: data.isActive ?? true,
          parentId: resolvedParentId,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      // 2. Sync to Chart of Accounts (Hub)
      // Only create main parent accounts in COA for now, or all? User asked for "sync".
      // Creating COA for *every* category allows drill down.
      
      const ledgerType = data.kind === "INCOME" ? "INCOME" : "EXPENDITURES";
      const debitCredit = data.kind === "INCOME" ? "CR" : "DR";
      
      // Generate a Code if not provided
      // Strategy: Count existing accounts of this type to append number
      const count = await tx.chartOfAccount.count({
        where: { ledgerType }
      });
      
      const prefix = data.kind === "INCOME" ? "4" : "6"; // 4xxxx for Income, 6xxxx for Expense
      const nextNum = (count + 1).toString().padStart(4, '0');
      const generatedCode = `${prefix}${nextNum}`;
      
      // Use provided code if it exists, otherwise generated
      const finalAccountCode = trimmedCode || generatedCode;

      // Ensure code is unique in COA
      const existingCoa = await tx.chartOfAccount.findUnique({
        where: { accountCode: finalAccountCode }
      });

      const uniqueAccountCode = existingCoa ? `${finalAccountCode}-${Date.now().toString().slice(-4)}` : finalAccountCode;

      await tx.chartOfAccount.create({
        data: {
          accountName: trimmedName,
          accountCode: uniqueAccountCode,
          fullCode: uniqueAccountCode, // Using same for now
          ledgerType: ledgerType,
          debitCredit: debitCredit,
          isActive: data.isActive ?? true,
          level: 1, // Default to 1
          description: `Auto-generated from ${data.kind} Category: ${trimmedName}`,
          category: data.kind
        }
      });

      return category;
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/accounts/incomes");
    revalidatePath("/dashboard/accounts/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/expenditure");
    revalidatePath("/dashboard/accounting/chart-of-accounts"); // Update COA page

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error creating budget category:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Get budget categories with optional filters - includes hierarchy
 */
export async function getBudgetCategories(
  filter?: GetBudgetCategoriesFilter
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const categories = await db.budgetCategory.findMany({
      where: {
        ...(filter?.kind && { kind: filter.kind }),
        ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
        ...(filter?.parentId !== undefined && { parentId: filter.parentId }),
      },
      include: {
        parent: true,
        children: filter?.includeChildren ? true : false,
        _count: {
          select: {
            incomeRecords: true,
            expenditureRecords: true,
            children: true,
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    return {
      success: true,
      data: categories,
    };
  } catch (error) {
    console.error("Error fetching budget categories:", error);
    return {
      success: false,
      error: "Failed to fetch budget categories.",
    };
  }
}

/**
 * Get all categories organized hierarchically
 */
export async function getHierarchicalCategories(
  kind: CategoryKind
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Get only parent categories (no parentId)
    const parentCategories = await db.budgetCategory.findMany({
      where: {
        kind,
        isActive: true,
        parentId: null,
      },
      include: {
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      data: parentCategories,
    };
  } catch (error) {
    console.error("Error fetching hierarchical categories:", error);
    return {
      success: false,
      error: "Failed to fetch categories.",
    };
  }
}

/**
 * Update a budget category
 */
export async function updateBudgetCategory(
  data: UpdateBudgetCategoryInput
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Check permissions
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      return {
        success: false,
        error: "You don't have permission to update budget categories.",
      };
    }

    // Check if category exists
    const existingCategory = await db.budgetCategory.findUnique({
      where: { id: data.id },
    });

    if (!existingCategory) {
      return { success: false, error: "Category not found." };
    }

    const nextParentId =
      data.parentId === undefined ? existingCategory.parentId : data.parentId || null;

    // Check for duplicate name if name is being updated
    if (data.name && data.name.trim() !== existingCategory.name) {
      const duplicate = await db.budgetCategory.findFirst({
        where: {
          name: {
          equals: data.name.trim(),
          mode: "insensitive",
          },
          kind: existingCategory.kind,
          id: { not: data.id },
          parentId: nextParentId,
        },
      });

      if (duplicate) {
        return {
          success: false,
          error: "Another category with this name already exists.",
        };
      }
    }

    // Check for duplicate code if code is being updated
    if (data.code && data.code.trim() !== existingCategory.code) {
      const duplicate = await db.budgetCategory.findUnique({
        where: {
          code: data.code.trim(),
        },
      });

      if (duplicate && duplicate.id !== data.id) {
        return {
          success: false,
          error: "Another category with this code already exists.",
        };
      }
    }

    // Validate parent if being updated
    if (data.parentId !== undefined) {
      const rootCategory =
        existingCategory.kind === CategoryKind.EXPENSE
          ? getExpenseRootCategory(
              await db.budgetCategory.findMany({
                where: { kind: CategoryKind.EXPENSE },
                select: {
                  id: true,
                  name: true,
                  code: true,
                  parentId: true,
                },
              }),
            )
          : null;

      if (existingCategory.kind === CategoryKind.EXPENSE && !rootCategory) {
        return { success: false, error: "Expense root category not found." };
      }

      if (data.parentId) {
        const parent = await db.budgetCategory.findUnique({
          where: { id: data.parentId },
        });

        if (!parent) {
          return { success: false, error: "Parent category not found." };
        }

        if (parent.kind !== existingCategory.kind) {
          return {
            success: false,
            error: "Parent category must be of the same kind.",
          };
        }

        if (data.parentId === data.id) {
          return {
            success: false,
            error: "A category cannot be its own parent.",
          };
        }

        if (
          existingCategory.kind === CategoryKind.EXPENSE &&
          rootCategory &&
          parent.id !== rootCategory.id &&
          parent.parentId !== rootCategory.id
        ) {
          return {
            success: false,
            error:
              "Expense categories can only live under the Expenses root or its direct children.",
          };
        }
      }
    }

    // Update the category
    const updated = await db.budgetCategory.update({
      where: { id: data.id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        parent: true,
        children: true,
      },
    });

    // Revalidate paths
    revalidatePath("/dashboard/accounts/incomes");
    revalidatePath("/dashboard/accounts/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/expenditure");

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Error updating budget category:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Delete a budget category
 */
export async function deleteBudgetCategory(
  id: string
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Check permissions - only ADMIN can delete
    if (user.role !== UserRole.ADMIN) {
      return {
        success: false,
        error: "Only administrators can delete budget categories.",
      };
    }

    // Check if category exists
    const category = await db.budgetCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            incomeRecords: true,
            expenditureRecords: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return { success: false, error: "Category not found." };
    }

    // Prevent deletion if category has records
    if (
      category._count.incomeRecords > 0 ||
      category._count.expenditureRecords > 0
    ) {
      return {
        success: false,
        error:
          "Cannot delete category with existing income or expenditure records. Deactivate it instead.",
      };
    }

    // Prevent deletion if category has children
    if (category._count.children > 0) {
      return {
        success: false,
        error:
          "Cannot delete category with items. Delete or reassign them first.",
      };
    }

    // Delete the category
    await db.budgetCategory.delete({
      where: { id },
    });

    // Revalidate paths
    revalidatePath("/dashboard/accounts/incomes");
    revalidatePath("/dashboard/accounts/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/expenditure");

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    console.error("Error deleting budget category:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Toggle category active status (soft delete)
 */
export async function toggleBudgetCategoryStatus(
  id: string
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Check permissions
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      return {
        success: false,
        error: "You don't have permission to modify budget categories.",
      };
    }

    const category = await db.budgetCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return { success: false, error: "Category not found." };
    }

    const updated = await db.budgetCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });

    revalidatePath("/dashboard/accounts/incomes");
    revalidatePath("/dashboard/accounts/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/expenditure");

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Error toggling category status:", error);
    return {
      success: false,
      error: "An unexpected error occurred.",
    };
  }
}
