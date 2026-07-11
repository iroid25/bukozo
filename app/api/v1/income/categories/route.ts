import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { Prisma } from "@prisma/client";

function toNumericCode(value: unknown) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function backfillMissingIncomeCodes() {
  const categories = await db.budgetCategory.findMany({
    where: { kind: "INCOME" },
    select: {
      id: true,
      name: true,
      code: true,
      parentId: true,
      parent: {
        select: {
          id: true,
          code: true,
        },
      },
    },
  });

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const usedCodes = new Set(
    categories
      .map((category) => category.code)
      .filter((code): code is string => Boolean(code)),
  );
  const pendingUpdates: Array<{ id: string; code: string; name: string }> = [];

  for (const category of categories) {
    if (category.code || !category.parentId) continue;

    const parent = categoriesById.get(category.parentId) || category.parent;
    const parentCode = toNumericCode(parent?.code);
    if (!parentCode) continue;

    const siblingCodes = categories
      .filter((item) => item.parentId === category.parentId && item.code)
      .map((item) => toNumericCode(item.code))
      .filter((code): code is number => Boolean(code));

    let nextCodeNumber = Math.max(parentCode, ...siblingCodes) + 1;
    let nextCode = String(nextCodeNumber).padStart(String(parent?.code || "").length || 6, "0");

    while (usedCodes.has(nextCode)) {
      nextCodeNumber += 1;
      nextCode = String(nextCodeNumber).padStart(String(parent?.code || "").length || 6, "0");
    }

    usedCodes.add(nextCode);
    pendingUpdates.push({
      id: category.id,
      code: nextCode,
      name: category.name,
    });
  }

  if (pendingUpdates.length === 0) {
    return 0;
  }

  await db.$transaction(async (tx) => {
    for (const update of pendingUpdates) {
      await tx.budgetCategory.update({
        where: { id: update.id },
        data: { code: update.code },
      });
    }
  });

  return pendingUpdates.length;
}

// GET /api/v1/income/categories - Get income categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    await backfillMissingIncomeCodes();

    const categories = await db.budgetCategory.findMany({
      where: {
        kind: "INCOME",
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        parent: true,
        children: true,
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

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching income categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
// POST /api/v1/income/categories - Create income category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, parentId, description, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedCode = code?.trim() || null;

    // Check for duplicate name
    const existingCategory = await db.budgetCategory.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        kind: "INCOME",
        parentId: parentId || null,
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      );
    }

    // Check for duplicate code
    if (trimmedCode) {
      const existingCode = await db.budgetCategory.findFirst({
        where: {
          code: { equals: trimmedCode, mode: "insensitive" },
          kind: "INCOME",
        },
      });

      if (existingCode) {
        return NextResponse.json(
          { error: "Category with this code already exists" },
          { status: 409 }
        );
      }
    }

    if (parentId) {
      const parent = await db.budgetCategory.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
      }

      if (parent.kind !== "INCOME") {
        return NextResponse.json(
          { error: "Parent category must be an income category" },
          { status: 400 },
        );
      }
    }

    // Transaction: Create / update category only
    const result = await db.$transaction(async (tx) => {
      // 1. Create Budget Category
      const category = trimmedCode
        ? await tx.budgetCategory.upsert({
            where: { code: trimmedCode },
            update: {},
            create: {
              name: trimmedName,
              code: trimmedCode,
              kind: "INCOME",
              isActive: typeof isActive === "boolean" ? isActive : true,
              parentId: parentId || null,
              description: description?.trim() || null,
            },
            include: {
              parent: true,
              children: true,
              _count: {
                select: {
                  incomeRecords: true,
                  expenditureRecords: true,
                  children: true,
                },
              },
            },
          })
        : await tx.budgetCategory.create({
            data: {
              name: trimmedName,
              code: null,
              kind: "INCOME",
              isActive: typeof isActive === "boolean" ? isActive : true,
              parentId: parentId || null,
              description: description?.trim() || null,
            },
            include: {
              parent: true,
              children: true,
              _count: {
                select: {
                  incomeRecords: true,
                  expenditureRecords: true,
                  children: true,
                },
              },
            },
          });

      if (
        trimmedCode &&
        (category.name.toLowerCase() !== trimmedName.toLowerCase() ||
          category.parentId !== (parentId || null))
      ) {
        throw new Error("Category with this code already exists");
      }

      const parentCategory = parentId
        ? await tx.budgetCategory.findUnique({
            where: { id: parentId },
          })
        : null;

      const siblingCategories = parentId
        ? await tx.budgetCategory.findMany({
            where: {
              kind: "INCOME",
              parentId,
            },
            select: { code: true },
          })
        : [];

      const numericSiblingCodes = siblingCategories
        .map((item) => Number(String(item.code || "").trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const parentNumericCode = Number(String(parentCategory?.code || "").trim());
      const nextNumericCode = Math.max(
        Number.isFinite(parentNumericCode) ? parentNumericCode : 0,
        ...numericSiblingCodes,
      ) + 1;

      const generatedCode = parentCategory?.code
        ? String(nextNumericCode).padStart(String(parentCategory.code).length, "0")
        : `4${String((await tx.budgetCategory.count({ where: { kind: "INCOME" } })) + 1).padStart(4, "0")}`;

      const finalAccountCode = trimmedCode || generatedCode;

      const finalCategory = !trimmedCode
        ? await tx.budgetCategory.update({
            where: { id: category.id },
            data: { code: finalAccountCode },
            include: {
              parent: true,
              children: true,
              _count: {
                select: {
                  incomeRecords: true,
                  expenditureRecords: true,
                  children: true,
                },
              },
            },
          })
        : category;

      // ── Ensure matching COA row exists for journal entry posting ──
      const existingCOA = await tx.chartOfAccount.findFirst({
        where: { accountCode: finalAccountCode, isActive: true },
      });
      if (!existingCOA) {
        await tx.chartOfAccount.create({
          data: {
            accountName: trimmedName,
            accountCode: finalAccountCode,
            fullCode: finalAccountCode,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 1,
            description: `Auto-generated from INCOME category: ${trimmedName}`,
            category: "INCOME",
          },
        });
      }

      return finalCategory;
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error creating income category:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Category with this code already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
