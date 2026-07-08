//@ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  code: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await db.expenditureCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenditureRecords: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching expenditure categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const existing = await db.expenditureCategory.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      );
    }

    const trimmedCode = data.code?.trim() || null;

    if (trimmedCode) {
      const existingCode = await db.expenditureCategory.findUnique({
        where: { code: trimmedCode },
      });
      if (existingCode) {
        return NextResponse.json(
          { error: "Category with this code already exists" },
          { status: 409 }
        );
      }
    }

    const category = await db.expenditureCategory.create({
      data: {
        name: data.name,
        description: data.description,
        code: trimmedCode,
        kind: "EXPENSE", // Using "EXPENSE" based on action file
      },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });

  } catch (error) {
    console.error("Error creating expenditure category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
