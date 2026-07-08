import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

// POST /api/v1/users/[id]/reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const approver = session.user as any;
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER];
    if (!allowedRoles.includes(approver.role as UserRole)) {
      return NextResponse.json({ error: "You don't have permission to reject users" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { rejectionReason } = body;

    if (!rejectionReason?.trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id },
      include: { member: true, institution: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.user.update({ where: { id }, data: { isActive: false, updatedAt: new Date() } });

    if (user.member) {
      await db.member.update({
        where: { id: user.member.id },
        data: { rejectionReason },
      });
    } else if (user.institution) {
      await db.institution.update({
        where: { id: user.institution.id },
        data: { rejectionReason },
      });
    }

    await db.auditLog.create({
      data: {
        userId: approver.id,
        action: "USER_REJECTED",
        entityType: "User",
        entityId: id,
        details: `Rejected user: ${user.name}. Reason: ${rejectionReason}`,
      },
    });

    return NextResponse.json({ ok: true, message: "User rejected" });
  } catch (error) {
    console.error("Error rejecting user:", error);
    return NextResponse.json({ error: "Failed to reject user" }, { status: 500 });
  }
}
