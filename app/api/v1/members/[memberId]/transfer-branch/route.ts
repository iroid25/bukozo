import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "BRANCHMANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;
  const { targetBranchId } = await request.json();

  if (!targetBranchId) {
    return NextResponse.json({ error: "Target branch is required" }, { status: 400 });
  }

  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: { include: { branch: true } } },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetBranch = await db.branch.findUnique({ where: { id: targetBranchId } });
    if (!targetBranch) {
      return NextResponse.json({ error: "Target branch not found" }, { status: 404 });
    }

    if (member.user.branchId === targetBranchId) {
      return NextResponse.json({ error: "Member already belongs to this branch" }, { status: 400 });
    }

    const oldBranchName = member.user.branch?.name || "Unknown";

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: member.userId },
        data: { branchId: targetBranchId },
      });

      await tx.account.updateMany({
        where: { memberId },
        data: { branchId: targetBranchId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Member transferred from ${oldBranchName} to ${targetBranch.name}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
