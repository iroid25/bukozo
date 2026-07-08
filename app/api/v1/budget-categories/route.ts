import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");

    const categories = await db.budgetCategory.findMany({
      where: {
        ...(kind ? { kind: kind as any } : {}),
      },
      include: {
        parent: true,
        children: true,
        _count: { select: { incomeRecords: true, expenditureRecords: true, children: true } },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching budget categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, kind, description, parentId } = body;

    if (!name || !kind) {
      return NextResponse.json({ error: "Name and kind are required" }, { status: 400 });
    }

    const existing = await db.budgetCategory.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, kind, parentId: parentId || null },
    });
    if (existing) return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 });

    if (code) {
      const existingCode = await db.budgetCategory.findUnique({ where: { code: code.trim() } });
      if (existingCode) return NextResponse.json({ error: "Category with this code already exists" }, { status: 409 });
    }

    const category = await db.budgetCategory.create({
      data: {
        name: name.trim(),
        kind,
        description,
        code: code?.trim() || null,
        parentId: parentId || null,
      },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error("Error creating budget category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
