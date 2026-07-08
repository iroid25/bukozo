// app/api/v1/account-types/[id]/toggle-default/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { normalizeAccountTypeName } from "@/types/accountTypes";

// PATCH /api/v1/account-types/[id]/toggle-default - Toggle account type default status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate isDefault field
    if (typeof body.isDefault !== "boolean") {
      return NextResponse.json(
        { error: "isDefault must be a boolean" },
        { status: 400 }
      );
    }

    // Check if account type exists
    const existing = await db.accountType.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Account type not found" },
        { status: 404 }
      );
    }

    // Update the default status
    const updated = await db.accountType.update({
      where: { id },
      data: { isDefault: body.isDefault },
    });

    return NextResponse.json({
      data: {
        ...updated,
        name: normalizeAccountTypeName(updated.name),
      },
      message: `Account type ${body.isDefault ? "set as" : "removed from"} default successfully`,
    });
  } catch (error) {
    console.error("Error toggling account type default:", error);
    return NextResponse.json(
      { error: "Failed to update default status" },
      { status: 500 }
    );
  }
}