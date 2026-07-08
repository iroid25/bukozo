import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

// POST /api/v1/users/[id]/approve
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
      return NextResponse.json({ error: "You don't have permission to approve users" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    const user = await db.user.findUnique({
      where: { id },
      include: { member: true, institution: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.user.update({ where: { id }, data: { isActive: true, updatedAt: new Date() } });

    if (user.member) {
      await db.member.update({
        where: { id: user.member.id },
        data: { isApproved: true, approvalDate: new Date() },
      });
    } else if (user.institution) {
      await db.institution.update({
        where: { id: user.institution.id },
        data: { isApproved: true, approvalDate: new Date() },
      });
    }

    await db.auditLog.create({
      data: {
        userId: approver.id,
        action: "USER_APPROVED",
        entityType: "User",
        entityId: id,
        details: `Approved user: ${user.name}. ${notes ? `Notes: ${notes}` : ""}`,
      },
    });

    return NextResponse.json({ ok: true, message: "User approved successfully" });
  } catch (error) {
    console.error("Error approving user:", error);
    return NextResponse.json({ error: "Failed to approve user" }, { status: 500 });
  }
}
