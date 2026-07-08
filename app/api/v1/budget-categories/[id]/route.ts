import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, code, description, parentId } = body;

    const existing = await db.budgetCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    if (name && name.trim() !== existing.name) {
      const duplicate = await db.budgetCategory.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" }, kind: existing.kind, id: { not: id }, parentId: parentId ?? existing.parentId },
      });
      if (duplicate) return NextResponse.json({ error: "Another category with this name already exists" }, { status: 409 });
    }

    if (code && code.trim() !== existing.code) {
      const duplicateCode = await db.budgetCategory.findUnique({ where: { code: code.trim() } });
      if (duplicateCode && duplicateCode.id !== id) {
        return NextResponse.json({ error: "Another category with this code already exists" }, { status: 409 });
      }
    }

    const updated = await db.budgetCategory.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code !== undefined ? { code: code?.trim() || null } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating budget category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can delete budget categories" }, { status: 403 });
    }

    const { id } = await params;

    const category = await db.budgetCategory.findUnique({
      where: { id },
      include: { _count: { select: { incomeRecords: true, expenditureRecords: true, children: true } } },
    });

    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    if (category._count.incomeRecords > 0 || category._count.expenditureRecords > 0) {
      return NextResponse.json({ error: "Cannot delete category with existing records. Deactivate it instead." }, { status: 400 });
    }

    if (category._count.children > 0) {
      return NextResponse.json({ error: "Cannot delete category with child categories" }, { status: 400 });
    }

    await db.budgetCategory.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Error deleting budget category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
