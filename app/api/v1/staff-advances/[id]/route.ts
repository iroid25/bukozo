import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const rows = await db.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
    );
    const advance = rows[0];
    if (!advance) return NextResponse.json({ error: "Advance not found." }, { status: 404 });

    // Teller can only view advances they initiated
    if (
      user.role === UserRole.TELLER &&
      advance.initiatedByUserId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Branch manager / accountant can only view their branch
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.TELLER &&
      user.branchId &&
      advance.branchId !== user.branchId
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Fetch repayments
    const repayments = await db.$queryRaw<any[]>(
      Prisma.sql`
        SELECT * FROM "StaffAdvanceRepayment"
        WHERE "advanceId" = ${id}
        ORDER BY "paidAt" ASC
      `,
    );

    // Enrich with user data
    const userIds = Array.from(
      new Set(
        [
          advance.staffId,
          advance.initiatedByUserId,
          advance.approvedById,
          advance.rejectedById,
          ...repayments.map((r: any) => r.recordedByUserId),
        ].filter(Boolean),
      ),
    );

    const users =
      userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, role: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const branch = advance.branchId
      ? await db.branch.findUnique({
          where: { id: advance.branchId },
          select: { id: true, name: true },
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        ...advance,
        staff: userMap.get(advance.staffId) || null,
        initiatedBy: userMap.get(advance.initiatedByUserId) || null,
        approvedBy: advance.approvedById ? userMap.get(advance.approvedById) || null : null,
        rejectedBy: advance.rejectedById ? userMap.get(advance.rejectedById) || null : null,
        branch,
        repayments: repayments.map((r: any) => ({
          ...r,
          recordedBy: userMap.get(r.recordedByUserId) || null,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error fetching advance:", error);
    return NextResponse.json(
      { error: "Failed to fetch advance", details: error.message },
      { status: 500 },
    );
  }
}
