import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { Prisma, UserRole } from "@prisma/client";
import { getExpenseRootCategory } from "@/lib/expenditure/category-code";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAuthorizedUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const user = session.user as { role?: string };
  const allowedRoles: string[] = [
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.BRANCHMANAGER,
  ];

  if (!allowedRoles.includes(user.role || "")) {
    return null;
  }

  return user;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, code, description, isActive, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedCode = code?.trim() || null;
    const trimmedDescription = description?.trim() || null;

    const existing = await db.budgetCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const rootCategory = getExpenseRootCategory(
      await db.budgetCategory.findMany({
        where: { kind: "EXPENSE" },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
        },
      }),
    );

    if (!rootCategory) {
      return NextResponse.json(
        { error: "Expense root category not found" },
        { status: 400 },
      );
    }

    const duplicateName = await db.budgetCategory.findFirst({
      where: {
        id: { not: id },
        kind: "EXPENSE",
        parentId: parentId ?? existing.parentId ?? null,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (duplicateName) {
      return NextResponse.json(
        { error: "Category with this name already exists in this group" },
        { status: 409 }
      );
    }

    if (trimmedCode) {
      const duplicateCode = await db.budgetCategory.findFirst({
        where: {
          id: { not: id },
          code: { equals: trimmedCode, mode: "insensitive" },
          kind: "EXPENSE",
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: "Category with this code already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      let parent = null;
      const nextParentId =
        parentId === undefined ? existing.parentId : parentId || null;

      if (nextParentId) {
        parent = await tx.budgetCategory.findUnique({
          where: { id: nextParentId },
        });

        if (!parent) {
          throw new Error("Parent category not found");
        }

        if (parent.kind !== "EXPENSE") {
          throw new Error("Parent category must be an expense category");
        }

        if (parent.id !== rootCategory.id && parent.parentId !== rootCategory.id) {
          throw new Error(
            "Expense categories can only be placed under the Expenses root or its direct children",
          );
        }
      }

      return tx.budgetCategory.update({
        where: { id },
        data: {
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDescription,
          isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
          parentId: nextParentId,
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
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating expenditure category:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name or code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const category = await db.budgetCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            expenditureRecords: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (category._count.expenditureRecords > 0 || category._count.children > 0) {
      const deactivated = await db.budgetCategory.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Category deactivated because it is in use",
        data: deactivated,
      });
    }

    await db.budgetCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      data: true,
    });
  } catch (error) {
    console.error("Error deleting expenditure category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
