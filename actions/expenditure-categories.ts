"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function getExpenditureCategories() {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const categories = await db.expenditureCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenditureRecords: true },
        },
      },
    });

    return { success: true, data: categories };
  } catch (error) {
    console.error("Error fetching expenditure categories:", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}

export async function createExpenditureCategory(data: {
  name: string;
  description?: string;
  code?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
      return { success: false, error: "Unauthorized" };
    }

    if (!data.name) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db.expenditureCategory.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return { success: false, error: "Category with this name already exists" };
    }

    if (data.code) {
      const existingCode = await db.expenditureCategory.findUnique({
        where: { code: data.code },
      });
      if (existingCode) {
        return { success: false, error: "Category with this code already exists" };
      }
    }

    const category = await db.expenditureCategory.create({
      data: {
        name: data.name,
        description: data.description,
        code: data.code,
        kind: "EXPENSE",
      },
    });

    revalidatePath("/dashboard/settings/expenditure-categories");
    return { success: true, data: category };
  } catch (error) {
    console.error("Error creating expenditure category:", error);
    return { success: false, error: "Failed to create category" };
  }
}

export async function updateExpenditureCategory(
  id: string,
  data: { name: string; description?: string; code?: string; isActive?: boolean }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
      return { success: false, error: "Unauthorized" };
    }

    const category = await db.expenditureCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        code: data.code,
        isActive: data.isActive,
      },
    });

    revalidatePath("/dashboard/settings/expenditure-categories");
    return { success: true, data: category };
  } catch (error) {
    console.error("Error updating expenditure category:", error);
    if ((error as any).code === "P2002") {
        return { success: false, error: "Name or code already exists" };
    }
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteExpenditureCategory(id: string) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
      return { success: false, error: "Unauthorized" };
    }

    // Check usage
    const category = await db.expenditureCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { expenditureRecords: true },
        },
      },
    });

    if (!category) return { success: false, error: "Category not found" };

    if (category._count.expenditureRecords > 0) {
      // Soft delete if used
      await db.expenditureCategory.update({
        where: { id },
        data: { isActive: false },
      });
      revalidatePath("/dashboard/settings/expenditure-categories");
      return { success: true, message: "Category deactivated (in use)" };
    }

    await db.expenditureCategory.delete({
      where: { id },
    });

    revalidatePath("/dashboard/settings/expenditure-categories");
    return { success: true, message: "Category deleted" };
  } catch (error) {
    console.error("Error deleting expenditure category:", error);
    return { success: false, error: "Failed to delete category" };
  }
}
