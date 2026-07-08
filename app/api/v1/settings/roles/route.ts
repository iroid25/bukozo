import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "BRANCHMANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limits = await db.staffLimit.findMany();
    return NextResponse.json({ success: true, data: limits });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "BRANCHMANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { role, isActive, perTransactionLimit, dailyLimit } = body;

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const updateData: any = { isActive };
    if (perTransactionLimit !== undefined) updateData.perTransactionLimit = Number(perTransactionLimit);
    if (dailyLimit !== undefined) updateData.dailyLimit = Number(dailyLimit);

    const createData: any = {
      role: role as UserRole,
      isActive,
      perTransactionLimit: Number(perTransactionLimit) || 0,
      dailyLimit: Number(dailyLimit) || 0,
    };

    const limit = await db.staffLimit.upsert({
      where: { role: role as UserRole },
      update: updateData,
      create: createData,
    });

    return NextResponse.json({ success: true, data: limit });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
