import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { ReportService } from "@/services/report.service";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    if (!memberId) {
      return NextResponse.json({ success: false, error: "memberId is required" }, { status: 400 });
    }

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    // Branch scoping: non-admin, non-accountant users can only view members in their branch
    const requestedBranchId = searchParams.get("branchId");
    const effectiveBranchId = resolveBranchScope(user, requestedBranchId);
    if (effectiveBranchId && user.role !== "ADMIN" && user.role !== "ACCOUNTANT") {
      const member = await db.member.findUnique({
        where: { id: memberId },
        select: { userId: true },
      });
      if (member) {
        const memberUser = await db.user.findUnique({
          where: { id: member.userId },
          select: { branchId: true },
        });
        if (memberUser && memberUser.branchId !== effectiveBranchId) {
          return NextResponse.json({ success: false, error: "Access denied: member not in your branch" }, { status: 403 });
        }
      }
    }

    const result = await ReportService.getMemberStatement(memberId, from, to);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
