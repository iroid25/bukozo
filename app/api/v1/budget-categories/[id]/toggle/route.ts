import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const category = await db.budgetCategory.findUnique({ where: { id } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const updated = await db.budgetCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error toggling category status:", error);
    return NextResponse.json({ error: "Failed to update category status" }, { status: 500 });
  }
}
