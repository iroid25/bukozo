import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { Prisma, UserRole } from "@prisma/client";
import {
  generateNextExpenseCategoryCode,
} from "@/lib/expenditure/category-code";

// GET /api/v1/expenditure/categories - Get expenditure categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const categories = await db.budgetCategory.findMany({
      where: {
        kind: "EXPENSE",
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            expenditureRecords: true,
            incomeRecords: true,
            children: true,
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching expenditure categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
// POST /api/v1/expenditure/categories - Create expenditure category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { role?: string };
    const allowedRoles: string[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
    ];
    if (!allowedRoles.includes(user.role || "")) {
      return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
    }
    const { name, code, parentId, description, isActive } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedCode = code?.trim() || null;

    // Check for duplicate name
    // Transaction: Create Category + COA Entry
    const result = await db.$transaction(async (tx) => {
      const rootCategory = await tx.budgetCategory.findFirst({
        where: {
          kind: "EXPENSE",
          OR: [
            { code: "500000" },
            { name: { equals: "Expenses", mode: "insensitive" } },
          ],
        },
      });

      if (!rootCategory) {
        throw new Error("Expense root category not found");
      }

      const resolvedParentId = parentId || rootCategory.id;
      const parent = await tx.budgetCategory.findUnique({
        where: { id: resolvedParentId },
      });

      if (!parent) {
        throw new Error("Parent category not found");
      }

      if (parent.kind !== "EXPENSE") {
        throw new Error("Parent category must be an expense category");
      }

      if (parent.id !== rootCategory.id && parent.parentId !== rootCategory.id) {
        throw new Error(
          "Expense items must be created under a direct child of the Expenses root category",
        );
      }

      const allExpenseCategories = await tx.budgetCategory.findMany({
        where: { kind: "EXPENSE" },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
        },
      });

      const generatedCode =
        trimmedCode ||
        generateNextExpenseCategoryCode(
          allExpenseCategories,
          resolvedParentId,
          rootCategory.id,
        );

      if (!generatedCode) {
        throw new Error("Failed to generate expense category code");
      }

      const existingCode = await tx.budgetCategory.findFirst({
        where: {
          code: { equals: generatedCode, mode: "insensitive" },
          kind: "EXPENSE",
        },
      });

      if (existingCode) {
        throw new Error("Category with this code already exists");
      }

      const existingCategory = await tx.budgetCategory.findFirst({
        where: {
          name: { equals: trimmedName, mode: "insensitive" },
          kind: "EXPENSE",
          parentId: resolvedParentId,
        },
      });

      if (existingCategory) {
        throw new Error("Category with this name already exists");
      }

      // 1. Create Budget Category
      const category = await tx.budgetCategory.create({
        data: {
          name: trimmedName,
          code: generatedCode,
          kind: "EXPENSE",
          isActive: typeof isActive === "boolean" ? isActive : true,
          parentId: resolvedParentId,
          description: description?.trim() || null,
        },
        include: {
          parent: true,
          children: true,
          _count: {
            select: {
              expenditureRecords: true,
              incomeRecords: true,
              children: true,
            },
          },
        },
      });

      // 2. Sync to Chart of Accounts (Hub)
      const ledgerType = "EXPENDITURES";
      const debitCredit = "DR"; // Expenses are Debit

      const coaCount = await tx.chartOfAccount.count({
        where: { ledgerType },
      });

      const coaPrefix = "6"; // 6xxxx for Expenses
      const coaNextNum = (coaCount + 1).toString().padStart(4, "0");
      const coaGeneratedCode = `${coaPrefix}${coaNextNum}`;

      const existingCoa = await tx.chartOfAccount.findUnique({
        where: { accountCode: coaGeneratedCode },
      });

      const uniqueAccountCode = existingCoa
        ? `${coaGeneratedCode}-${Date.now().toString().slice(-4)}`
        : coaGeneratedCode;

      await tx.chartOfAccount.create({
        data: {
          accountName: trimmedName,
          accountCode: uniqueAccountCode,
          fullCode: uniqueAccountCode,
          ledgerType: ledgerType,
          debitCredit: debitCredit,
          isActive: true,
          level: 1,
          description: `Auto-generated from Expense Category: ${trimmedName}`,
          category: "EXPENDITURES"
        }
      });

      return category;
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error creating expenditure category:", error);
    if (error instanceof Error) {
      if (
        error.message === "Parent category not found" ||
        error.message === "Parent category must be an expense category" ||
        error.message ===
          "Expense items must be created under a direct child of the Expenses root category" ||
        error.message === "Expense root category not found" ||
        error.message === "Failed to generate expense category code"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name or code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
